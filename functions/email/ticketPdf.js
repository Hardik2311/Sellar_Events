// Server copy of src/lib/ticketPdf.ts (+ the helpers it uses from
// src/lib/ticketFormat.ts and src/lib/pdfFonts.ts) — keep the layout in sync.
// Differences from the browser build:
//   - fonts and the Outsold logo are read from disk (./fonts, ./assets);
//   - no poster hero (needs canvas compositing) — the yellow pattern is used;
//   - dates are computed in IST so a UTC server prints the same values.
const fs = require("fs");
const path = require("path");
const { jsPDF: JsPDF } = require("jspdf");
const QRCode = require("qrcode");

// ── ticketFormat helpers (UTC getters on IST-shifted / date-only values) ──
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const IST_OFFSET_MS = 330 * 60 * 1000;

// "2026-10-15" -> Date at 00:00 UTC; read it with getUTC*.
const parseIsoDate = (iso) => {
    if (!iso) return null;
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return isNaN(d.getTime()) ? null : d;
};
// "Thu, 15 Oct 2026"
const formatFullDate = (d) => `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
// Mirrors formatTime in src/data/events.ts
const formatTime = (time) => {
    if (!time) return "";
    const [h, m] = time.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
};
// "18:00" -> "6:00 PM"; anything that isn't HH:MM is shown as typed
const formatClock = (t) => {
    if (!t) return "";
    return /^\d{1,2}:\d{2}/.test(t) ? formatTime(t) : t;
};
const formatAmount = (amount, rupee) => {
    if (!amount) return "Free";
    const hasPaise = Math.round(amount * 100) % 100 !== 0;
    return `${rupee}${amount.toLocaleString("en-IN", {
        minimumFractionDigits: hasPaise ? 2 : 0,
        maximumFractionDigits: hasPaise ? 2 : 0,
    })}`;
};
const maskEmail = (email) => {
    const [local, domain] = email.split("@");
    if (!domain) return email;
    return `${local.slice(0, 2)}••••••@${domain}`;
};
const maskPhone = (phone) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) return phone;
    const local = digits.length > 10 ? digits.slice(-10) : digits;
    const cc = digits.length > 10 ? `+${digits.slice(0, digits.length - 10)} ` : "";
    return `${cc}${local.slice(0, 2)}••• ••${local.slice(-3)}`;
};
const pad2 = (n) => n.toString().padStart(2, "0");
const toCalStamp = (d) =>
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}00`;
const toCalDay = (d) => `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
const buildCalendarUrl = (title, date, time, location) => {
    let dates;
    const m = time ? String(time).match(/^(\d{1,2}):(\d{2})/) : null;
    if (m) {
        const start = new Date(date.getTime());
        start.setUTCHours(Number(m[1]), Number(m[2]));
        const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
        dates = `${toCalStamp(start)}/${toCalStamp(end)}`;
    } else {
        const next = new Date(date.getTime());
        next.setUTCDate(next.getUTCDate() + 1);
        dates = `${toCalDay(date)}/${toCalDay(next)}`; // all-day: end date is exclusive
    }
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dates}&ctz=Asia/Kolkata&location=${encodeURIComponent(location)}`;
};
const htmlToPlainLines = (html) => String(html)
    .replace(/\r\n?/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|ul|ol|tr)>/gi, "\n")
    .replace(/<(p|div|li|h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
const buildDirectionsUrl = (venue) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`;

// ── Fonts (pdfFonts.ts) ──
const PdfFont = {
    Display: "Anton",
    Body: "Figtree",
    BodySemiBold: "Figtree-SemiBold",
    BodyBold: "Figtree-Bold",
    Mono: "SpaceMono-Bold",
};
const PDF_FONT_METRICS = {
    "Anton": { ascent: 2409 / 2048, descent: 674 / 2048 },
    "Figtree": { ascent: 0.95, descent: 0.25 },
    "Figtree-SemiBold": { ascent: 0.95, descent: 0.25 },
    "Figtree-Bold": { ascent: 0.95, descent: 0.25 },
    "SpaceMono-Bold": { ascent: 1.12, descent: 0.361 },
};
const FONT_FILES = [
    { name: PdfFont.Display, file: "Anton-Regular.ttf" },
    { name: PdfFont.Body, file: "Figtree-Regular.ttf" },
    { name: PdfFont.BodySemiBold, file: "Figtree-SemiBold.ttf" },
    { name: PdfFont.BodyBold, file: "Figtree-Bold.ttf" },
    { name: PdfFont.Mono, file: "SpaceMono-Bold.ttf" },
];

let fontData;
const loadFontData = () => {
    if (fontData === undefined) {
        try {
            fontData = FONT_FILES.map(({ name, file }) => ({
                name,
                base64: fs.readFileSync(path.join(__dirname, "fonts", file)).toString("base64"),
            }));
        } catch (err) {
            console.error("Ticket PDF fonts failed to load, falling back to Helvetica:", err);
            fontData = null;
        }
    }
    return fontData;
};
const registerPdfFonts = (doc) => {
    const fonts = loadFontData();
    if (!fonts) return false;
    fonts.forEach(({ name, base64 }) => {
        const file = `${name}.ttf`;
        doc.addFileToVFS(file, base64);
        doc.addFont(file, name, "normal");
    });
    return true;
};

// Pre-trimmed copy of public/OUTSOLD Logo PNG.png (720px wide JPEG on white).
const LOGO_W_PX = 720;
const LOGO_H_PX = 268;
let logo;
const loadLogo = () => {
    if (logo === undefined) {
        try {
            const b64 = fs.readFileSync(path.join(__dirname, "assets", "outsold-logo.jpg")).toString("base64");
            logo = { dataUrl: `data:image/jpeg;base64,${b64}`, aspect: LOGO_H_PX / LOGO_W_PX };
        } catch (err) {
            logo = null;
        }
    }
    return logo;
};

// ── Design tokens (Outsold storefront) ──
const INK = [20, 18, 15];
const WHITE = [255, 255, 255];
const LINE = [214, 210, 200];
const MUTED = [98, 95, 90];
const TEAL = [0, 122, 120];
const YELLOW = [245, 197, 24];
const SOFT_YELLOW = [255, 247, 207];
const RED = [180, 35, 24];
const CUT_LINE = [138, 136, 130];

// ── Page geometry (design px) ──
const PAGE_H = 1123;
const PAD = 48;
const CONTENT_W = 794 - PAD * 2; // 698
const GAP = 20;
const FOOTER_H = 1 + 16 + 16;
const CONTENT_BOTTOM = PAGE_H - PAD - FOOTER_H - GAP;

const HERO_H = 210;
const DATE_BOX_W = 80;
const CUT_BAND_W = 60;
const CUT_QR_COL_W = 236;
const QR_SIZE = 184;

const PX = 0.75; // design px -> PDF pt

const HELVETICA_METRICS = { ascent: 0.77, descent: 0.23 };

/** Drawing helper: all inputs in design px. */
class Pen {
    /**
     * @param {JsPDF} doc
     * @param {boolean} branded brand fonts registered
     */
    constructor(doc, branded) {
        this.doc = doc;
        this.branded = branded;
        this.fontName = PdfFont.Body;
        this.sizePx = 14;
    }

    font(name, sizePx) {
        this.fontName = name;
        this.sizePx = sizePx;
        if (this.branded) {
            this.doc.setFont(name, "normal");
        } else if (name === PdfFont.Mono) {
            this.doc.setFont("courier", "bold");
        } else {
            this.doc.setFont("helvetica", name === PdfFont.Body ? "normal" : "bold");
        }
        this.doc.setFontSize(sizePx * PX);
        return this;
    }

    color(c) {
        this.doc.setTextColor(...c);
        return this;
    }

    width(text, letterSpacing = 0) {
        return this.doc.getTextWidth(text) / PX + letterSpacing * Math.max(0, text.length - 1);
    }

    text(str, x, top, lineHeight, opts = {}) {
        const m = this.branded ? PDF_FONT_METRICS[this.fontName] : HELVETICA_METRICS;
        const fs = this.sizePx;
        const baseline = top + (lineHeight - (m.ascent + m.descent) * fs) / 2 + m.ascent * fs;
        const ls = opts.letterSpacing || 0;
        const w = this.width(str, ls);
        const left = opts.align === "right" ? x - w : opts.align === "center" ? x - w / 2 : x;
        this.doc.text(str, left * PX, baseline * PX, ls ? { charSpace: ls * PX } : undefined);
        if (opts.link) this.doc.link(left * PX, top * PX, w * PX, lineHeight * PX, { url: opts.link });
        return w;
    }

    wrap(str, maxWidth, maxLines = Infinity, letterSpacing = 0) {
        const lines = [];
        const approxChars = maxWidth / (this.sizePx * 0.45);
        const wrapWidth = maxWidth - letterSpacing * approxChars;
        str.split("\n").forEach((para) => {
            lines.push(...this.doc.splitTextToSize(para || " ", wrapWidth * PX));
        });
        if (lines.length <= maxLines) return lines;
        const kept = lines.slice(0, maxLines);
        let last = kept[maxLines - 1];
        while (last.length > 1 && this.width(`${last}…`, letterSpacing) > maxWidth) last = last.slice(0, -1);
        kept[maxLines - 1] = `${last.trimEnd()}…`;
        return kept;
    }

    fit(name, str, maxWidth, maxLines, maxSize, minSize, letterSpacing = 0) {
        for (let size = maxSize; size >= minSize; size -= 2) {
            this.font(name, size);
            const lines = this.wrap(str, maxWidth, Infinity, letterSpacing);
            if (lines.length <= maxLines) return { size, lines };
        }
        this.font(name, minSize);
        return { size: minSize, lines: this.wrap(str, maxWidth, maxLines, letterSpacing) };
    }

    rect(x, y, w, h, fill) {
        this.doc.setFillColor(...fill);
        this.doc.rect(x * PX, y * PX, w * PX, h * PX, "F");
    }

    roundRect(x, y, w, h, r, fill, stroke, strokeW = 1) {
        if (fill) this.doc.setFillColor(...fill);
        if (stroke) {
            this.doc.setDrawColor(...stroke);
            this.doc.setLineWidth(strokeW * PX);
        }
        const style = fill && stroke ? "FD" : fill ? "F" : "S";
        this.doc.roundedRect(x * PX, y * PX, w * PX, h * PX, r * PX, r * PX, style);
    }

    line(x1, y1, x2, y2, color, w = 1, dash) {
        this.doc.setDrawColor(...color);
        this.doc.setLineWidth(w * PX);
        if (dash) this.doc.setLineDashPattern(dash.map((d) => d * PX), 0);
        this.doc.line(x1 * PX, y1 * PX, x2 * PX, y2 * PX);
        if (dash) this.doc.setLineDashPattern([], 0);
    }

    hr(x, y, w, color = LINE) {
        this.rect(x, y, w, 1, color);
    }

    circle(cx, cy, r, fill, stroke, strokeW = 1) {
        if (fill) this.doc.setFillColor(...fill);
        if (stroke) {
            this.doc.setDrawColor(...stroke);
            this.doc.setLineWidth(strokeW * PX);
        }
        this.doc.circle(cx * PX, cy * PX, r * PX, fill && stroke ? "FD" : fill ? "F" : "S");
    }

    textUp(str, cx, cy, letterSpacing = 0) {
        const cap = (this.branded && this.fontName === PdfFont.Display ? 1760 / 2048 : 0.72) * this.sizePx;
        const w = this.width(str, letterSpacing);
        this.doc.text(str, (cx + cap / 2) * PX, (cy + w / 2) * PX, {
            angle: 90,
            ...(letterSpacing ? { charSpace: letterSpacing * PX } : {}),
        });
    }

    scissors(x, y, size, color) {
        const s = size / 24;
        const p = (v) => v * s * PX;
        this.doc.setDrawColor(...color);
        this.doc.setLineWidth(1.75 * s * PX);
        this.doc.setLineCap("round");
        this.doc.circle(x * PX + p(6), y * PX + p(6), p(3), "S");
        this.doc.circle(x * PX + p(6), y * PX + p(18), p(3), "S");
        const seg = (x1, y1, x2, y2) =>
            this.doc.line(x * PX + p(x1), y * PX + p(y1), x * PX + p(x2), y * PX + p(y2));
        seg(8.12, 8.12, 12, 12);
        seg(20, 4, 8.12, 15.88);
        seg(14.8, 14.8, 20, 20);
        this.doc.setLineCap("butt");
    }

    icon(points, x, y, size, color, strokeW) {
        const s = size / 24;
        this.doc.setDrawColor(...color);
        this.doc.setLineWidth(strokeW * s * PX);
        this.doc.setLineCap("round");
        this.doc.setLineJoin("round");
        points.forEach((poly) => {
            const [start, ...rest] = poly;
            let [px, py] = start;
            const deltas = rest.map(([nx, ny]) => {
                const d = [(nx - px) * s * PX, (ny - py) * s * PX];
                px = nx;
                py = ny;
                return d;
            });
            this.doc.lines(deltas, (x + start[0] * s) * PX, (y + start[1] * s) * PX, [1, 1], "S", false);
        });
        this.doc.setLineCap("butt");
        this.doc.setLineJoin("miter");
    }
}

const CHECK_ICON = [[[20, 6], [9, 17], [4, 12]]];

// QR as vector modules — value is the ticket ID the door scanner reads.
const drawQr = (pen, value, x, y, size) => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
    const quiet = 2;
    const n = modules.size;
    const cell = size / (n + quiet * 2);
    pen.doc.setFillColor(...INK);
    for (let r = 0; r < n; r++) {
        let c = 0;
        while (c < n) {
            if (!modules.get(r, c)) {
                c++;
                continue;
            }
            const start = c;
            while (c < n && modules.get(r, c)) c++;
            pen.doc.rect(
                (x + (quiet + start) * cell) * PX,
                (y + (quiet + r) * cell) * PX,
                (c - start) * cell * PX,
                cell * PX,
                null,
            );
        }
    }
    pen.doc.fill();
};

// jsPDF's built-in Helvetica only covers WinAnsi; the brand TTFs add ₹.
// Drop anything else (emoji etc.) so it doesn't print as garbage.
const WIN_ANSI_EXTRAS = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const toPdfText = (value, allowRupee) => {
    let s = String(value).normalize("NFKC");
    if (!allowRupee) s = s.replace(/₹\s*/g, "Rs. ");
    return Array.from(s)
        .filter((ch) => {
            const cp = ch.codePointAt(0);
            return (
                ch === "\n" ||
                (cp >= 0x20 && cp <= 0x7e) ||
                (cp >= 0xa0 && cp <= 0xff) ||
                WIN_ANSI_EXTRAS.includes(ch) ||
                (allowRupee && ch === "₹")
            );
        })
        .join("")
        .replace(/[^\S\n]+/g, " ")
        .replace(/ *\n */g, "\n")
        .trim();
};

/**
 * Builds one pass's ticket PDF (same layout as the in-app download).
 * @param {Object} ticket ticketId, tierName, admits, attendeeName, attendeeEmail,
 *   attendeePhone, amountPaid, paymentMode, purchasedAt (ms)
 * @param {Object} event eventTitle, eventCategory, eventDate, eventTime, eventVenue,
 *   eventConsentText, eventGoodToKnowText, eventIsOnline, eventArriveBy,
 *   eventAgeLimit, eventHelplineNumber
 * @return {Buffer} the PDF bytes
 */
const buildTicketPdf = (ticket, event) => {
    const doc = new JsPDF({ unit: "pt", format: "a4", compress: true });
    const branded = registerPdfFonts(doc);
    const logoImg = loadLogo();
    const pen = new Pen(doc, branded);
    const txt = (v) => (v ? toPdfText(v, branded) : "");
    const rupee = branded ? "₹" : "Rs. ";

    // ── Data ──
    const title = (event.eventTitle ? txt(htmlToPlainLines(event.eventTitle).replace(/\n/g, " ")) : "") || "Event";
    const category = txt(event.eventCategory);
    const showCategory = !!category && category.toLowerCase() !== "other";
    const subtitle = [showCategory ? category : "", event.eventIsOnline ? "Online" : ""].filter(Boolean).join(" · ");
    const venue = event.eventIsOnline ? "Online" : txt(event.eventVenue) || "TBA";
    const dateObj = parseIsoDate(event.eventDate);
    const startTime = formatClock(txt(event.eventTime));
    const gatesTime = formatClock(txt(event.eventArriveBy));
    const timeFact = gatesTime ? { label: "Gates open", value: gatesTime } :
        startTime ? { label: "Starts", value: startTime } : null;
    const admits = Math.max(1, ticket.admits || 1);
    const ticketId = txt(ticket.ticketId);
    const holder = txt(ticket.attendeeName) || "Guest";
    const tierName = txt(ticket.tierName) || "General";
    const email = txt(ticket.attendeeEmail);
    const phone = txt(ticket.attendeePhone);
    const contact = email ? maskEmail(email) : phone ? maskPhone(phone) : "—";
    const bookedOn = ticket.purchasedAt ? formatFullDate(new Date(ticket.purchasedAt + IST_OFFSET_MS)) : "—";
    const paymentMode = txt(ticket.paymentMode);
    const goodToKnow = event.eventGoodToKnowText ? txt(htmlToPlainLines(event.eventGoodToKnowText)) : "";
    const consent = event.eventConsentText ? txt(htmlToPlainLines(event.eventConsentText)) : "";
    const helpline = txt(event.eventHelplineNumber);
    const ageLimit = txt(event.eventAgeLimit);

    const directionsUrl = event.eventVenue && !event.eventIsOnline ? buildDirectionsUrl(event.eventVenue) : null;
    const calendarUrl = dateObj ?
        buildCalendarUrl(title, dateObj, event.eventTime, event.eventIsOnline ? "Online" : event.eventVenue || "") :
        null;

    let y = PAD;

    // ── Pagination ──
    const ensureSpace = (needed) => {
        if (y + needed <= CONTENT_BOTTOM) return;
        doc.addPage("a4");
        y = PAD;
        pen.font(PdfFont.Mono, 11).color(MUTED).text(`E-TICKET · ${ticketId} · CONTINUED`, PAD, y, 14, { letterSpacing: 0.88 });
        y += 14 + GAP;
    };

    const heading = (text, x, top, size = 22, lineHeight = 26) =>
        pen.font(PdfFont.Display, size).color(INK).text(text.toUpperCase(), x, top, lineHeight, { letterSpacing: size * 0.01 });

    // ── Hero: the yellow pattern (no poster on the server) ──
    {
        doc.saveGraphicsState();
        doc.roundedRect(PAD * PX, y * PX, CONTENT_W * PX, HERO_H * PX, 12 * PX, 12 * PX, null);
        doc.clip();
        doc.discardPath();
        pen.rect(PAD, y, CONTENT_W, HERO_H, YELLOW);
        pen.circle(PAD + 40 + 75, y + 30 + 75, 73.5, undefined, INK, 3);
        pen.circle(PAD + 150 + 48, y + 86 + 48, 48, TEAL);
        pen.circle(PAD + CONTENT_W + 60 - 110, y + HERO_H + 60 - 110, 110, INK);
        doc.restoreGraphicsState();
        y += HERO_H + GAP;
    }

    // ── Title row: date block, title + subtitle, Outsold logo ──
    {
        const logoW = 180;
        const logoH = logoImg ? logoW * logoImg.aspect : 28;
        const titleX = PAD + DATE_BOX_W + 16;
        const titleW = CONTENT_W - DATE_BOX_W - 16 - 24 - logoW;
        const titleFit = pen.fit(PdfFont.Display, title.toUpperCase(), titleW, 2, 52, 34, 0.52);
        const subtitleLines = subtitle ? pen.font(PdfFont.BodyBold, 17).wrap(subtitle, titleW, 1) : [];
        const titleBlockH = titleFit.lines.length * titleFit.size + (subtitleLines.length ? 4 + 22 : 0);
        const dateH = Math.max(84, titleBlockH);
        const rowH = Math.max(dateH, logoH);
        const bottom = y + rowH;

        const dTop = bottom - dateH;
        pen.roundRect(PAD, dTop, DATE_BOX_W, dateH, 8, YELLOW);
        const dcx = PAD + DATE_BOX_W / 2;
        const dContent = dTop + (dateH - 74) / 2;
        pen.font(PdfFont.Mono, 11).color(INK).text(dateObj ? WEEKDAYS[dateObj.getUTCDay()].toUpperCase() : "DATE", dcx, dContent, 14, { align: "center", letterSpacing: 0.88 });
        pen.font(PdfFont.Display, 40).text(dateObj ? String(dateObj.getUTCDate()) : "--", dcx, dContent + 14, 42, { align: "center" });
        pen.font(PdfFont.Display, 16).text(dateObj ? MONTHS[dateObj.getUTCMonth()].toUpperCase() : "TBA", dcx, dContent + 56, 18, { align: "center", letterSpacing: 0.64 });

        let ty = bottom - titleBlockH;
        pen.font(PdfFont.Display, titleFit.size).color(INK);
        titleFit.lines.forEach((l) => {
            pen.text(l, titleX, ty, titleFit.size, { letterSpacing: 0.52 });
            ty += titleFit.size;
        });
        if (subtitleLines.length) pen.font(PdfFont.BodyBold, 17).color(TEAL).text(subtitleLines[0], titleX, ty + 4, 22);

        if (logoImg) {
            doc.addImage(logoImg.dataUrl, "JPEG", (PAD + CONTENT_W - logoW) * PX, (bottom - logoH) * PX, logoW * PX, logoH * PX);
        } else {
            pen.font(PdfFont.Display, 24).color(INK).text("OUTSOLD", PAD + CONTENT_W, bottom - 28, 28, { align: "right" });
        }
        y = bottom + GAP;
    }

    // ── Print-and-cut ticket ──
    {
        const outerX = PAD;
        const outerW = CONTENT_W;
        const innerX = outerX + 2 + 10;
        const innerW = outerW - 24;
        const midX = innerX + 2 + CUT_BAND_W;
        const qrColX = innerX + innerW - 2 - CUT_QR_COL_W;
        const divX = qrColX - 1;
        const midW = divX - 1 - midX;
        const cX = midX + 24;
        const cW = midW - 48;
        const factColW = (cW - 20) / 2;

        const facts = [
            { label: "Date", value: dateObj ? formatFullDate(dateObj) : "TBA" },
            ...(timeFact ? [timeFact] : []),
            { label: "Venue", value: venue },
            { label: "Ticket holder", value: holder },
        ];
        pen.font(PdfFont.BodyBold, 18);
        const factLines = facts.map((f) => pen.wrap(f.value, factColW, 2));
        const factRows = [];
        for (let i = 0; i < facts.length; i += 2) {
            const next = factLines[i + 1] ? factLines[i + 1].length : 0;
            factRows.push(14 + 4 + Math.max(factLines[i].length, next) * 22);
        }
        const factsH = factRows.reduce((s, h) => s + h, 0) + 16 * (factRows.length - 1);
        const midH = 22 + 30 + 16 + factsH + 22;

        const idLines = pen.font(PdfFont.Mono, 11).wrap(ticketId, CUT_QR_COL_W - 40, 2, 0.88);
        const qrColH = 18 + QR_SIZE + 8 + idLines.length * 14 + 18;

        const contentH = Math.max(midH, qrColH);
        const innerH = contentH + 4;
        const outerH = innerH + 24;
        ensureSpace(outerH + 8 + 16);
        const oy = y;
        const iy = oy + 12;

        doc.setLineDashPattern([6 * PX, 4 * PX], 0);
        pen.roundRect(outerX + 1, oy + 1, outerW - 2, outerH - 2, 15, undefined, CUT_LINE, 2);
        doc.setLineDashPattern([], 0);
        pen.rect(outerX + 28, oy - 11, 28, 22, WHITE);
        pen.scissors(outerX + 32, oy - 9, 20, MUTED);

        pen.roundRect(innerX + 1, iy + 1, innerW - 2, innerH - 2, 9, WHITE, INK, 2);
        doc.saveGraphicsState();
        doc.roundedRect((innerX + 2) * PX, (iy + 2) * PX, (innerW - 4) * PX, (innerH - 4) * PX, 8 * PX, 8 * PX, null);
        doc.clip();
        doc.discardPath();
        pen.rect(innerX + 2, iy + 2, CUT_BAND_W, innerH - 4, INK);
        doc.restoreGraphicsState();
        const admitLabel = admits > 1 ? `ADMITS ${admits}` : "ADMIT ONE";
        pen.font(PdfFont.Display, 22).color(YELLOW).textUp(admitLabel, innerX + 2 + CUT_BAND_W / 2, iy + innerH / 2, 2.64);

        let my = iy + 2 + (contentH - midH) / 2 + 22;
        const tierFit = pen.fit(PdfFont.Display, tierName.toUpperCase(), cW - 28 - 120, 1, 15, 11, 0.75);
        pen.font(PdfFont.Display, tierFit.size);
        const pillW = pen.width(tierFit.lines[0], 0.75) + 28;
        pen.roundRect(cX, my, pillW, 30, 15, YELLOW);
        pen.color(INK).text(tierFit.lines[0], cX + 14, my, 30, { letterSpacing: 0.75 });
        const sx = cX + pillW + 12;
        pen.icon(CHECK_ICON, sx, my + 7, 16, TEAL, 2.25);
        pen.font(PdfFont.BodyBold, 14).color(TEAL).text("Confirmed", sx + 22, my + 5, 20);
        my += 30 + 16;
        for (let r = 0; r < factRows.length; r++) {
            [0, 1].forEach((c) => {
                const i = r * 2 + c;
                if (!facts[i]) return;
                const fx = cX + c * (factColW + 20);
                pen.font(PdfFont.Mono, 11).color(MUTED).text(facts[i].label.toUpperCase(), fx, my, 14, { letterSpacing: 0.88 });
                pen.font(PdfFont.BodyBold, 18).color(INK);
                factLines[i].forEach((l, j) => pen.text(l, fx, my + 18 + j * 22, 22));
            });
            my += factRows[r] + 16;
        }

        pen.line(divX, iy + 2 + 16, divX, iy + innerH - 2 - 16, CUT_LINE, 2, [6, 4]);

        const qrCx = qrColX + CUT_QR_COL_W / 2;
        let qy = iy + 2 + (contentH - qrColH) / 2 + 18;
        drawQr(pen, ticketId, qrCx - QR_SIZE / 2, qy, QR_SIZE);
        qy += QR_SIZE + 8;
        pen.font(PdfFont.Mono, 11).color(INK);
        idLines.forEach((l) => {
            pen.text(l, qrCx, qy, 14, { align: "center", letterSpacing: 0.88 });
            qy += 14;
        });

        y = oy + outerH + 8;
        pen.font(PdfFont.Body, 12).color(MUTED).text(
            "Print and cut along the dashed line, or show this page on your phone. Each QR code scans once.",
            PAD, y, 16,
        );
        y += 16 + GAP;
    }

    // ── Booking / Getting there ──
    {
        const LINK_SEP = "  ·  ";
        const colW = (CONTENT_W - 24) / 2;
        const subW = (colW - 16) / 2;
        const quickLinks = [
            ...(directionsUrl ? [{ text: "Map", url: directionsUrl }] : []),
            ...(calendarUrl ? [{ text: "Calendar", url: calendarUrl }] : []),
        ];
        const booking = [
            { label: "Tickets", value: tierName.includes("×") ? tierName : `${admits} × ${tierName}` },
            { label: paymentMode ? `Paid via ${paymentMode}` : "Amount paid", value: formatAmount(ticket.amountPaid, rupee) },
            { label: "Booked on", value: bookedOn },
            { label: "Contact", value: contact },
        ];
        const gettingThere = [
            { label: "Venue", value: venue, wide: !ageLimit },
            ...(ageLimit ? [{ label: "Age limit", value: ageLimit }] : []),
            ...(quickLinks.length ?
                [{ label: "Quick links", value: quickLinks.map((l) => l.text).join(LINK_SEP), links: quickLinks, wide: true }] :
                []),
        ];

        const layout = (facts) => {
            const rows = [];
            let i = 0;
            while (i < facts.length) {
                const pair = facts[i].wide || !facts[i + 1] || facts[i + 1].wide ? [facts[i]] : [facts[i], facts[i + 1]];
                const w = pair.length === 1 ? colW : subW;
                pen.font(PdfFont.BodySemiBold, 14);
                const items = pair.map((f) => ({ ...f, lines: f.links ? [f.value] : pen.wrap(f.value, w, 3) }));
                rows.push({ items, h: 14 + 2 + Math.max(...items.map((it) => it.lines.length)) * 20 });
                i += pair.length;
            }
            return rows;
        };
        const bookingRows = layout(booking);
        const gettingRows = layout(gettingThere);
        const colH = (rows) => 3 + 14 + 24 + 10 + rows.reduce((s, r) => s + r.h, 0) + 8 * (rows.length - 1);
        ensureSpace(Math.max(colH(bookingRows), colH(gettingRows)));

        const drawColumn = (title, rule, rows, x) => {
            pen.rect(x, y, colW, 3, rule);
            heading(title, x, y + 3 + 14, 20, 24);
            let ry = y + 3 + 14 + 24 + 10;
            rows.forEach((row) => {
                row.items.forEach((it, c) => {
                    const fx = x + c * (subW + 16);
                    pen.font(PdfFont.Mono, 11).color(MUTED).text(it.label.toUpperCase(), fx, ry, 14, { letterSpacing: 0.88 });
                    pen.font(PdfFont.BodySemiBold, 14);
                    if (it.links) {
                        let lx = fx;
                        it.links.forEach((l, li) => {
                            if (li > 0) lx += pen.color(MUTED).text(LINK_SEP, lx, ry + 16, 20);
                            lx += pen.color(TEAL).text(l.text, lx, ry + 16, 20, { link: l.url });
                        });
                    } else {
                        pen.color(INK);
                        it.lines.forEach((l, j) => pen.text(l, fx, ry + 16 + j * 20, 20));
                    }
                });
                ry += row.h + 8;
            });
            return ry - 8;
        };
        const end1 = drawColumn("Booking", INK, bookingRows, PAD);
        const end2 = drawColumn("Getting there", TEAL, gettingRows, PAD + colW + 24);
        y = Math.max(end1, end2) + GAP;
    }

    const flow = (title, text, size, lh, color) => {
        pen.font(PdfFont.Body, size);
        const paras = text.split(/\n+/).map((p) => p.trim()).filter(Boolean).map((p) => pen.wrap(p, CONTENT_W));
        if (!paras.length) return;
        ensureSpace(26 + 8 + lh * Math.min(2, paras[0].length));
        heading(title, PAD, y);
        y += 26 + 8;
        paras.forEach((lines, pi) => {
            lines.forEach((l) => {
                ensureSpace(lh);
                pen.font(PdfFont.Body, size).color(color).text(l, PAD, y, lh);
                y += lh;
            });
            if (pi < paras.length - 1) y += 6;
        });
        y += GAP;
    };

    // ── Before you go ──
    {
        const atGate = admits > 1 ?
            `Show the QR code on this ticket, on your phone or printed. It admits all ${admits} people in your group, so arrive together. Each code scans once.` :
            "Show the QR code on this ticket, on your phone or printed. Each code scans once, so don't share it.";
        const innerW = CONTENT_W - 48;
        const colW = (innerW - 24) / 2;
        pen.font(PdfFont.Body, 15);
        let gateLines = pen.wrap(atGate, goodToKnow ? colW : innerW);
        let orgLines = goodToKnow ? pen.wrap(goodToKnow, colW) : [];
        const orgInPanel = orgLines.length > 0 && orgLines.length <= 10;
        if (!orgInPanel) {
            gateLines = pen.wrap(atGate, innerW);
            orgLines = [];
        }
        const colBlock = (lines) => 14 + 6 + lines.length * 22;
        const panelH = 20 + 26 + 12 + Math.max(colBlock(gateLines), orgLines.length ? colBlock(orgLines) : 0) + 20;
        ensureSpace(panelH);
        pen.roundRect(PAD, y, CONTENT_W, panelH, 12, SOFT_YELLOW);
        heading("Before you go", PAD + 24, y + 20);
        const drawCol = (label, lines, x) => {
            const top = y + 20 + 26 + 12;
            pen.font(PdfFont.Mono, 11).color(MUTED).text(label.toUpperCase(), x, top, 14, { letterSpacing: 0.88 });
            pen.font(PdfFont.Body, 15).color(INK);
            lines.forEach((l, i) => pen.text(l, x, top + 20 + i * 22, 22));
        };
        drawCol("At the gate", gateLines, PAD + 24);
        if (orgLines.length) drawCol("From the organiser", orgLines, PAD + 24 + colW + 24);
        y += panelH + GAP;
        if (goodToKnow && !orgInPanel) flow("From the organiser", goodToKnow, 15, 22, INK);
    }

    // ── Terms & conditions ──
    if (consent) flow("Terms & conditions", consent, 12, 18, MUTED);

    // ── Footer on every page ──
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        const fTop = PAGE_H - PAD - FOOTER_H;
        pen.hr(PAD, fTop, CONTENT_W);
        const textTop = fTop + 1 + 16;
        pen.font(PdfFont.Body, 12).color(MUTED);
        const left = [helpline ? `Event questions: ${helpline}` : "", pages > 1 ? `Page ${p} of ${pages}` : ""]
            .filter(Boolean)
            .join("  ·  ");
        if (left) pen.text(left, PAD, textTop, 16);
        pen.text("Ticketing by Outsold · A product by Sellar.in", PAD + CONTENT_W, textTop, 16, {
            align: "right",
            link: "https://app.outsold.in",
        });
    }
    doc.setPage(1);

    return Buffer.from(doc.output("arraybuffer"));
};

module.exports = { buildTicketPdf };
