const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const {
    db, getPlatformCredentials, razorpayRequest, RAZORPAY_SECRETS, PAYMENTS_REGION,
} = require("./razorpayClient");
const { computeOrderPricing, computePlatformFee, computeDeductions, round2 } = require("./pricing");
const { loadFeeConfig } = require("./platformConfig");
const { adjustTiers, consumeAccessCode, releaseOrderHold, fulfillOrder } = require("./fulfillOrder");

const { FieldValue, Timestamp } = admin.firestore;

// How long seats stay held while the buyer is in the Razorpay window.
// The checkout modal itself times out sooner (see src/lib/razorpay.ts).
const HOLD_MINUTES = 15;
const DEFAULT_MAX_TICKETS_PER_ORDER = 10;

const PHONE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clip = (v, max) => String(v == null ? "" : v).trim().slice(0, max);

// Validates the buyer form the same way Checkout.tsx does and strips it down
// to plain strings before it's stored.
const cleanAttendees = (attendees, totalQty, customFields) => {
    if (!Array.isArray(attendees) || attendees.length !== totalQty) {
        throw new HttpsError("invalid-argument", "ATTENDEE_DETAILS_INCOMPLETE");
    }
    const fields = (customFields || []).filter((f) => f && f.label && String(f.label).trim());
    return attendees.map((a) => {
        const name = clip(a && a.name, 120);
        const email = clip(a && a.email, 200);
        const phone = clip(a && a.phone, 10);
        if (!name || !EMAIL_RE.test(email) || !PHONE_RE.test(phone)) {
            throw new HttpsError("invalid-argument", "ATTENDEE_DETAILS_INCOMPLETE");
        }
        const rawAnswers = (a && a.customAnswers) || {};
        const customAnswers = {};
        fields.forEach((f) => {
            const val = clip(rawAnswers[f.id], 2000);
            if (f.required && (f.type === "checkbox" ? val !== "true" : !val)) {
                throw new HttpsError("invalid-argument", "ATTENDEE_DETAILS_INCOMPLETE");
            }
            if (val) customAnswers[f.id] = val;
        });
        return { name, email, phone, customAnswers };
    });
};

/**
 * Step 1 of a gateway checkout. Prices the order on the server, holds the
 * seats, adds the platform fee (+ GST on it) and opens a Razorpay order on the
 * PLATFORM's account. Buyers aren't signed in, so this is deliberately
 * callable without auth. A ₹0 order (all-free tiers) is issued right away.
 */
