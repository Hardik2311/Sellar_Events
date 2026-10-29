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
  // NEW — the referral code this ticket was booked with, if any, and the ₹
  // actually saved on it (for the organizer's per-code stats/Sales Report)
  referralCode?: string | null;
  referralDiscountAmount?: number;
  // NEW — shared by tickets booked in one order under the same name; the
  // group gets one QR (the lead ticket's ticketId) and partial check-in.
  bookingGroupId?: string | null;
  // Shared by every ticket in one non-gateway purchase (free Checkout, manual
  // QR, walk-in), whatever the names. Free bookings are emailed as one message
  // by it; the Attendees page uses it (or orderId) for "booked together" check-in.
  bookingId?: string | null;
  // Set server-side by Super Admin → Send Tickets (functions/email/sendTicketEmail.js)
  // and by the automatic post-checkout email (functions/email/autoSendTicketEmail.js)
  ticketEmail?: TicketEmailStatus | null;
}

export interface TicketEmailStatus {
  status: 'sent' | 'failed';
  sentAt?: number;   // ms epoch
  failedAt?: number; // ms epoch
  error?: string;
  manual?: boolean;  // marked as sent by hand (emailed outside the app)
  auto?: boolean;    // sent automatically after checkout (functions/email/autoSendTicketEmail.js)
  to?: string;
}

export const CONFIRMED_TICKET_STATUSES = new Set<TicketStatus>(['valid', 'checked_in']);