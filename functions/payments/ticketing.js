// Server copies of helpers in src/lib/ticketing.ts — keep in sync.

// Mirrors stripHtmlTags in src/lib/utils.ts so ticket initials match the web.
const stripHtmlTags = (value) => {
    if (!value) return "";
    return String(value)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
        .replace(/<\/?[^>]+(>|$)/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;/gi, "'")
        .replace(/ /g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
};

// "Party Popper" -> "PP"; ASCII only so IDs can be typed at the door.
const getEventInitials = (title) => {
    const words = stripHtmlTags(title)
        .replace(/[^A-Za-z0-9\s]/g, "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (words.length === 0) return "EV";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
};

// Same-name tickets in one order share the lead ticket's doc id.
const assignBookingGroups = (names, docIds) => {
    const leadByName = new Map();
    const countByName = new Map();
    names.forEach((name, i) => {
        const key = String(name || "").trim().toLowerCase();
        if (!key) return;
        if (!leadByName.has(key)) leadByName.set(key, docIds[i]);
        countByName.set(key, (countByName.get(key) || 0) + 1);
    });
    return names.map((name) => {
        const key = String(name || "").trim().toLowerCase();
        return key && (countByName.get(key) || 0) > 1 ? leadByName.get(key) || null : null;
    });
};

const soldOf = (tier) => (Number.isFinite(tier.sold) ? tier.sold : 0);

/**
 * Monotonic ticket numbering. `tiers[].sold` now goes up AND down (gateway
 * seat holds are released when unpaid), so it can't be used for IDs any more.
 * Lazily seeded from Σ sold so it never re-uses a number issued the old way.
 * @return {{ numbers: number[], ticketSeq: number }} ticketSeq = value to write back
 */
const nextTicketNumbers = (eventData, count) => {
    const totalSold = (eventData.tiers || []).reduce((sum, t) => sum + soldOf(t), 0);
    const start = Math.max(Number(eventData.ticketSeq) || 0, totalSold);
    const numbers = Array.from({ length: count }, (_, i) => start + i + 1);
    return { numbers, ticketSeq: start + count };
};

const formatTicketId = (initials, n) => `${initials}-${String(n).padStart(3, "0")}`;

module.exports = {
    stripHtmlTags,
    getEventInitials,
    assignBookingGroups,
    nextTicketNumbers,
    formatTicketId,
    soldOf,
};
