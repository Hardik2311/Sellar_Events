const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { hmacMatches } = require("./crypto");
const {
    db, getPlatformCredentials, razorpayRequest, RAZORPAY_SECRETS, PAYMENTS_REGION,
} = require("./razorpayClient");
const { confirmPayment } = require("./fulfillOrder");
const { round2 } = require("./pricing");

const { FieldValue } = admin.firestore;

// Organizers buying event credits from the platform (Account → Recharge).
// Prices live HERE, not in the browser. Keep the displayed prices in
// src/components/RechargeModal.tsx in sync.
const CREDIT_PLANS = {
    1: 1000,
    5: 3999,
    10: 5999,
    20: 9999,
};
// Plan prices include 18% GST (platform's own service). Stored split out on
// each purchase for invoicing.
const CREDIT_GST_RATE = 18;

const purchaseRef = (id) => db.collection("creditPurchases").doc(String(id));

const assertMember = async (auth, companyId) => {
    if (!auth) throw new HttpsError("unauthenticated", "You must be logged in.");
    if (!companyId) throw new HttpsError("invalid-argument", "Missing company.");
    if (auth.token.companyId !== companyId && auth.uid !== companyId) {
        throw new HttpsError("permission-denied", "You are not part of this company.");
    }
};

/**
 * Adds the credits for a paid purchase. Idempotent: verify callable and
 * webhook may both call it; credits are only ever added once.
 */
const fulfillCreditPurchase = async (ref, payment) => {
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new HttpsError("not-found", "PURCHASE_NOT_FOUND");
        const purchase = snap.data();
        if (purchase.status === "paid") return { credits: purchase.credits, alreadyPaid: true };

        tx.set(db.collection("companies").doc(purchase.companyId), {
            eventCredits: FieldValue.increment(purchase.credits),
        }, { merge: true });
        tx.update(ref, {
            status: "paid",
            paidAt: FieldValue.serverTimestamp(),
            razorpayPaymentId: payment.id,
            paymentMethod: payment.method || null,
        });
        return { credits: purchase.credits };
    });
};

/** confirm with Razorpay → add credits. Shared by the verify callable and webhook. */
const settleCreditPurchase = async (ref, creds, paymentId) => {
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "PURCHASE_NOT_FOUND");
    const purchase = snap.data();
    if (purchase.status === "paid") return { credits: purchase.credits };
    const payment = await confirmPayment(creds, purchase, paymentId);
    return fulfillCreditPurchase(ref, payment);
};

exports.createCreditOrder = onCall(
    { region: PAYMENTS_REGION, secrets: RAZORPAY_SECRETS },
    async (request) => {
        const { auth, data } = request;
        const companyId = String((data && data.companyId) || "");
        await assertMember(auth, companyId);

        const credits = Number(data && data.credits);
        const price = CREDIT_PLANS[credits];
        if (!price) throw new HttpsError("invalid-argument", "UNKNOWN_PLAN");

        const creds = getPlatformCredentials();
        const ref = db.collection("creditPurchases").doc();
        const amountPaise = Math.round(price * 100);
        const baseAmount = round2(price / (1 + CREDIT_GST_RATE / 100));

        await ref.set({
            companyId,
            purchasedBy: auth.uid,
            credits,
            amount: price,
            amountPaise,
            currency: "INR",
            baseAmount,
            gstRate: CREDIT_GST_RATE,
            gstAmount: round2(price - baseAmount),
            status: "created",
            razorpayOrderId: null,
            createdAt: FieldValue.serverTimestamp(),
        });

        let rzpOrder;
        try {
            rzpOrder = await razorpayRequest(creds, "POST", "/orders", {
                amount: amountPaise,
                currency: "INR",
                receipt: `cr_${ref.id}`.slice(0, 40),
                notes: { type: "credits", companyId, purchaseId: ref.id, credits: String(credits) },
            });
        } catch (err) {
            logger.error("Razorpay order create failed (credits)", { purchase: ref.id, error: err.message });
            await ref.update({ status: "failed", lastError: err.message });
            throw new HttpsError("unavailable", "PAYMENT_INIT_FAILED");
        }

        await Promise.all([
            ref.update({ razorpayOrderId: rzpOrder.id }),
            // Lets the shared webhook find this purchase.
            db.collection("razorpayOrders").doc(rzpOrder.id).set({
                type: "credits",
                companyId,
                purchaseId: ref.id,
                createdAt: FieldValue.serverTimestamp(),
            }),
        ]);

        return {
            purchaseId: ref.id,
            razorpayOrderId: rzpOrder.id,
            keyId: creds.keyId,
            amount: amountPaise,
            currency: "INR",
        };
    }
);

exports.verifyCreditPayment = onCall(
    { region: PAYMENTS_REGION, secrets: RAZORPAY_SECRETS },
    async (request) => {
        const { auth, data } = request;
        if (!auth) throw new HttpsError("unauthenticated", "You must be logged in.");
        const {
            purchaseId,
            razorpay_order_id: rzpOrderId,
            razorpay_payment_id: rzpPaymentId,
            razorpay_signature: signature,
        } = data || {};
        if (!purchaseId || !rzpOrderId || !rzpPaymentId || !signature) {
            throw new HttpsError("invalid-argument", "Missing payment details.");
        }

        const ref = purchaseRef(purchaseId);
        const snap = await ref.get();
        if (!snap.exists) throw new HttpsError("not-found", "PURCHASE_NOT_FOUND");
        await assertMember(auth, snap.data().companyId);
        if (snap.data().razorpayOrderId !== rzpOrderId) {
            throw new HttpsError("permission-denied", "PAYMENT_ORDER_MISMATCH");
        }

        const creds = getPlatformCredentials();
        if (!hmacMatches(`${rzpOrderId}|${rzpPaymentId}`, signature, creds.keySecret)) {
            throw new HttpsError("permission-denied", "SIGNATURE_MISMATCH");
        }
        const result = await settleCreditPurchase(ref, creds, String(rzpPaymentId));
        return { credits: result.credits };
    }
);

module.exports.settleCreditPurchase = settleCreditPurchase;
module.exports.purchaseRef = purchaseRef;
module.exports.CREDIT_PLANS = CREDIT_PLANS;
