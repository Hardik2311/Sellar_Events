const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const QRCode = require("qrcode");
const { db } = require("../payments/razorpayClient");
const { buildTicketPdf } = require("./ticketPdf");
const {
    MAIL_SECRETS,
    SENDER_NAME,
    getTransport,
    resetTransport,
    senderAddress,
    str,
    normEmail,
    isEmail,
    isQuotaError,
    buildEmail,
} = require("./mailer");

const { FieldValue } = admin.firestore;

// Firestore triggers must run where the database lives (firebase.json).
const FIRESTORE_REGION = "asia-south2";
// A free booking is written by the browser, so cap what one can make us send.
const MAX_FREE_TICKETS = 20;

// Booking lifecycle for one email run
// (companies/{cid}/events/{eid}/ticketEmails/{orderId | bookingId}):
//   sending ──► sent | partial | failed | skipped
// The doc is created first as a lock: every ticket in a booking fires this
// trigger, but only the first create() wins, so the buyer gets one email.

const toMillis = (v) => (v && typeof v.toMillis === "function" ? v.toMillis() : typeof v === "number" ? v : Date.now());
const ticketNumber = (id) => {
    const m = str(id).match(/(\d+)$/);
    return m ? Number(m[1]) : 0;
};

// Server copy of toPasses in src/lib/ticketPasses.ts — keep in sync.
// Same-name tickets in one order collapse into one pass (lead ticket's QR).
const toPasses = (tickets) => {
    const groups = new Map();
    tickets.forEach((t) => {
        const key = t.bookingGroupId || t.ticketId;
        groups.set(key, [...(groups.get(key) || []), t]);
    });
    return Array.from(groups.values()).map((members) => {
        const lead = members[0];
        if (members.length === 1) return { ...lead, admits: 1, members };
        const tierCounts = new Map();
        members.forEach((m) => tierCounts.set(m.tierName, (tierCounts.get(m.tierName) || 0) + 1));
        return {
            ...lead,
            tierName: Array.from(tierCounts.entries()).map(([name, n]) => `${name} × ${n}`).join(" + "),
            amountPaid: members.reduce((sum, m) => sum + (m.amountPaid || 0), 0),
            admits: members.length,
            members,
        };
    });
};

const pdfEventData = (ev) => ({
    eventTitle: ev.title,
    eventCategory: ev.category,
    eventDate: typeof ev.date === "string" ? ev.date : "",
    eventTime: ev.time,
    eventVenue: ev.venue,
    eventConsentText: ev.consentText,
    eventGoodToKnowText: ev.goodToKnowText,
    eventIsOnline: !!ev.isOnline,
    eventArriveBy: ev.arriveByTime,
    eventAgeLimit: ev.ageLimit,
    eventHelplineNumber: ev.helplineNumber,
});

/**
 * Why a booking must not be emailed, or null when it's fine. Gateway orders
 * must really be paid; browser-written free bookings must really be free.
 */
const skipReason = async (eventRef, event, key, isOrder, tickets) => {
    if (isOrder) {
        const order = await eventRef.collection("orders").doc(key).get();
        return order.exists && order.get("status") === "paid" ? null : "ORDER_NOT_PAID";
    }
    if (tickets.length > MAX_FREE_TICKETS) return "TOO_MANY_TICKETS";
    const freeTierIds = new Set((event.tiers || []).filter((t) => Number(t.price) === 0).map((t) => t.id));
    const allFree = tickets.every((t) => t.amountPaid === 0 && freeTierIds.has(t.tierId));
    return allFree ? null : "NOT_A_FREE_BOOKING";
};

/** Builds and sends one recipient's email; returns the nodemailer info. */
const sendToRecipient = async (to, tickets, event) => {
    const evData = pdfEventData(event);
    const passes = toPasses(tickets);
    const attachments = [];
    const qrs = [];
    for (let i = 0; i < passes.length; i++) {
        const p = passes[i];
        attachments.push({
            filename: `${p.ticketId}-ticket.pdf`.replace(/[^\w.\- ]/g, "_"),
            content: buildTicketPdf({ ...p, ticketIds: p.members.map((m) => m.ticketId) }, evData),
            contentType: "application/pdf",
        });
        const cid = `qr-${i}@outsold`;
        attachments.push({
            filename: `${p.ticketId}-qr.png`.replace(/[^\w.\- ]/g, "_"),
            content: await QRCode.toBuffer(p.ticketId, { errorCorrectionLevel: "M", width: 360, margin: 2 }),
            contentType: "image/png",
            cid,
        });
        qrs.push({ cid, ticketId: p.ticketId, label: p.admits > 1 ? `${p.tierName} · admits ${p.admits}` : p.tierName });
    }

    const { subject, text, html } = buildEmail({
        name: tickets[0].attendeeName,
        event,
        ticketIds: tickets.map((t) => t.ticketId),
        qrs,
    });
    const from = senderAddress();
    return getTransport().sendMail({
        from: { name: SENDER_NAME, address: from },
        replyTo: from,
        to,
        subject,
        text,
        html,
        attachments,
    });
};

