const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { hmacMatches } = require("./crypto");
const { getPlatformCredentials, RAZORPAY_SECRETS, PAYMENTS_REGION } = require("./razorpayClient");
const { orderRefFor, settlePaidOrder } = require("./fulfillOrder");

/**
 * Step 2 of a gateway checkout — called from the Razorpay modal's success
 * handler. Checks Razorpay's signature, confirms the payment with Razorpay,
 * then issues the tickets and returns them for the confirmation screen.
 */
exports.verifyRazorpayPayment = onCall(
    { region: PAYMENTS_REGION, secrets: RAZORPAY_SECRETS },
    async (request) => {
        const data = request.data || {};
        const {
            companyId,
            eventId,
            orderId,
            razorpay_order_id: rzpOrderId,
            razorpay_payment_id: rzpPaymentId,
            razorpay_signature: signature,
        } = data;
        if (!companyId || !eventId || !orderId || !rzpOrderId || !rzpPaymentId || !signature) {
            throw new HttpsError("invalid-argument", "Missing payment details.");
        }

        const orderRef = orderRefFor(String(companyId), String(eventId), String(orderId));
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) throw new HttpsError("not-found", "ORDER_NOT_FOUND");
        if (orderSnap.data().razorpayOrderId !== rzpOrderId) {
            throw new HttpsError("permission-denied", "PAYMENT_ORDER_MISMATCH");
        }

        const creds = getPlatformCredentials();
        if (!hmacMatches(`${rzpOrderId}|${rzpPaymentId}`, signature, creds.keySecret)) {
            throw new HttpsError("permission-denied", "SIGNATURE_MISMATCH");
        }

        const result = await settlePaidOrder(orderRef, creds, String(rzpPaymentId));
        if (result.refundRequired) {
            throw new HttpsError("resource-exhausted", "SOLD_OUT_REFUNDED");
        }
        return { tickets: result.tickets };
    }
);
