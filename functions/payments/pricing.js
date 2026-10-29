// Server copy of the checkout price maths in src/pages/Checkout.tsx
// (lineItemsWithTax / total / per-unit base+tax). Keep the two in sync —
// the server's number is the one Razorpay actually charges.

const roundToInterval = (value, interval) => {
    if (!interval) return Math.round(value);
    return Math.round(value / interval) * interval;
};

const round2 = (n) => Number(n.toFixed(2));

// GST rule for event tickets: a ticket priced below ₹500 is exempt; ₹500
// and above always carries GST at GST_RATE — this is the law, not an
// organizer setting. Based on the ORIGINAL tier price, not a
// referral-discounted one. Mirrored in src/data/events.ts — keep both in sync.
const GST_EXEMPTION_THRESHOLD = 500;
const GST_RATE = 18;

// Mirrors resolveTicketTaxType in src/data/events.ts — exclusive by default,
// inclusive only when the event explicitly chose it.
const resolveTicketTaxType = (eventTaxType) =>
    String(eventTaxType || "").toLowerCase() === "inclusive" ? "inclusive" : "exclusive";

/**
 * Mirrors applyReferralDiscount in src/data/events.ts — keep both in sync.
 * @param {number} unitPrice
 * @param {{discountType: 'percent'|'flat', discountValue: number}} entry
 */
const applyReferralDiscount = (unitPrice, entry) => {
    const raw = entry.discountType === "percent" ?
        unitPrice * (1 - entry.discountValue / 100) :
        unitPrice - entry.discountValue;
    return Math.max(0, round2(raw));
};

/**
 * @param {Array} tiers          event.tiers from Firestore
 * @param {Object} quantities    { [tierId]: qty } from the buyer
 * @param {Object} taxSettings   companies/{cid}/settings/general (rounding only)
 * @param {Object} [referralEntry] matched referralCodes[] entry, if any
 * @param {string} [eventTaxType] event.taxType — 'inclusive' | 'exclusive' (default)
 * @return {Object} line items (with per-unit amounts), total and tax labels
 */
const computeOrderPricing = (tiers, quantities, taxSettings, referralEntry, eventTaxType) => {
    const settings = taxSettings || {};
    const taxType = resolveTicketTaxType(eventTaxType);
    const taxRate = GST_RATE;

    const lineItems = [];
    (tiers || []).forEach((tier) => {
        const rawQty = quantities ? quantities[tier.id] : 0;
        const qty = Number.isInteger(rawQty) && rawQty > 0 ? rawQty : 0;
        if (qty === 0) return;

        const rawPrice = Number(tier.price) || 0;
        const unitPrice = referralEntry ? applyReferralDiscount(rawPrice, referralEntry) : rawPrice;
        const unitDiscount = round2(rawPrice - unitPrice);
        let unitBase = unitPrice;
        let unitTax = 0;
        // Exemption is checked against rawPrice (original tier price), not
        // the referral-discounted unitPrice.
        if (rawPrice >= GST_EXEMPTION_THRESHOLD) {
            if (taxType === "exclusive") {
                unitTax = unitPrice * (taxRate / 100);
            } else {
                unitBase = unitPrice / (1 + taxRate / 100);
                unitTax = unitPrice - unitBase;
            }
        }
        lineItems.push({
            tierId: tier.id,
            tierName: tier.name,
            tierPrice: rawPrice,
            qty,
            unitTotal: round2(unitBase + unitTax),
            unitBase: round2(unitBase),
            unitTax: round2(unitTax),
            unitDiscount,
            itemTotal: (unitBase + unitTax) * qty,
        });
    });

    const subtotal = lineItems.reduce((s, it) => s + it.itemTotal, 0);
    const total = settings.enableRounding ?
        roundToInterval(subtotal, settings.roundingInterval || 1) :
        subtotal;

    return {
        lineItems,
        totalQty: lineItems.reduce((s, it) => s + it.qty, 0),
        total: round2(total),
        amountPaise: Math.round(total * 100),
        taxRate,
        taxTypeLabel: taxType === "exclusive" ? "Exclusive" : "Inclusive",
    };
};

/**
 * Platform fee the BUYER pays on top of the tickets, plus GST on that fee.
 * Per paid ticket: unitBase × percent% + fixed — the ticket price before
 * GST, so the ticket's own GST never attracts a fee. Free tickets carry no fee.
 * Mirrored in src/lib/platformFee.ts — keep in sync.
 * @param {Array} lineItems  computeOrderPricing().lineItems
 * @param {Object} cfg       loadFeeConfig() result
 * @return {{ perTicketFee: Object, platformFee: number, platformFeeGst: number }}
 *   perTicketFee is keyed by tierId: { fee, gst } for one ticket of that tier.
 */
const computePlatformFee = (lineItems, cfg) => {
    const perTicketFee = {};
    let platformFee = 0;
    lineItems.forEach((it) => {
        const fee = it.unitBase > 0 ? round2(it.unitBase * cfg.percent / 100 + cfg.fixedPerTicket) : 0;
        perTicketFee[it.tierId] = { fee, gst: round2(fee * cfg.feeGstRate / 100) };
        platformFee += fee * it.qty;
    });
    platformFee = round2(platformFee);
    return { perTicketFee, platformFee, platformFeeGst: round2(platformFee * cfg.feeGstRate / 100) };
};

/**
 * What the platform withholds from the organizer's payout as an e-commerce
 * operator: GST TCS (sec 52, only for GST-registered organizers) and
 * income-tax TDS (sec 194-O), both on the tickets' taxable value (excl. GST).
 * The platform fee itself is charged to the BUYER (see computePlatformFee /
 * buyerTotal in createRazorpayOrder.js), not deducted here.
 */
const computeDeductions = (lineItems, ticketsTotal, cfg, organizerHasGstin) => {
    const taxableValue = round2(lineItems.reduce((s, it) => s + it.unitBase * it.qty, 0));
    const tcs = organizerHasGstin ? round2(taxableValue * cfg.tcsPercent / 100) : 0;
    const tds = round2(taxableValue * cfg.tdsPercent / 100);
    return { taxableValue, tcs, tds, organizerNet: round2(ticketsTotal - tcs - tds) };
};

module.exports = { computeOrderPricing, computePlatformFee, computeDeductions, applyReferralDiscount, round2 };
