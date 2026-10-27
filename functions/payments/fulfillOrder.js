const { HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { db, razorpayRequest } = require("./razorpayClient");
const {
    getEventInitials,
    assignBookingGroups,
    nextTicketNumbers,
    formatTicketId,
    soldOf,
    stripHtmlTags,
} = require("./ticketing");

const { FieldValue } = admin.firestore;

// Order lifecycle (companies/{cid}/events/{eid}/orders/{orderId}):
//   created ──pay──► paid
//      │                ▲  (payment lands after expiry and seats are still free)
//      └─15 min─► expired ──► paid | refund_required ──► refunded
// `holdActive` = seats are counted in tiers[].sold but no tickets exist yet.

const orderRefFor = (companyId, eventId, orderId) =>
    db.collection("companies").doc(companyId).collection("events").doc(eventId).collection("orders").doc(orderId);

/**
 * +1: take seats for `items` (throws SOLD_OUT when short). -1: give them back.
 * Tiers that were since deleted are skipped on release.
 */
const adjustTiers = (tiers, items, direction) => {
    if (direction > 0) {
        items.forEach((item) => {
            if (!tiers.some((t) => t.id === item.tierId)) {
                throw new HttpsError("failed-precondition", "TIER_UNAVAILABLE");
            }
        });
    }
    return tiers.map((tier) => {
        const item = items.find((i) => i.tierId === tier.id);
        if (!item) return tier;
        const sold = soldOf(tier);
        if (direction > 0) {
            if (item.qty > (Number(tier.quantity) || 0) - sold) {
                throw new HttpsError("resource-exhausted", "SOLD_OUT", { tierName: tier.name });
            }
            return { ...tier, sold: sold + item.qty };
        }
        return { ...tier, sold: Math.max(0, sold - item.qty) };
    });
};

/**
 * Same single-use access-code rules as the client checkout transaction.
 * Returns the updated accessCodes array, or null when there's nothing to change.
 */
const consumeAccessCode = (accessCodes, code, totalQty, usedAtIso) => {
    if (!code) return null;
    const cleaned = String(code).trim().toUpperCase();
    const index = (accessCodes || []).findIndex((e) => String(e.code).trim().toUpperCase() === cleaned);
    if (index === -1) return null;
    const entry = accessCodes[index];
    if (entry.usedAt) throw new HttpsError("failed-precondition", "CODE_ALREADY_USED");
    if (entry.maxTickets && totalQty > entry.maxTickets) {
        throw new HttpsError("failed-precondition", "CODE_LIMIT_REACHED");
    }
    if (entry.expiresAt && new Date(entry.expiresAt).getTime() < Date.now()) {
        throw new HttpsError("failed-precondition", "CODE_EXPIRED");
    }
    return accessCodes.map((e, i) => (i === index ? { ...e, usedCount: totalQty, usedAt: usedAtIso } : e));
};

// Undo consumeAccessCode — only if the code is still marked used by THIS order.
const restoreAccessCode = (accessCodes, code, usedAtIso) => {
    if (!code || !usedAtIso) return null;
    const cleaned = String(code).trim().toUpperCase();
    let changed = false;
    const next = (accessCodes || []).map((e) => {
        if (String(e.code).trim().toUpperCase() === cleaned && e.usedAt === usedAtIso) {
            changed = true;
            return { ...e, usedAt: null, usedCount: 0 };
        }
        return e;
    });
    return changed ? next : null;
};

/**
 * Gives an unpaid order's held seats (and access code) back.
 * No-op if the order was already paid or released.
 */
const releaseOrderHold = async (orderRef, newStatus) => {
    const eventRef = orderRef.parent.parent;
    await db.runTransaction(async (tx) => {
        const [orderSnap, eventSnap] = await Promise.all([tx.get(orderRef), tx.get(eventRef)]);
        if (!orderSnap.exists) return;
        const order = orderSnap.data();
        if (!order.holdActive || order.status === "paid") return;

        const update = { holdActive: false, status: newStatus, releasedAt: FieldValue.serverTimestamp() };
        if (eventSnap.exists) {
            const event = eventSnap.data();
            const eventUpdate = { tiers: adjustTiers(event.tiers || [], order.items, -1) };
            const codes = restoreAccessCode(event.accessCodes, order.accessCode, order.accessCodeUsedAt);
            if (codes) eventUpdate.accessCodes = codes;
            tx.update(eventRef, eventUpdate);
        }
        tx.update(orderRef, update);
    });
};

const PAYMENT_MODE_BY_METHOD = {
    upi: "UPI",
    card: "Card",
    netbanking: "Netbanking",
};

/**
 * Issues the tickets for an order — the ONLY place gateway attendees are
 * created. Idempotent: the verify callable and the webhook can both call it
 * for the same payment; the second call just returns the stored tickets.
 * @param {FirebaseFirestore.DocumentReference} orderRef
 * @param {Object|null} payment Razorpay payment entity, or null for a ₹0 order
 * @return {Promise<{tickets: Array, refundRequired?: boolean}>}
 */
const fulfillOrder = async (orderRef, payment) => {
    const eventRef = orderRef.parent.parent;
    return db.runTransaction(async (tx) => {
        const [orderSnap, eventSnap] = await Promise.all([tx.get(orderRef), tx.get(eventRef)]);
        if (!orderSnap.exists) throw new HttpsError("not-found", "ORDER_NOT_FOUND");
        const order = orderSnap.data();

        if (order.status === "paid") return { tickets: order.tickets || [] };
        if (order.status === "refund_required" || order.status === "refunded") {
            return { tickets: [], refundRequired: true };
        }
        if (!eventSnap.exists) throw new HttpsError("not-found", "EVENT_NOT_FOUND");
        const event = eventSnap.data();

        // Payment arrived after the hold expired → try to take the seats again.
        // (The access code isn't re-consumed here — rare edge, seats matter more.)
        let tiers = event.tiers || [];
        let tiersChanged = false;
        if (!order.holdActive) {
            try {
                tiers = adjustTiers(tiers, order.items, +1);
                tiersChanged = true;
            } catch (err) {
                if (err.message !== "SOLD_OUT" && err.message !== "TIER_UNAVAILABLE") throw err;
                tx.update(orderRef, {
                    status: "refund_required",
                    razorpayPaymentId: payment ? payment.id : null,
                    updatedAt: FieldValue.serverTimestamp(),
                });
                return { tickets: [], refundRequired: true };
            }
        }

        // One slot per ticket, in tier order — same order as the buyer's form.
        const slots = [];
        order.items.forEach((item) => {
            for (let i = 0; i < item.qty; i++) slots.push(item);
        });

        const attendeesCol = eventRef.collection("attendees");
        const refs = slots.map(() => attendeesCol.doc());
        const people = slots.map((_, i) => order.attendees[i] || { name: "", email: "", phone: "", customAnswers: {} });
        const groups = assignBookingGroups(people.map((p) => p.name), refs.map((r) => r.id));
        const { numbers, ticketSeq } = nextTicketNumbers({ tiers: event.tiers, ticketSeq: event.ticketSeq }, slots.length);
        const initials = getEventInitials(event.title);
        const paymentMode = payment ? (PAYMENT_MODE_BY_METHOD[payment.method] || "Other") : "Free";
        const now = FieldValue.serverTimestamp();

        const tickets = slots.map((item, i) => {
            const person = people[i];
            const ticketId = formatTicketId(initials, numbers[i]);
            tx.set(refs[i], {
                name: person.name,
                email: person.email,
                phone: person.phone,
                tierName: item.tierName,
                customFieldAnswers: person.customAnswers || {},
                ticketTierId: item.tierId,
                amountPaid: item.unitTotal,
                tierPrice: item.tierPrice,
                baseAmount: item.unitBase,
                taxAmount: item.unitTax,
                taxRate: order.taxRate,
                taxType: order.taxTypeLabel,
                ticketId,
                status: "valid",
                checkedInAt: null,
                createdAt: now,
                purchasedAt: now,
                paymentMode,
                paymentMethod: "gateway",
                accessCode: order.accessCode || null,
                bookingGroupId: groups[i],
                orderId: orderRef.id,
                razorpayOrderId: order.razorpayOrderId || null,
                razorpayPaymentId: payment ? payment.id : null,
                // Platform fee for this ticket, deducted from the organizer's
                // payout (not charged to the buyer — amountPaid above is the
                // ticket amount only).
                platformFee: item.unitPlatformFee || 0,
                platformFeeGst: item.unitPlatformFeeGst || 0,
            });
            return {
                ticketId,
                tierName: item.tierName,
                attendeeName: person.name,
                accessCode: order.accessCode || undefined,
                attendeeEmail: person.email,
                attendeePhone: person.phone,
                amountPaid: item.unitTotal,
                paymentMode,
                purchasedAt: Date.now(),
                status: "valid",
                bookingGroupId: groups[i],
            };
        });

        tx.update(eventRef, tiersChanged ? { tiers, ticketSeq } : { ticketSeq });

        // What the platform now owes this organizer (paid out manually from
        // Super Admin → Payouts). Runs once per order thanks to the `paid` check.
        if (payment) {
            const inc = FieldValue.increment;
            const amounts = {
                ticketsGross: inc(order.ticketsTotal || 0),
                taxableValue: inc(order.taxableValue || 0),
                platformFee: inc(order.platformFee || 0),
                platformFeeGst: inc(order.platformFeeGst || 0),
                tcs: inc(order.tcsAmount || 0),
                tds: inc(order.tdsAmount || 0),
                netPayable: inc(order.organizerNet || 0),
                orders: inc(1),
                tickets: inc(slots.length),
                updatedAt: now,
            };
            const ledgerRef = db.collection("payoutLedger").doc(order.companyId);
            tx.set(ledgerRef, { companyId: order.companyId, ...amounts }, { merge: true });
            tx.set(ledgerRef.collection("events").doc(order.eventId), {
                eventId: order.eventId,
                eventTitle: stripHtmlTags(event.title || order.eventTitle || ""),
                ...amounts,
            }, { merge: true });
        }
        tx.update(orderRef, {
            status: "paid",
            holdActive: false,
            paidAt: now,
            razorpayPaymentId: payment ? payment.id : null,
            paymentMode,
            attendeeIds: refs.map((r) => r.id),
            tickets: JSON.parse(JSON.stringify(tickets)), // drop undefined fields
            updatedAt: now,
        });
        return { tickets };
    });
};

/**
 * Fetches the payment from Razorpay and checks it really belongs to this
 * order (any doc with `razorpayOrderId` + `amountPaise` — ticket orders and
 * credit purchases) and covers the full amount. Captures it if the Razorpay
 * account uses manual capture.
 */
const confirmPayment = async (creds, order, paymentId) => {
    let payment = await razorpayRequest(creds, "GET", `/payments/${encodeURIComponent(paymentId)}`);
    if (payment.order_id !== order.razorpayOrderId) {
        throw new HttpsError("permission-denied", "PAYMENT_ORDER_MISMATCH");
    }
    if (payment.amount !== order.amountPaise || payment.currency !== "INR") {
        throw new HttpsError("permission-denied", "PAYMENT_AMOUNT_MISMATCH");
    }
    if (payment.status === "authorized") {
        payment = await razorpayRequest(creds, "POST", `/payments/${encodeURIComponent(paymentId)}/capture`, {
            amount: order.amountPaise,
            currency: "INR",
        });
    }
    if (payment.status !== "captured") {
        throw new HttpsError("failed-precondition", "PAYMENT_NOT_COMPLETED");
    }
    return payment;
};

/**
 * confirm → fulfil → (refund if the event sold out while the hold had lapsed).
 * Shared by verifyRazorpayPayment and the webhook.
 */
const settlePaidOrder = async (orderRef, creds, paymentId) => {
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) throw new HttpsError("not-found", "ORDER_NOT_FOUND");
    const order = orderSnap.data();
    if (order.status === "paid") return { tickets: order.tickets || [] };

    const payment = await confirmPayment(creds, order, paymentId);
    const result = await fulfillOrder(orderRef, payment);
    if (!result.refundRequired) return result;

    const latest = (await orderRef.get()).data();
    if (latest.status === "refund_required") {
        try {
            const refund = await razorpayRequest(creds, "POST", `/payments/${encodeURIComponent(payment.id)}/refund`, {
                amount: order.amountPaise,
                speed: "normal",
                notes: { reason: "Sold out before payment completed", orderId: orderRef.id },
            });
            await orderRef.update({
                status: "refunded",
                refundId: refund.id,
                updatedAt: FieldValue.serverTimestamp(),
            });
        } catch (err) {
            logger.error("Auto-refund failed — organizer must refund manually", {
                order: orderRef.path, paymentId: payment.id, error: err.message,
            });
            await orderRef.update({ lastError: `Refund failed: ${err.message}` });
        }
    }
    return result;
};

module.exports = {
    confirmPayment,
    orderRefFor,
    adjustTiers,
    consumeAccessCode,
    releaseOrderHold,
    fulfillOrder,
    settlePaidOrder,
};
