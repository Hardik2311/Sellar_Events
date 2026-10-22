const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { hmacMatches } = require("./crypto");
const { db, getPlatformCredentials, RAZORPAY_SECRETS, PAYMENTS_REGION } = require("./razorpayClient");
const { orderRefFor, settlePaidOrder } = require("./fulfillOrder");
const { settleCreditPurchase, purchaseRef } = require("./creditPurchases");

const PAID_EVENTS = new Set(["payment.captured", "payment.authorized", "order.paid"]);

/**
 * Backup path for issuing tickets: the buyer may pay and close the tab before
 * verifyRazorpayPayment runs. Configure ONE webhook on the platform's Razorpay
 * account (events payment.captured, payment.failed, order.paid):
 *   https://asia-south1-<project>.cloudfunctions.net/razorpayWebhook
 * with the same secret as the RAZORPAY_WEBHOOK_SECRET function secret.
 */
exports.razorpayWebhook = onRequest(
    { region: PAYMENTS_REGION, secrets: RAZORPAY_SECRETS },
    async (req, res) => {
        if (req.method !== "POST") {
            res.status(405).send("Method not allowed");
            return;
        }

        let creds;
        try {
            creds = getPlatformCredentials();
        } catch (err) {
            res.status(503).send("Gateway not configured");
            return;
        }
        if (!hmacMatches(req.rawBody, req.get("x-razorpay-signature"), creds.webhookSecret)) {
            logger.warn("Razorpay webhook signature mismatch");
            res.status(400).send("Invalid signature");
            return;
        }

        const body = req.body || {};
        const payload = body.payload || {};
        const payment = payload.payment && payload.payment.entity;
        const order = payload.order && payload.order.entity;
        const rzpOrderId = (payment && payment.order_id) || (order && order.id);
        if (!rzpOrderId) {
            res.status(200).send("ignored");
            return;
        }

        const lookup = await db.collection("razorpayOrders").doc(rzpOrderId).get();
        if (!lookup.exists) {
            // Not a ticket order created by this app (e.g. other uses of the account).
            res.status(200).send("ignored");
            return;
        }
        const { type, companyId, eventId, orderId, purchaseId } = lookup.data();
        // Event-credit purchases (Account → Recharge) vs ticket orders.
        const isCredits = type === "credits";
        const orderRef = isCredits ? purchaseRef(purchaseId) : orderRefFor(companyId, eventId, orderId);

        try {
            if (PAID_EVENTS.has(body.event) && payment) {
                if (isCredits) await settleCreditPurchase(orderRef, creds, payment.id);
                else await settlePaidOrder(orderRef, creds, payment.id);
            } else if (body.event === "payment.failed" && payment) {
                await orderRef.update({
                    lastFailedPaymentId: payment.id,
                    lastPaymentError: payment.error_description || payment.error_reason || "failed",
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            res.status(200).send("ok");
        } catch (err) {
            // Non-2xx makes Razorpay retry later; fulfilment is idempotent.
            logger.error("Razorpay webhook handling failed", {
                event: body.event, order: orderRef.path, error: err.message,
            });
            res.status(500).send("error");
        }
    }
);
