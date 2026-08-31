export type TicketStatus = 'valid' | 'checked_in' | 'cancelled';

export interface Attendee {
  id: string;
  eventId: string;
  name: string;
  email: string;
  phone: string;
  tierName: string;
  ticketTierId?: string;   // NEW — links to TicketTier.id; older docs fall back to tierName
  ticketId: string;        // shown/scanned as the QR payload in a real build
  status: TicketStatus;
  amountPaid?: number;     // NEW — actual amount paid for this ticket
  purchasedAt?: number;    // NEW — ms epoch; source of truth for sale date
  createdAt?: number;      // NEW — ms epoch; fallback when purchasedAt missing
  checkedInAt: string | null; // ISO timestamp
  customFieldAnswers?: Record<string, string>;
  // NEW — how this ticket was paid for. Undefined/'gateway' = normal flow.
  paymentMethod?: 'gateway' | 'manual_qr';
  // NEW — only set when paymentMethod === 'manual_qr'; organizer verifies this at check-in
  screenshotUrl?: string;
}

export const CONFIRMED_TICKET_STATUSES = new Set<TicketStatus>(['valid', 'checked_in']);