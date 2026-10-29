export type EventStatus = 'draft' | 'published' | 'completed' | 'cancelled' | 'deleted';
export type CustomFieldType = 'text' | 'textarea' | 'select' | 'checkbox';
export interface CustomField {
  id: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  options?: string[]; // only used when type === 'select'
}
export interface TicketTier {
  id: string;
  name: string;
  price: number;
  sold: number;
  total: number;
}

export interface EventSummary {
  id: string;
  title: string;
  coverImage?: string;
  posterImage?: string;            // portrait-first cover, for the ticket poster hero
  category: string;
  status: EventStatus;
  time?: string;
  startDate: string; // ISO date string
  venue: string;
  ticketsSold: number;
  ticketsTotal: number;
  revenue: number;
  description?: string;   // customer-facing summary, shown on EventDetails
  accentColor?: string;
  tiers: TicketTier[];
  customFields?: CustomField[];
  registrationMode?: RegistrationMode;
  isOnline?: boolean;        // NEW — hides "Get directions" on the ticket PDF
  isPrivate?: boolean;       // NEW — hides "Book more tickets" on the ticket PDF
  goodToKnowText?: string;   // NEW — "Before the Event" checklist
  consentText?: string; // organizer's "Important information & consent" text, shown on the PDF acknowledgement
  arriveByTime?: string | null;    // NEW — shown on the PDF acknowledgement
  ageLimit?: string | null;        // NEW — shown on the PDF acknowledgement
  helplineNumber?: string | null;  // NEW — shown on the PDF acknowledgement
  salesTrend: SalesTrendPoint[]; // per-event daily revenue, scoped to the selected date range
  // NEW — organizer's manual UPI QR details, for showing a scannable QR
  // when collecting a walk-in payment in person
  upiId?: string;
  payeeName?: string;
  taxType?: TicketTaxTypeOption | null; // walk-in total uses the same GST rule as checkout
  // NEW — referral codes feature; full entries (not just labels) so Sales
  // Report can show discount type/value per code without a second fetch.
  referralCodesEnabled?: boolean;
  referralCodes?: { code: string; label: string; discountType: ReferralDiscountTypeOption; discountValue: number; previousCodes?: string[] }[];
  referralDiscountType?: ReferralDiscountTypeOption;
  referralDiscountValue?: number;
}

export interface SalesTrendPoint {
  date: string;
  revenue: number;
}

export interface EventDashboardData {
  events: EventSummary[];
}

// ─── Create Event form types ──────────────────────────────────────────────────
// Separate from TicketTier/EventSummary above because a draft tier has no
// `sold` count yet — that only exists once an order has been placed.
export interface TextStyleConfig {
  fontSize: number;                 // px
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;                    // hex, e.g. '#111827'
}

export const DEFAULT_TEXT_STYLE: TextStyleConfig = {
  fontSize: 16,
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#111827',
};
export const EVENT_CATEGORIES = ['Music', 'Comedy', 'Workshop', 'Networking', 'Market', 'Sports', 'Other'] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export interface TicketTierDraft {
  id: string;
  name: string;
  price: number;
  quantity: number;
  dummyRemaining?: number;
  tierEndDate?: string; // YYYY-MM-DDe only used when the company setting is ON
  tierEndTime?: string; // HH:mm — only used when the company setting is ON
}

export const REGISTRATION_MODES = ['tickets', 'rsvp'] as const;
export type RegistrationMode = (typeof REGISTRATION_MODES)[number];

// NEW
export const PAYMENT_COLLECTION_MODES = ['gateway', 'manual_qr'] as const;
export type PaymentCollectionMode = (typeof PAYMENT_COLLECTION_MODES)[number];

// NEW — referral codes feature. Duplicated (not imported) from
// ReferralDiscountType in data/events.ts to avoid a circular import, since
// events.ts already imports from this file.
export type ReferralDiscountTypeOption = 'percent' | 'flat';

// Same reason — mirrors TicketTaxType in data/events.ts.
export type TicketTaxTypeOption = 'inclusive' | 'exclusive';

export interface GalleryMediaItem {
  /** Storage URL once saved; a data: or blob: preview URL while the form is open. */
  url: string;
  type: 'image' | 'gif' | 'video';
  /** Form-only: the compressed file waiting to be uploaded (videos). Never written to Firestore. */
  file?: Blob;
}
export interface EventFormState {
  title: string;
  category: EventCategory;
  customCategory: string;
  endDate: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  isOnline: boolean;
  images: string[];
  titleFontSize: number;
  descriptionFontSize: number;
  consentFontSize: number;
  goodToKnowFontSize: number;
  coverImageDesktop: string | null;
  coverImageMobile: string | null;
  pastEventsGallery: GalleryMediaItem[];
  tiers: TicketTierDraft[];
  promoCode: string;
  promoDiscountPercent: number;
  registrationMode: RegistrationMode;
  customFields: CustomField[];
  rsvpLink: string;
  rsvpButtonLabel: string;
  consentText: string;
  goodToKnowText: string;
  isPrivate: boolean;
  maxTicketsPerOrder: number | null; // null = default cap
  // NEW — shown on the attendee's acknowledgement ticket/PDF
  arriveByTime: string;      // HH:mm, 24hr — "please arrive by" time; blank = not shown
  ageLimit: string;          // free text e.g. "16+", "All ages"; blank = not shown
  helplineNumber: string;    // organizer contact number for "Need help?"; blank = not shown
  // NEW — only relevant when registrationMode === 'tickets'
  paymentCollectionMode: PaymentCollectionMode;
  //qrImage: string | null;   // base64 preview until uploaded, then https URL after save
  upiId: string;            // e.g. "9870577689@pthdfc"
  payeeName: string;        // optional label shown above QR, e.g. "Phase 1 Registrations"
  // Required for ticketed events; new events start as 'exclusive'.
  // GST itself (18% on tickets ≥ ₹500) isn't optional; only how it's shown is.
  taxType: TicketTaxTypeOption | null;
  // NEW — per-event toggle + default discount that pre-fills new referral codes
  referralCodesEnabled: boolean;
  referralDiscountType: ReferralDiscountTypeOption;
  referralDiscountValue: number;
}