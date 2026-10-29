// Platform fee + payout-deduction settings and maths. The server copy in
// functions/payments/{platformConfig,pricing}.js is what actually charges the
// buyer — keep the two in sync. This one only previews the amounts.

export interface PlatformConfigDoc {
  gatewayEnabled?: boolean;
  fee?: { percent?: number; fixedPerTicket?: number };
  feeGstRate?: number;
  deductions?: { tcsPercent?: number; tdsPercent?: number };
  platformLegalName?: string;
  platformGstin?: string;
}

// eventFeeOverrides/{companyId}__{eventId} — custom fee for one event.
export interface PlatformFeeOverrideDoc {
  companyId?: string;
  eventId?: string;
  eventTitle?: string;
  percent?: number | null;
  fixedPerTicket?: number | null;
  tcsPercent?: number | null;
  tdsPercent?: number | null;
  note?: string;
}

export interface EffectiveFeeConfig {
  gatewayEnabled: boolean;
  percent: number;
  fixedPerTicket: number;
  feeGstRate: number;
  tcsPercent: number;
  tdsPercent: number;
}

export const eventFeeOverrideId = (companyId: string, eventId: string) => `${companyId}__${eventId}`;

// Same defaults as functions/payments/platformConfig.js: gateway OFF until a
// super admin saves the settings.
export const DEFAULT_FEE_CONFIG: EffectiveFeeConfig = {
  gatewayEnabled: false,
  percent: 0,
  fixedPerTicket: 0,
  feeGstRate: 18,
  tcsPercent: 0.5,
  tdsPercent: 0.1,
};

const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;

export const resolveFeeConfig = (
  config?: PlatformConfigDoc | null,
  override?: PlatformFeeOverrideDoc | null
): EffectiveFeeConfig => {
  const c = config ?? {};
  const o = override ?? {};
  return {
    gatewayEnabled: c.gatewayEnabled === true,
    percent: num(o.percent, num(c.fee?.percent, DEFAULT_FEE_CONFIG.percent)),
    fixedPerTicket: num(o.fixedPerTicket, num(c.fee?.fixedPerTicket, DEFAULT_FEE_CONFIG.fixedPerTicket)),
    feeGstRate: num(c.feeGstRate, DEFAULT_FEE_CONFIG.feeGstRate),
    tcsPercent: num(o.tcsPercent, num(c.deductions?.tcsPercent, DEFAULT_FEE_CONFIG.tcsPercent)),
    tdsPercent: num(o.tdsPercent, num(c.deductions?.tdsPercent, DEFAULT_FEE_CONFIG.tdsPercent)),
  };
};

export const round2 = (n: number) => Number(n.toFixed(2));

/**
 * Buyer-paid platform fee for an order. Per paid ticket:
 * unitBase × percent% + fixed, where unitBase is the ticket price before GST;
 * free tickets carry no fee. GST on the total fee.
 */
export const computePlatformFee = (
  items: { unitBase: number; qty: number }[],
  cfg: Pick<EffectiveFeeConfig, 'percent' | 'fixedPerTicket' | 'feeGstRate'>
): { platformFee: number; platformFeeGst: number } => {
  let fee = 0;
  items.forEach(({ unitBase, qty }) => {
    if (unitBase > 0) fee += round2(unitBase * cfg.percent / 100 + cfg.fixedPerTicket) * qty;
  });
  const platformFee = round2(fee);
  return { platformFee, platformFeeGst: round2(platformFee * cfg.feeGstRate / 100) };
};

const formatAmount = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** "2% + ₹5 per ticket + 18% GST" */
export const describeFee = (cfg: Pick<EffectiveFeeConfig, 'percent' | 'fixedPerTicket' | 'feeGstRate'>): string => {
  const parts: string[] = [];
  if (cfg.percent > 0) parts.push(`${formatAmount(cfg.percent)}%`);
  if (cfg.fixedPerTicket > 0) parts.push(`₹${formatAmount(cfg.fixedPerTicket)}`);
  if (parts.length === 0) return 'No platform fee';
  return `${parts.join(' + ')} per ticket + ${formatAmount(cfg.feeGstRate)}% GST`;
};
