const { db } = require("./razorpayClient");

// Keep in sync with isSuperAdmin() in firestore.rules and
// src/constants/superAdmins.ts.
const SUPER_ADMIN_UIDS = ["sR4lj7OfkAc7DhdxfHhuC7XAzLC2", "8ZanoQBNWbeKTfOIVrddKObJuP02"];

// Used until a super admin saves platform/config. The gateway stays OFF so
// nothing is charged before the fee has been set deliberately.
const DEFAULT_CONFIG = {
    gatewayEnabled: false,
    fee: { percent: 0, fixedPerTicket: 0 },
    feeGstRate: 18,
    deductions: { tcsPercent: 0.5, tdsPercent: 0.1 },
};

// eventFeeOverrides/{companyId}__{eventId} — a custom fee for one event,
// set from Super Admin → Payments. Mirrored in src/lib/platformFee.ts.
const eventOverrideId = (companyId, eventId) => `${companyId}__${eventId}`;

const num = (v, fallback) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback);

/**
 * Effective fee/deduction settings for one event:
 * eventFeeOverrides/{companyId}__{eventId}, then platform/config, then defaults.
 * Mirrored client-side in src/lib/platformFee.ts.
 */
const loadFeeConfig = async (companyId, eventId) => {
    const [configSnap, overrideSnap] = await Promise.all([
        db.collection("platform").doc("config").get(),
        db.collection("eventFeeOverrides").doc(eventOverrideId(companyId, eventId)).get(),
    ]);
    const config = configSnap.exists ? configSnap.data() : {};
    const override = overrideSnap.exists ? overrideSnap.data() : {};
    const fee = config.fee || {};
    const deductions = config.deductions || {};
    return {
        gatewayEnabled: config.gatewayEnabled === true,
        percent: num(override.percent, num(fee.percent, DEFAULT_CONFIG.fee.percent)),
        fixedPerTicket: num(override.fixedPerTicket, num(fee.fixedPerTicket, DEFAULT_CONFIG.fee.fixedPerTicket)),
        feeGstRate: num(config.feeGstRate, DEFAULT_CONFIG.feeGstRate),
        tcsPercent: num(override.tcsPercent, num(deductions.tcsPercent, DEFAULT_CONFIG.deductions.tcsPercent)),
        tdsPercent: num(override.tdsPercent, num(deductions.tdsPercent, DEFAULT_CONFIG.deductions.tdsPercent)),
        hasOverride: overrideSnap.exists,
    };
};

const isSuperAdminUid = (uid) => !!uid && SUPER_ADMIN_UIDS.includes(uid);

module.exports = { loadFeeConfig, eventOverrideId, isSuperAdminUid, SUPER_ADMIN_UIDS };
