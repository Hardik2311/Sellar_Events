const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { db, PAYMENTS_REGION } = require("./razorpayClient");
const { isSuperAdminUid } = require("./platformConfig");

const { FieldValue, Timestamp } = admin.firestore;

const METHODS = ["bank_transfer", "upi", "cash", "other"];

/**
 * Super Admin → Payouts → "Record payout". Logs a manual transfer to an
 * organizer and reduces what the platform owes them, atomically.
 * Negative amounts are allowed as adjustments (e.g. a refund handled offline).
 */
exports.recordPayout = onCall({ region: PAYMENTS_REGION }, async (request) => {
    const { auth, data } = request;
    if (!auth || !isSuperAdminUid(auth.uid)) {
        throw new HttpsError("permission-denied", "Only super admins can record payouts.");
    }
    const companyId = String((data && data.companyId) || "").trim();
    const amount = Number(data && data.amount);
    const method = METHODS.includes(data && data.method) ? data.method : "other";
    const reference = String((data && data.reference) || "").trim().slice(0, 120);
    const note = String((data && data.note) || "").trim().slice(0, 500);
    const eventId = data && data.eventId ? String(data.eventId).trim() : null;
    const paidAtMs = data && data.paidAt ? Date.parse(data.paidAt) : Date.now();

    if (!companyId) throw new HttpsError("invalid-argument", "Missing company.");
    if (!Number.isFinite(amount) || amount === 0) {
        throw new HttpsError("invalid-argument", "Enter a non-zero amount.");
    }
    if (amount > 0 && !reference) {
        throw new HttpsError("invalid-argument", "Enter the bank / UPI reference (UTR) for this payout.");
    }
    if (!Number.isFinite(paidAtMs)) throw new HttpsError("invalid-argument", "Invalid payout date.");

    const ledgerRef = db.collection("payoutLedger").doc(companyId);
    const payoutRef = db.collection("payouts").doc();
    const rounded = Number(amount.toFixed(2));

    await db.runTransaction(async (tx) => {
        const ledger = await tx.get(ledgerRef);
        if (!ledger.exists) throw new HttpsError("not-found", "This organizer has no online sales yet.");
        tx.set(payoutRef, {
            companyId,
            eventId,
            amount: rounded,
            method,
            reference,
            note,
            paidAt: Timestamp.fromMillis(paidAtMs),
            createdBy: auth.uid,
            createdAt: FieldValue.serverTimestamp(),
        });
        tx.update(ledgerRef, {
            paidOut: FieldValue.increment(rounded),
            lastPayoutAt: Timestamp.fromMillis(paidAtMs),
            updatedAt: FieldValue.serverTimestamp(),
        });
    });

    return { success: true, payoutId: payoutRef.id };
});
