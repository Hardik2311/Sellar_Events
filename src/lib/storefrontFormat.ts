// Date, time and money formatting for the customer storefront pages.
// Follows the storefront copy rules: "Sat, 12 Oct", "7 PM", "₹1,038",
// "₹499 onwards", "to" for ranges (no en/em dashes).

const toDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`);

// "2026-10-12" -> "Sat, 12 Oct"
export const formatShortDate = (iso: string) => {
  const d = toDate(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

// "2026-10-12" -> "Saturday, 12 October 2026"
export const formatLongDate = (iso: string) => {
  const d = toDate(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

// Single day -> "Sat, 12 Oct"; multi-day -> "Sat, 12 Oct to Mon, 14 Oct"
export const formatShortDateRange = (start: string, end?: string) =>
  end && end !== start ? `${formatShortDate(start)} to ${formatShortDate(end)}` : formatShortDate(start);

export const formatLongDateRange = (start: string, end?: string) =>
  end && end !== start ? `${formatShortDate(start)} to ${formatShortDate(end)}` : formatLongDate(start);

// "19:00" -> "7 PM", "19:30" -> "7:30 PM"
export const formatShortTime = (time?: string | null) => {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h)) return time;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour12}:${String(m).padStart(2, '0')} ${period}` : `${hour12} ${period}`;
};

// 1038 -> "₹1,038", 1038.5 -> "₹1,038.50", 0 -> "Free"
export const formatRupees = (amount: number, { zeroAsFree = true } = {}) => {
  if (zeroAsFree && amount === 0) return 'Free';
  const hasPaise = Math.round(amount * 100) % 100 !== 0;
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: hasPaise ? 2 : 0,
  })}`;
};

// Tier prices -> "₹499", "₹499 onwards" or "Free"
export const formatStartingPrice = (prices: number[]) => {
  if (prices.length === 0) return 'Free';
  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);
  if (highest === 0) return 'Free';
  if (lowest === 0) return 'Free and paid';
  return lowest === highest ? formatRupees(lowest) : `${formatRupees(lowest, { zeroAsFree: false })} onwards`;
};
