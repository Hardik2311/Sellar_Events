// ─── Event Domain Types ───────────────────────────────────────────────────────
// These mirror how `CatalogueDashboardData` / item types are shaped in the
// catalogue app, so backend wiring later follows the same pattern
// (fetchDashboardData -> transform -> setData).

export type EventStatus = 'draft' | 'published' | 'completed' | 'cancelled';

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

export const EVENT_CATEGORIES = ['Music', 'Comedy', 'Workshop', 'Networking', 'Market', 'Sports', 'Other'] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export interface TicketTierDraft {
  id: string;
  name: string;
  price: number;
  quantity: number;
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
  coverImagePreview: string | null;
  tiers: TicketTierDraft[];
  promoCode: string;
  promoDiscountPercent: number;
}