export type EventStatus = 'draft' | 'published' | 'completed' | 'cancelled';
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
  category: string;
  status: EventStatus;
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
  salesTrend: SalesTrendPoint[]; // per-event daily revenue, scoped to the selected date range
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

export interface GalleryMediaItem {
  url: string;
  type: 'image' | 'gif' | 'video';
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
  isPrivate: boolean;
  maxTicketsPerOrder: number | null; // null = default cap
  // NEW — only relevant when registrationMode === 'tickets'
  paymentCollectionMode: PaymentCollectionMode;
  //qrImage: string | null;   // base64 preview until uploaded, then https URL after save
  upiId: string;            // e.g. "9870577689@pthdfc"
  payeeName: string;        // optional label shown above QR, e.g. "Phase 1 Registrations"
}