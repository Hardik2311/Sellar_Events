// Server copy of the checkout price maths in src/pages/Checkout.tsx
// (lineItemsWithTax / total / per-unit base+tax). Keep the two in sync —
// the server's number is the one Razorpay actually charges.

const roundToInterval = (value, interval) => {
    if (!interval) return Math.round(value);
    return Math.round(value / interval) * interval;
};

const round2 = (n) => Number(n.toFixed(2));

/**
 * @param {Array} tiers          event.tiers from Firestore
 * @param {Object} quantities    { [tierId]: qty } from the buyer
 * @param {Object} taxSettings   companies/{cid}/settings/general
 * @return {Object} line items (with per-unit amounts), total and tax labels
 */
const computeOrderPricing = (tiers, quantities, taxSettings) => {
    const settings = taxSettings || {};
    const scheme = String(settings.gstScheme || "none").toLowerCase();
    const taxType = String(settings.taxType || "inclusive").toLowerCase();
    const taxRate = Number(settings.defaultTaxRate) || 0;

    const lineItems = [];
    (tiers || []).forEach((tier) => {
        const rawQty = quantities ? quantities[tier.id] : 0;
        const qty = Number.isInteger(rawQty) && rawQty > 0 ? rawQty : 0;
        if (qty === 0) return;

        const unitPrice = Number(tier.price) || 0;
        let unitBase = unitPrice;
        let unitTax = 0;
        if (scheme === "regular") {
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
            tierPrice: unitPrice,
            qty,
            unitTotal: round2(unitBase + unitTax),
            unitBase: round2(unitBase),
            unitTax: round2(unitTax),
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
        taxTypeLabel: scheme === "regular" ? (taxType === "exclusive" ? "Exclusive" : "Inclusive") : scheme,
    };
};

/**
 * Platform fee the BUYER pays on top of the tickets, plus GST on that fee.
 * Per paid ticket: unitTotal × percent% + fixed. Free tickets carry no fee.
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
        const fee = it.unitTotal > 0 ? round2(it.unitTotal * cfg.percent / 100 + cfg.fixedPerTicket) : 0;
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
 */
const computeDeductions = (lineItems, ticketsTotal, cfg, organizerHasGstin) => {
    const taxableValue = round2(lineItems.reduce((s, it) => s + it.unitBase * it.qty, 0));
    const tcs = organizerHasGstin ? round2(taxableValue * cfg.tcsPercent / 100) : 0;
    const tds = round2(taxableValue * cfg.tdsPercent / 100);
    return { taxableValue, tcs, tds, organizerNet: round2(ticketsTotal - tcs - tds) };
};

module.exports = { computeOrderPricing, computePlatformFee, computeDeductions, round2 };
