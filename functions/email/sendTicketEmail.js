const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const { db, PAYMENTS_REGION } = require("../payments/razorpayClient");
const { isSuperAdminUid } = require("../payments/platformConfig");

const { FieldValue } = admin.firestore;

// Gmail account the ticket emails go out from. Set with:
//   firebase functions:secrets:set GMAIL_USER
//   firebase functions:secrets:set GMAIL_APP_PASSWORD   (Google App Password)
// Swap the transport below for Brevo / Resend once there is a domain.
const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");
const MAIL_SECRETS = [GMAIL_USER, GMAIL_APP_PASSWORD];

const SENDER_NAME = "OUTSOLD";
const MAX_ATTENDEES = 50;
const MAX_PDFS = 10;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;

let transport = null;
const getTransport = () => {
    if (transport) return transport;
    const user = (GMAIL_USER.value() || "").trim();
    const pass = (GMAIL_APP_PASSWORD.value() || "").replace(/\s+/g, "");
    if (!user || !pass) throw new HttpsError("failed-precondition", "EMAIL_NOT_CONFIGURED");
    transport = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user, pass },
    });
    return transport;
};

const requireSuperAdmin = (auth) => {
    if (!auth || !isSuperAdminUid(auth.uid)) {
        throw new HttpsError("permission-denied", "Only super admins can send ticket emails.");
    }
};

const str = (v) => String(v === undefined || v === null ? "" : v).trim();
// Titles are saved from a rich-text editor, so they can carry tags and
// entities like "&nbsp;" (mirrors stripHtmlTags in src/lib/utils.ts).
const ENTITIES = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", ndash: "–", mdash: "—" };
const decodeEntities = (s) => s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => {
        const key = name.toLowerCase();
        return Object.prototype.hasOwnProperty.call(ENTITIES, key) ? ENTITIES[key] : m;
    });
