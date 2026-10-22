const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { db, PAYMENTS_REGION } = require("./razorpayClient");
const { releaseOrderHold } = require("./fulfillOrder");

/**
 * Gives seats back for gateway orders the buyer never paid for (closed the
 * Razorpay window, payment failed, abandoned the tab). Needs the composite
 * collection-group index on orders(holdActive, expiresAt) — firestore.indexes.json.
 */
exports.releaseExpiredOrders = onSchedule(
    { schedule: "every 5 minutes", region: PAYMENTS_REGION },
    async () => {
        const snap = await db.collectionGroup("orders")
            .where("holdActive", "==", true)
            .where("expiresAt", "<=", admin.firestore.Timestamp.now())
            .limit(200)
            .get();

        const results = await Promise.allSettled(
            snap.docs.map((d) => releaseOrderHold(d.ref, "expired"))
        );
        const failed = results.filter((r) => r.status === "rejected");
        if (failed.length) {
            logger.error("Some expired orders could not be released", {
                failed: failed.length,
                reasons: failed.slice(0, 5).map((f) => String(f.reason && f.reason.message)),
            });
        }
        if (snap.size) logger.info(`Released ${snap.size - failed.length} expired order hold(s).`);
    }
);
