import type { CustomField, TextStyleConfig } from '../types/event.types';
import { stripHtmlTags } from '../lib/utils';
export interface PublicTicketTier {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sold: number;
  dummyRemaining?: number | null;
  tierEndDate?: string | null; // YYYY-MM-DD
  tierEndTime?: string | null; // HH:mm
}
export interface GalleryMediaItem {
  url: string;
  type: 'image' | 'gif' | 'video';
}
// NEW — one entry per generated share code; old codes are kept, not overwritten
export interface AccessCodeEntry {
  code: string;
  createdAt: string;    // ISO timestamp
  createdFor?: string;  // optional label, e.g. who it was shared with (future use)
  expiresAt?: string | null; // ISO timestamp; null/undefined = never expires
  maxTickets?: number | null; // cap on tickets bought in the one order this code is used for
  usedCount?: number; // total tickets booked with this code so far
  usedAt?: string | null; // ISO timestamp of the successful purchase that consumed this code — once set, the code is single-use and dead for any further purchase
}
export type ReferralDiscountType = 'percent' | 'flat';

// NEW — organizer-typed, reusable discount codes (not single-use, unlike
// AccessCodeEntry). Usage stats are computed live from attendee docs, never
// stored here — see useAttendees-based grouping on the event detail page and
// in useSalesReport.ts.
export interface ReferralCodeEntry {
  code: string;
  label: string;
  discountType: ReferralDiscountType;
  discountValue: number; // percent (0-100) or flat rupees
  createdAt: string;
  // Names this code had before being renamed. Sold tickets keep the code they
  // were bought with, so stats follow these; checkout only accepts `code`.
  previousCodes?: string[];
}

/** The code entry a sold ticket's referralCode belongs to, following renames. */
export const findReferralCodeEntry = <T extends { code: string; previousCodes?: string[] }>(
  entries: T[] | undefined,
  soldCode: string
): T | undefined => {
  const code = soldCode.trim().toUpperCase();
  return entries?.find((e) => e.code.trim().toUpperCase() === code || !!e.previousCodes?.includes(code));
};

const round2 = (n: number): number => Number(n.toFixed(2));

// GST rule for event tickets: a ticket priced below ₹500 is exempt; ₹500
// and above always carries GST at GST_RATE — this is the law, not an
// organizer setting. Based on the ORIGINAL tier price, not a
// referral-discounted one. Mirrored in functions/payments/pricing.js —
// keep both in sync.
export const GST_EXEMPTION_THRESHOLD = 500;
export const GST_RATE = 18;

// The one tax choice the organizer makes, per event: whether the ticket
// price already includes GST or GST is added on top at checkout.
export type TicketTaxType = 'inclusive' | 'exclusive';

// Exclusive is the default — including for events created before taxType
// was a per-event field. Only an explicit 'inclusive' choice is inclusive.
export const resolveTicketTaxType = (eventTaxType?: string | null): TicketTaxType =>
  String(eventTaxType || '').toLowerCase() === 'inclusive' ? 'inclusive' : 'exclusive';

// Shared so the client (Checkout.tsx) and server (functions/payments/pricing.js)
// apply referral discounts identically — keep both in sync.
export const applyReferralDiscount = (
  unitPrice: number,
  entry: Pick<ReferralCodeEntry, 'discountType' | 'discountValue'>
): number => {
  const raw =
    entry.discountType === 'percent'
      ? unitPrice * (1 - entry.discountValue / 100)
      : unitPrice - entry.discountValue;
  return Math.max(0, round2(raw));
};

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
  images: string[];
  // NEW
  coverImageDesktop: string | null;
  coverImageMobile: string | null;
  pastEventsGallery: GalleryMediaItem[];
  tiers: PublicTicketTier[];
  status: 'draft' | 'published' | 'completed' | 'cancelled' | 'deleted';
  featured?: boolean;
  deletedAt?: string | null;
  isPrivate?: boolean;
  everPublished?: boolean;
  registrationMode?: 'tickets' | 'rsvp';
  rsvpLink?: string;
  rsvpButtonLabel?: string;
  customFields: CustomField[];
  titleStyle?: TextStyleConfig;
  descriptionStyle?: TextStyleConfig;
  consentText?: string;
  consentStyle?: TextStyleConfig;
  goodToKnowText?: string;        // NEW
  goodToKnowStyle?: TextStyleConfig; // NEW
  paymentCollectionMode?: 'gateway' | 'manual_qr';
  taxType?: TicketTaxType | null; // null on events created before it was per-event; priced as exclusive — see resolveTicketTaxType()
  //qrImageUrl?: string | null;
  upiId?: string;
  payeeName?: string;
  creditExpiresAt?: string | null;
  accessCodes?: AccessCodeEntry[]; // ALL valid share codes ever generated for this event
  ticketSeq?: number; // last ticket number issued — see nextTicketNumbers() in lib/ticketing.ts
  maxTicketsPerOrder?: number; // cap on tickets a single buyer can select in one order; undefined = default cap (10)
  // NEW — shown on the attendee's acknowledgement ticket/PDF
  arriveByTime?: string | null;
  ageLimit?: string | null;
  helplineNumber?: string | null;
  // NEW — organizer-set "Mark as Sold Out" toggle, independent of actual
  // tier capacity. See isSalesClosed() below.
  manuallySoldOut?: boolean;
  // NEW — referral codes feature. referralDiscount* are the event-level
  // defaults used only to pre-fill a new code's form; each code stores its
  // own resolved discountType/discountValue.
  referralCodesEnabled?: boolean;
  referralCodes?: ReferralCodeEntry[];
  referralDiscountType?: ReferralDiscountType;
  referralDiscountValue?: number;
}
// NEW — how long a single event credit keeps an event published for
export const EVENT_CREDIT_VALIDITY_DAYS = 90; // ~3 months