const stripHtml = (s) => {
    let out = str(s);
    // a few passes, so double-encoded text ("&amp;nbsp;") is cleaned too
    for (let i = 0; i < 3; i++) {
        const next = decodeEntities(out.replace(/<[^>]*>/g, " "));
        if (next === out) break;
        out = next;
    }
    return out.replace(/[\s ]+/g, " ").trim();
};
const escapeHtml = (s) => str(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const normEmail = (e) => str(e).toLowerCase();
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const formatDate = (raw) => {
    const s = str(raw);
    if (!s) return "";
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString("en-IN", {
        weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata",
    });
};

/** Gmail quota / rate-limit replies, so the client can stop its send loop. */
const isQuotaError = (err) => {
    const code = Number(err && err.responseCode);
    const text = str(err && (err.response || err.message));
    return /5\.4\.5|daily user sending|sending limit|rate limit/i.test(text) ||
        code === 421 || code === 454;
};

const buildEmail = ({ name, event, ticketIds }) => {
    const title = stripHtml(event.title) || "your event";
    const date = formatDate(event.date);
    const time = str(event.time);
    const venue = event.isOnline ? "Online" : stripHtml(event.venue);
    const helpline = str(event.helplineNumber);
    const ids = ticketIds.join(", ");
    const greetingName = str(name).split(/\s+/)[0] || "there";

    const facts = [
        ["Event", title],
        ["Date", [date, time].filter(Boolean).join(", ")],
        ["Venue", venue],
        [ticketIds.length > 1 ? "Ticket numbers" : "Ticket number", ids],
    ].filter((f) => f[1]);

    const help = helpline ?
        `If you have any questions, reply to this email or call/WhatsApp ${helpline}.` :
        "If you have any questions, just reply to this email.";

    const text = [
        `Hi ${greetingName},`,
        "",
        `Thanks for booking ${title}. We're looking forward to seeing you there.`,
        "",
        ...facts.map((f) => `${f[0]}: ${f[1]}`),
        "",
        "Your entry pass is attached as a PDF. Keep it on your phone and show the QR code at the gate.",
        "",
        help,
        "",
        "See you soon,",
        "Team OUTSOLD",
    ].join("\n");

    const html = `<p>Hi ${escapeHtml(greetingName)},</p>
<p>Thanks for booking <b>${escapeHtml(title)}</b>. We're looking forward to seeing you there.</p>
<p>${facts.map((f) => `<b>${escapeHtml(f[0])}:</b> ${escapeHtml(f[1])}`).join("<br>")}</p>
<p>Your entry pass is attached as a PDF. Keep it on your phone and show the QR code at the gate.</p>
<p>${escapeHtml(help)}</p>
<p>See you soon,<br>Team OUTSOLD</p>`;

    return { subject: `Your entry pass for ${title} – ${ids}`, text, html };
};

const decodePdfs = (pdfs) => {
    if (!Array.isArray(pdfs) || pdfs.length < 1 || pdfs.length > MAX_PDFS) {
        throw new HttpsError("invalid-argument", `Attach between 1 and ${MAX_PDFS} PDFs.`);
    }
    let total = 0;
    return pdfs.map((p, i) => {
        const content = Buffer.from(str(p && p.base64), "base64");
        if (content.length < 5 || content.slice(0, 4).toString() !== "%PDF") {
            throw new HttpsError("invalid-argument", `Attachment ${i + 1} is not a PDF.`);
        }
        total += content.length;
        if (total > MAX_TOTAL_BYTES) throw new HttpsError("invalid-argument", "Attachments are too large.");
        const filename = str(p.filename).replace(/[^\w.\- ]/g, "_").slice(0, 80) || `ticket-${i + 1}.pdf`;
        return { filename: filename.endsWith(".pdf") ? filename : `${filename}.pdf`, content };
    });
};

const eventRefFor = (data) => {
    const companyId = str(data && data.companyId);
    const eventId = str(data && data.eventId);
    if (!companyId || !eventId) throw new HttpsError("invalid-argument", "Missing company or event.");
    return db.collection("companies").doc(companyId).collection("events").doc(eventId);
};

/**
 * Super Admin → Send Tickets. Emails one recipient their ticket PDFs (built
 * in the browser with the same code as the in-app download). The recipient
 * address is read from the attendee docs, never taken from the client.
 */
exports.sendTicketEmail = onCall({
    region: PAYMENTS_REGION,
    secrets: MAIL_SECRETS,
    memory: "512MiB",
    timeoutSeconds: 60,
}, async (request) => {
    const { auth, data } = request;
    requireSuperAdmin(auth);

    const eventRef = eventRefFor(data);
    const attendeeIds = Array.isArray(data && data.attendeeIds) ?
        Array.from(new Set(data.attendeeIds.map(str).filter(Boolean))) : [];
    if (attendeeIds.length < 1 || attendeeIds.length > MAX_ATTENDEES) {
        throw new HttpsError("invalid-argument", `Send between 1 and ${MAX_ATTENDEES} tickets per email.`);
    }
    const attachments = decodePdfs(data.pdfs);
    const test = data.test === true;

    const attendeeRefs = attendeeIds.map((id) => eventRef.collection("attendees").doc(id));
    const [eventSnap, ...attendeeSnaps] = await db.getAll(eventRef, ...attendeeRefs);
    if (!eventSnap.exists) throw new HttpsError("not-found", "Event not found.");

    const attendees = attendeeSnaps.map((s) => {
        if (!s.exists) throw new HttpsError("not-found", `Ticket ${s.id} not found.`);
        return s.data();
    });
    if (attendees.some((a) => a.status === "cancelled")) {
        throw new HttpsError("failed-precondition", "One of these tickets is cancelled.");
    }
    const emails = Array.from(new Set(attendees.map((a) => normEmail(a.email))));
    if (emails.length !== 1 || !isEmail(emails[0])) {
        throw new HttpsError("failed-precondition", "These tickets don't share one valid email address.");
    }

    const mailer = getTransport();
    const from = (GMAIL_USER.value() || "").trim();
    const to = test ? from : emails[0];
    const ticketIds = attendees.map((a) => str(a.ticketId)).filter(Boolean).sort();
    const { subject, text, html } = buildEmail({ name: attendees[0].name, event: eventSnap.data(), ticketIds });

    let info;
    try {
        info = await mailer.sendMail({
            from: { name: SENDER_NAME, address: from },
            replyTo: from,
            to,
            subject: test ? `[TEST] ${subject}` : subject,
            text,
            html,
            attachments: attachments.map((a) => ({ ...a, contentType: "application/pdf" })),
        });
    } catch (err) {
        const code = Number(err && err.responseCode);
        const message = str(err && (err.response || err.message)).slice(0, 300) || "Send failed";
        if (!test && !isQuotaError(err)) {
            const batch = db.batch();
            attendeeRefs.forEach((ref) => batch.update(ref, {
                ticketEmail: { status: "failed", error: message, failedAt: FieldValue.serverTimestamp() },
            }));
            await batch.commit();
        }
        if (isQuotaError(err)) throw new HttpsError("resource-exhausted", "GMAIL_DAILY_LIMIT", { message });
        if (code === 535) {
            transport = null;
            throw new HttpsError("failed-precondition", "Gmail App Password is invalid.", { message });
        }
        throw new HttpsError("internal", message);
    }

    if (!test) {
        const batch = db.batch();
        attendeeRefs.forEach((ref) => batch.update(ref, {
            ticketEmail: {
                status: "sent",
                sentAt: FieldValue.serverTimestamp(),
                messageId: str(info && info.messageId),
                sentBy: auth.uid,
                to,
            },
        }));
        await batch.commit();
    }

    return { success: true, to, test };
});

/**
 * Super Admin → Send Tickets → "Mark already sent". Flags tickets emailed
 * outside the app (or clears the flag so they can be resent).
 */
exports.markTicketEmails = onCall({ region: PAYMENTS_REGION }, async (request) => {
    const { auth, data } = request;
    requireSuperAdmin(auth);

    const eventRef = eventRefFor(data);
    const action = data && data.action === "clear" ? "clear" : "sent";
    const ticketIds = Array.isArray(data && data.ticketIds) ?
        Array.from(new Set(data.ticketIds.map((t) => str(t).toUpperCase()).filter(Boolean))) : [];
    if (ticketIds.length < 1 || ticketIds.length > 2000) {
        throw new HttpsError("invalid-argument", "Paste between 1 and 2000 ticket IDs.");
    }

    const found = new Set();
    let updated = 0;
    for (let i = 0; i < ticketIds.length; i += 30) {
        const chunk = ticketIds.slice(i, i + 30);
        const snap = await eventRef.collection("attendees").where("ticketId", "in", chunk).get();
        if (snap.empty) continue;
        const batch = db.batch();
        snap.docs.forEach((d) => {
            found.add(str(d.get("ticketId")).toUpperCase());
            batch.update(d.ref, {
                ticketEmail: action === "clear" ?
                    FieldValue.delete() :
                    { status: "sent", sentAt: FieldValue.serverTimestamp(), manual: true, sentBy: auth.uid },
            });
            updated++;
        });
        await batch.commit();
    }

    return { success: true, updated, notFound: ticketIds.filter((t) => !found.has(t)) };
});
