const { HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const nodemailer = require("nodemailer");

// Shared by Super Admin → Send Tickets (sendTicketEmail.js) and the automatic
// post-checkout email (autoSendTicketEmail.js).

// Gmail account the ticket emails go out from. Set with:
//   firebase functions:secrets:set GMAIL_USER
//   firebase functions:secrets:set GMAIL_APP_PASSWORD   (Google App Password)
// Swap the transport below for Brevo / Resend once there is a domain.
const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");
const MAIL_SECRETS = [GMAIL_USER, GMAIL_APP_PASSWORD];

const SENDER_NAME = "OUTSOLD";

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
// Drop the cached transport (e.g. after a 535 bad-password reply).
const resetTransport = () => {
    transport = null;
};
const senderAddress = () => (GMAIL_USER.value() || "").trim();

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
    return out.replace(/[\s ]+/g, " ").trim();
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

/** Gmail quota / rate-limit replies, so callers can stop sending. */
const isQuotaError = (err) => {
    const code = Number(err && err.responseCode);
    const text = str(err && (err.response || err.message));
    return /5\.4\.5|daily user sending|sending limit|rate limit/i.test(text) ||
        code === 421 || code === 454;
};

/**
 * Subject + bodies for a ticket email.
 * @param {Object} p
 * @param {string} p.name recipient's name
 * @param {Object} p.event raw event doc
 * @param {string[]} p.ticketIds every ticket in this email
 * @param {Array<{cid: string, ticketId: string, label: string}>} [p.qrs]
 *   optional inline QR images (one per pass), shown above the sign-off
 * @return {{subject: string, text: string, html: string}}
 */
const buildEmail = ({ name, event, ticketIds, qrs }) => {
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

    const qrHtml = (qrs || []).map((q) => `<div style="display:inline-block;margin:0 12px 12px 0;text-align:center">
<img src="cid:${escapeHtml(q.cid)}" width="180" height="180" alt="QR code for ${escapeHtml(q.ticketId)}" style="display:block">
<div style="font-family:monospace;font-size:13px;margin-top:4px"><b>${escapeHtml(q.ticketId)}</b></div>
<div style="font-size:12px;color:#625f5a">${escapeHtml(q.label)}</div>
</div>`).join("");

    const html = `<p>Hi ${escapeHtml(greetingName)},</p>
<p>Thanks for booking <b>${escapeHtml(title)}</b>. We're looking forward to seeing you there.</p>
<p>${facts.map((f) => `<b>${escapeHtml(f[0])}:</b> ${escapeHtml(f[1])}`).join("<br>")}</p>
<p>Your entry pass is attached as a PDF. Keep it on your phone and show the QR code at the gate.</p>
${qrHtml ? `<div>${qrHtml}</div>` : ""}
<p>${escapeHtml(help)}</p>
<p>See you soon,<br>Team OUTSOLD</p>`;

    return { subject: `Your entry pass for ${title} – ${ids}`, text, html };
};

module.exports = {
    MAIL_SECRETS,
    SENDER_NAME,
    getTransport,
    resetTransport,
    senderAddress,
    str,
    stripHtml,
    escapeHtml,
    normEmail,
    isEmail,
    isQuotaError,
    buildEmail,
};