const markTickets = async (tickets, ticketEmail) => {
    const batch = db.batch();
    tickets.forEach((t) => batch.update(t.ref, { ticketEmail }));
    await batch.commit();
};

/**
 * Emails buyers their tickets (PDF + inline QR) right after an online booking:
 * Razorpay / ₹0 gateway orders (fulfillOrder.js, `orderId`) and free bookings
 * from Checkout.tsx (`bookingId`). Walk-ins and manual-QR tickets are skipped.
 * Results land on each attendee's `ticketEmail`, same as Super Admin → Send
 * Tickets, so failed ones can be resent from there.
 */
exports.autoSendTicketEmail = onDocumentCreated({
    document: "companies/{companyId}/events/{eventId}/attendees/{attendeeId}",
    region: FIRESTORE_REGION,
    secrets: MAIL_SECRETS,
    memory: "512MiB",
    timeoutSeconds: 120,
}, async (fsEvent) => {
    const snap = fsEvent.data;
    if (!snap) return;
    const created = snap.data();
    if (created.paymentMethod !== "gateway" || created.isWalkIn || created.status === "cancelled") return;
    const isOrder = !!str(created.orderId);
    const key = str(created.orderId) || str(created.bookingId);
    if (!key) return;

    const eventRef = snap.ref.parent.parent;
    const claimRef = eventRef.collection("ticketEmails").doc(key);
    try {
        await claimRef.create({
            status: "sending",
            source: isOrder ? "order" : "free",
            createdAt: FieldValue.serverTimestamp(),
        });
    } catch (err) {
        if (err.code === 6) return; // ALREADY_EXISTS — another ticket of this booking is handling it
        throw err;
    }

    try {
        const [eventSnap, attendeeSnap] = await Promise.all([
            eventRef.get(),
            eventRef.collection("attendees").where(isOrder ? "orderId" : "bookingId", "==", key).get(),
        ]);
        if (!eventSnap.exists) {
            await claimRef.update({ status: "skipped", reason: "EVENT_NOT_FOUND" });
            return;
        }
        const event = eventSnap.data();
        const tickets = attendeeSnap.docs
            .map((d) => {
                const a = d.data();
                return {
                    ref: d.ref,
                    status: a.status,
                    ticketId: str(a.ticketId),
                    tierId: a.ticketTierId,
                    tierName: str(a.tierName),
                    attendeeName: str(a.name),
                    attendeeEmail: str(a.email),
                    attendeePhone: str(a.phone),
                    amountPaid: Number(a.amountPaid) || 0,
                    paymentMode: str(a.paymentMode),
                    purchasedAt: toMillis(a.purchasedAt || a.createdAt),
                    bookingGroupId: a.bookingGroupId || null,
                };
            })
            .filter((t) => t.status !== "cancelled" && t.ticketId)
            .sort((a, b) => ticketNumber(a.ticketId) - ticketNumber(b.ticketId));

        const reason = tickets.length ? await skipReason(eventRef, event, key, isOrder, tickets) : "NO_TICKETS";
        if (reason) {
            logger.warn("Ticket email skipped", { booking: claimRef.path, reason });
            await claimRef.update({ status: "skipped", reason });
            return;
        }

        // One email per buyer address, holding all of that buyer's tickets.
        const byEmail = new Map();
        tickets.forEach((t) => {
            const email = normEmail(t.attendeeEmail);
            if (!isEmail(email)) return;
            byEmail.set(email, [...(byEmail.get(email) || []), t]);
        });

        const sent = [];
        const failed = [];
        let quotaHit = false;
        for (const [to, group] of byEmail) {
            if (quotaHit) {
                failed.push(to);
                await markTickets(group, {
                    status: "failed", error: "Gmail daily limit reached", failedAt: FieldValue.serverTimestamp(), auto: true,
                });
                continue;
            }
            try {
                const info = await sendToRecipient(to, group, event);
                sent.push(to);
                await markTickets(group, {
                    status: "sent",
                    sentAt: FieldValue.serverTimestamp(),
                    messageId: str(info && info.messageId),
                    to,
                    auto: true,
                });
            } catch (err) {
                failed.push(to);
                if (Number(err && err.responseCode) === 535) resetTransport();
                if (isQuotaError(err)) quotaHit = true;
                const message = str(err && (err.response || err.message)).slice(0, 300) || "Send failed";
                logger.error("Ticket email failed", { booking: claimRef.path, to, error: message });
                await markTickets(group, {
                    status: "failed", error: message, failedAt: FieldValue.serverTimestamp(), auto: true,
                });
            }
        }

        await claimRef.update({
            status: failed.length === 0 ? (sent.length ? "sent" : "skipped") : sent.length ? "partial" : "failed",
            ...(sent.length || failed.length ? {} : { reason: "NO_VALID_EMAIL" }),
            sentTo: sent,
            failedTo: failed,
            finishedAt: FieldValue.serverTimestamp(),
        });
    } catch (err) {
        logger.error("Ticket email run crashed", { booking: claimRef.path, error: err.message });
        await claimRef.update({ status: "failed", error: str(err.message).slice(0, 300) });
    }
});
