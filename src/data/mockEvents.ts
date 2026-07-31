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
  coverImage: string | null;
  tiers: PublicTicketTier[];
  // Organizer-controlled publish state. Only 'published' events should ever
  // reach the customer-facing pages — filter by this once the API is wired.
  // (If you already have `EventStatus` defined in your dashboard types file,
  // import that here instead of redeclaring the union, so there's one
  // source of truth.)
  status: 'draft' | 'published' | 'completed' | 'cancelled';
  // Explicitly curated by the organizer/admin — not derived from sales or
  // date. Falls back to "soonest upcoming event" if nothing is flagged.
  featured?: boolean;
  // NEW — how attendees sign up. Optional + defaulted to 'tickets' at the
  // mapping layer (mapDocToPublicEvent) so existing docs without this field
  // keep behaving as ticketed events.
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
// featured, published event first; otherwise the soonest upcoming one.
export const getFeaturedEvent = (events: PublicEvent[]): PublicEvent | undefined => {
  const flagged = events.find((e) => e.featured);
  if (flagged) return flagged;
  return [...events].sort((a, b) => a.date.localeCompare(b.date))[0];
};