exports.createRazorpayOrder = onCall(
    { region: PAYMENTS_REGION, secrets: RAZORPAY_SECRETS },
    async (request) => {
        const data = request.data || {};
        const companyId = clip(data.companyId, 128);
        const eventId = clip(data.eventId, 128);
        if (!companyId || !eventId) {
            throw new HttpsError("invalid-argument", "Missing event.");
        }

        const companyRef = db.collection("companies").doc(companyId);
        const eventRef = companyRef.collection("events").doc(eventId);
        const [eventSnap, settingsSnap, profileSnap, payoutSnap, feeConfig] = await Promise.all([
            eventRef.get(),
            companyRef.collection("settings").doc("general").get(),
            companyRef.collection("business_info").doc("profile").get(),
            db.collection("payoutAccounts").doc(companyId).get(),
            loadFeeConfig(companyId, eventId),
        ]);
        if (!eventSnap.exists) throw new HttpsError("not-found", "EVENT_NOT_FOUND");
        const event = eventSnap.data();
        const settings = settingsSnap.exists ? settingsSnap.data() : {};

        if (event.status !== "published") {
            throw new HttpsError("failed-precondition", "EVENT_NOT_AVAILABLE");
        }
        if (event.registrationMode === "rsvp" || event.paymentCollectionMode !== "gateway") {
            throw new HttpsError("failed-precondition", "GATEWAY_NOT_ENABLED");
        }

        const quantities = data.quantities && typeof data.quantities === "object" ? data.quantities : {};
        const pricing = computeOrderPricing(event.tiers, quantities, settings);
        if (pricing.totalQty === 0) throw new HttpsError("invalid-argument", "NO_TICKETS");

        const maxPerOrder = typeof event.maxTicketsPerOrder === "number" ?
            event.maxTicketsPerOrder : DEFAULT_MAX_TICKETS_PER_ORDER;
        if (pricing.totalQty > maxPerOrder) {
            throw new HttpsError("invalid-argument", "TOO_MANY_TICKETS");
        }

        const attendees = cleanAttendees(data.attendees, pricing.totalQty, event.customFields);
        const needsPayment = pricing.amountPaise > 0;

        // Money lands in the platform's account, so the platform must have the
        // gateway switched on and know where to pay this organizer out to.
        if (needsPayment && !feeConfig.gatewayEnabled) {
            throw new HttpsError("failed-precondition", "GATEWAY_NOT_CONFIGURED");
        }
        if (needsPayment && !payoutSnap.exists) {
            throw new HttpsError("failed-precondition", "PAYOUT_ACCOUNT_MISSING");
        }

        // Buyer pays tickets + platform fee + GST on the fee.
        const { perTicketFee, platformFee, platformFeeGst } = computePlatformFee(pricing.lineItems, feeConfig);
        const ticketsTotal = pricing.total;
        const buyerTotal = round2(ticketsTotal + platformFee + platformFeeGst);
        const amountPaise = Math.round(buyerTotal * 100);
        if (needsPayment && amountPaise < 100) {
            throw new HttpsError("invalid-argument", "AMOUNT_TOO_SMALL"); // Razorpay minimum is ₹1
        }

        // TCS (sec 52) only applies when the organizer is GST-registered.
        const organizerGstin = profileSnap.exists ? String(profileSnap.data().gstinNumber || "").trim() : "";
        const deductions = needsPayment ?
            computeDeductions(pricing.lineItems, ticketsTotal, feeConfig, !!organizerGstin) :
            { taxableValue: 0, tcs: 0, tds: 0, organizerNet: 0 };
        const creds = needsPayment ? getPlatformCredentials() : null;

        const accessCode = data.accessCode ? clip(data.accessCode, 64) : null;
        const items = pricing.lineItems.map(({ itemTotal, ...rest }) => ({
            ...rest,
            unitPlatformFee: perTicketFee[rest.tierId].fee,
            unitPlatformFeeGst: perTicketFee[rest.tierId].gst,
        }));
        const orderRef = eventRef.collection("orders").doc();
        const usedAtIso = new Date().toISOString();

        // Hold seats + consume the access code atomically with creating the order.
        await db.runTransaction(async (tx) => {
            const fresh = await tx.get(eventRef);
            if (!fresh.exists) throw new HttpsError("not-found", "EVENT_NOT_FOUND");
            const current = fresh.data();
            const eventUpdate = { tiers: adjustTiers(current.tiers || [], items, +1) };
            const codes = consumeAccessCode(current.accessCodes, accessCode, pricing.totalQty, usedAtIso);
            if (codes) eventUpdate.accessCodes = codes;
            tx.update(eventRef, eventUpdate);

            tx.set(orderRef, {
                status: "created",
                holdActive: true,
                companyId,
                eventId,
                eventTitle: event.title || "",
                items,
                attendees,
                ticketsTotal,
                platformFee,
                platformFeeGst,
                total: buyerTotal,
                amountPaise,
                feeSnapshot: {
                    percent: feeConfig.percent,
                    fixedPerTicket: feeConfig.fixedPerTicket,
                    feeGstRate: feeConfig.feeGstRate,
                    tcsPercent: feeConfig.tcsPercent,
                    tdsPercent: feeConfig.tdsPercent,
                },
                organizerGstin: organizerGstin || null,
                taxableValue: deductions.taxableValue,
                tcsAmount: deductions.tcs,
                tdsAmount: deductions.tds,
                organizerNet: deductions.organizerNet,
                currency: "INR",
                taxRate: pricing.taxRate,
                taxTypeLabel: pricing.taxTypeLabel,
                accessCode: codes ? accessCode : null,
                accessCodeUsedAt: codes ? usedAtIso : null,
                razorpayOrderId: null,
                createdAt: FieldValue.serverTimestamp(),
                expiresAt: Timestamp.fromMillis(Date.now() + HOLD_MINUTES * 60 * 1000),
            });
        });

        if (!needsPayment) {
            const { tickets } = await fulfillOrder(orderRef, null);
            return { free: true, orderId: orderRef.id, tickets };
        }

        let rzpOrder;
        try {
            rzpOrder = await razorpayRequest(creds, "POST", "/orders", {
                amount: amountPaise,
                currency: "INR",
                receipt: orderRef.id,
                notes: { companyId, eventId, orderId: orderRef.id },
            });
        } catch (err) {
            logger.error("Razorpay order create failed", { order: orderRef.path, error: err.message });
            await releaseOrderHold(orderRef, "failed");
            throw new HttpsError("unavailable", "PAYMENT_INIT_FAILED");
        }

        await Promise.all([
            orderRef.update({ razorpayOrderId: rzpOrder.id }),
            // Lets the webhook find our order from just Razorpay's order id.
            db.collection("razorpayOrders").doc(rzpOrder.id).set({
                companyId,
                eventId,
                orderId: orderRef.id,
                createdAt: FieldValue.serverTimestamp(),
            }),
        ]);

        return {
            free: false,
            orderId: orderRef.id,
            razorpayOrderId: rzpOrder.id,
            keyId: creds.keyId,
            amount: amountPaise,
            currency: "INR",
            total: buyerTotal,
            ticketsTotal,
            platformFee,
            platformFeeGst,
        };
    }
);
