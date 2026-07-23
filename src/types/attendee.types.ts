export type TicketStatus = 'valid' | 'checked_in' | 'cancelled';

export interface Attendee {
  id: string;
  eventId: string;
  name: string;
  email: string;
  phone: string;
  tierName: string;
  ticketId: string; // shown/scanned as the QR payload in a real build
  status: TicketStatus;
  checkedInAt: string | null; // ISO timestamp
}