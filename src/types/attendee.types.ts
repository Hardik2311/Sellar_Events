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
  screenshotUrl?: string | null;
  // Set only on tickets issued by the Razorpay Cloud Functions after a
  // verified online payment (functions/payments/fulfillOrder.js).
  razorpayPaymentId?: string;
  orderId?: string;
  paymentMode?: 'Cash' | 'UPI' | 'Card' | 'Netbanking' | 'Other';
 source?: 'ticket' | 'walk_in' | 'import';
  // NEW — the private-event access code this ticket was booked with, if any
  accessCode?: string | null;
  // NEW — shared by tickets booked in one order under the same name; the
  // group gets one QR (the lead ticket's ticketId) and partial check-in.
  bookingGroupId?: string | null;
  // Set server-side by Super Admin → Send Tickets (functions/email/sendTicketEmail.js)
  ticketEmail?: TicketEmailStatus | null;
}

export interface TicketEmailStatus {
  status: 'sent' | 'failed';
  sentAt?: number;   // ms epoch
  failedAt?: number; // ms epoch
  error?: string;
  manual?: boolean;  // marked as sent by hand (emailed outside the app)
  to?: string;
}

export const CONFIRMED_TICKET_STATUSES = new Set<TicketStatus>(['valid', 'checked_in']);