export const getNewCreditExpiry = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + EVENT_CREDIT_VALIDITY_DAYS);
  return d.toISOString();
};

// True once the current credit's 3-month window has run out (or was
// never set — e.g. an old event created before this feature existed
// gets treated as "needs a fresh credit" the next time it's published).
export const isCreditExpired = (event: Pick<PublicEvent, 'creditExpiresAt'>): boolean => {
  if (!event.creditExpiresAt) return true;
  return new Date(event.creditExpiresAt).getTime() < Date.now();
};

export const formatCreditExpiry = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
// NEW — deleted events are hard-deleted (permanently removed from Firestore)
// automatically once they've sat in the Deleted tab for this many days.
export const HARD_DELETE_AFTER_DAYS = 30;

// True once a soft-deleted event has passed its 30-day grace window and is
// eligible for permanent removal. Events with no deletedAt (shouldn't happen
// for status === 'deleted', but just in case) are treated as NOT yet eligible
// so we never delete something by accident.
export const isPastHardDeleteWindow = (event: Pick<PublicEvent, 'status' | 'deletedAt'>): boolean => {
  if (event.status !== 'deleted' || !event.deletedAt) return false;
  const deletedAtMs = new Date(event.deletedAt).getTime();
  if (isNaN(deletedAtMs)) return false;
  const daysSinceDelete = (Date.now() - deletedAtMs) / (1000 * 60 * 60 * 24);
  return daysSinceDelete >= HARD_DELETE_AFTER_DAYS;
};
// Default per-order cap when the organizer hasn't set one.
export const DEFAULT_MAX_TICKETS_PER_ORDER = 10;

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
export const isTierExpired = (tier: Pick<PublicTicketTier, 'tierEndDate' | 'tierEndTime'>) => {
  if (!tier.tierEndDate) return false;
  const end = new Date(`${tier.tierEndDate}T${tier.tierEndTime || '23:59'}:00`);
  return !isNaN(end.getTime()) && end.getTime() < Date.now();
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

// True once new ticket bookings should stop being accepted — either the
// organizer manually marked the event "Sold Out", or every tier is actually
// out of stock. Used to show the "Sold Out" badge AND to actually block
// Checkout/booking, not just the visual label.
export const isSalesClosed = (
  event: Pick<PublicEvent, 'tiers' | 'manuallySoldOut'>
): boolean => {
  if (event.manuallySoldOut) return true;
  if (getAvailability(event.tiers).soldOut) return true;
  return false;
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
    .replace(/[^a-z0-9-]/g, '')
    // Dropped emoji/punctuation can leave stray hyphens ("🪔 Diwali" -> "-diwali")
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const buildEventSlugId = (title: string, id: string) => `${generateSlug(stripHtmlTags(title))}--${id}`;

export const parseEventIdFromSlug = (slugId: string) => {
  const idx = slugId.lastIndexOf('--');
  return idx === -1 ? slugId : slugId.slice(idx + 2);
};

// NEW — generates a random access code (used by "Share Link" action)
export const generateAccessCode = (length: number = 6): string => {
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

// NEW — builds the shareable URL, optionally embedding the code as a query param
// so a single tap can auto-fill the gate (still re-verified server-side)
export const buildShareUrl = (title: string, id: string, code?: string): string => {
  const base = `${window.location.origin}/e/${buildEventSlugId(title, id)}`;
  return code ? `${base}?code=${code}` : base;
};
