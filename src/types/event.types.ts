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
}

export interface SalesTrendPoint {
  date: string;
  revenue: number;
}

// Shape the dashboard page works with as a whole.
// When backend is wired, this is what `fetchDashboardData` should resolve to.
export interface EventDashboardData {
  events: EventSummary[];
  salesTrend: SalesTrendPoint[];
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
  tierEndDate?: string; // YYYY-MM-DD — only used when the company setting is ON
  tierEndTime?: string; // HH:mm — only used when the company setting is ON
}

export const REGISTRATION_MODES = ['tickets', 'rsvp'] as const;
export type RegistrationMode = (typeof REGISTRATION_MODES)[number];
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
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  venue: string;
  isOnline: boolean;
  images: string[];
  titleStyle: TextStyleConfig;
  descriptionStyle: TextStyleConfig;
  // NEW — dedicated cover slots, separate from the gallery `images` above
  coverImageDesktop: string | null;
  coverImageMobile: string | null;
  // NEW — past-events media strip (photos/gifs/compressed videos)
  pastEventsGallery: GalleryMediaItem[];
  tiers: TicketTierDraft[];
  promoCode: string;
  promoDiscountPercent: number;
  // NEW — how attendees sign up for this event
  registrationMode: RegistrationMode;
  customFields: CustomField[];
  rsvpLink: string;          // e.g. Google Form URL, only used when registrationMode === 'rsvp'
  rsvpButtonLabel: string;   // e.g. "RSVP Now" / "Register" — organizer-editable CTA text
}