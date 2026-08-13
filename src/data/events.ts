export interface PublicTicketTier {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sold: number;
}

export interface PublicEvent {
  id: string;
  companyId: string;
  title: string;
  category: string;
  customCategory?: string;
  description: string;
  date: string; // start date, ISO yyyy-mm-dd
  endDate: string;
  time: string; // 24hr HH:mm
  venue: string;
  isOnline: boolean;
  organizerName: string;
  coverImage: string | null;  // kept for back-compat = images[0]
  images: string[];           // NEW — full gallery
  tiers: PublicTicketTier[];
  status: 'draft' | 'published' | 'completed' | 'cancelled';
  featured?: boolean;
  registrationMode?: 'tickets' | 'rsvp';
  rsvpLink?: string;
  rsvpButtonLabel?: string;
}

export const CATEGORY_GRADIENTS: Record<string, string> = {
  Comedy: 'from-orange-200 to-amber-100',
  Music: 'from-rose-200 to-orange-100',
  Workshop: 'from-sky-200 to-orange-50',
  Networking: 'from-emerald-200 to-orange-50',
  Other: 'from-slate-200 to-orange-50',
};

export const getCategoryLabel = (e: PublicEvent) =>
  e.category === 'Other' && e.customCategory ? e.customCategory : e.category;

export const formatDateRange = (start: string, end: string) => {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const s = new Date(start).toLocaleDateString('en-IN', opts);
  if (start === end) return s;
  const e = new Date(end).toLocaleDateString('en-IN', opts);
  return `${s} \u2013 ${e}`;
};

export const formatTime = (time: string) => {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
};

export const getPriceLabel = (tiers: PublicTicketTier[]) => {
  if (!tiers.length) return 'Free';
  const lowest = Math.min(...tiers.map((t) => t.price));
  return lowest === 0 ? 'Free' : `From \u20B9${lowest.toLocaleString('en-IN')}`;
};

export const getAvailability = (tiers: PublicTicketTier[]) => {
  const totalQty = tiers.reduce((sum, t) => sum + t.quantity, 0);
  const totalSold = tiers.reduce((sum, t) => sum + t.sold, 0);
  const pct = totalQty ? Math.round((totalSold / totalQty) * 100) : 0;
  return { pct, soldOut: totalQty > 0 && totalSold >= totalQty, sellingFast: pct >= 80 && totalSold < totalQty };
};

// Picks the event to lead with on the discover page: an explicitly
// featured, published event first; otherwise (if autoFeatureNearest is
// on) the soonest upcoming one.
export const getFeaturedEvent = (
  events: PublicEvent[],
  autoFeatureNearest: boolean = true
): PublicEvent | undefined => {
  const flagged = events.find((e) => e.featured);
  if (flagged) return flagged;
  if (!autoFeatureNearest) return undefined;
  return [...events].sort((a, b) => a.date.localeCompare(b.date))[0];
};
// "--" is safe as a separator: Firestore auto-ids never contain hyphens,
// so splitting on the *last* "--" reliably recovers the id even if the
// title itself contains single hyphens.
export const generateSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

export const buildEventSlugId = (title: string, id: string) => `${generateSlug(title)}--${id}`;

export const parseEventIdFromSlug = (slugId: string) => {
  const idx = slugId.lastIndexOf('--');
  return idx === -1 ? slugId : slugId.slice(idx + 2);
};