import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { stripHtmlTags } from './utils';

// Turns an event title into short initials for ticket IDs.
// "Party Popper" -> "PP", "Sunburn Festival" -> "SF", "Diwali" (single word) -> "DI"
// ASCII letters/digits only: a title like "🪔✨ Diwali 2.0" used to take
// `w[0]` of the emoji word — half a surrogate pair — which produced an
// invalid string that crashed QR rendering and was saved as "�D2-001".
// Ticket IDs are also typed in by hand at the door, so keep them plain.
export const getEventInitials = (title: string): string => {
  const words = stripHtmlTags(title)
    .replace(/[^A-Za-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'EV';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
};

/**
 * Group booking: tickets bought in ONE order under the same holder name share
 * a `bookingGroupId` (the first ticket's attendee doc id). The customer then
 * gets a single QR — the lead ticket's ticketId — that admits the whole group,
 * and staff check in "N of M arrived" instead of scanning M separate codes.
 * Returns one entry per ticket (same order as `names`); null = not grouped.
 */
export const assignBookingGroups = (names: string[], docIds: string[]): (string | null)[] => {
  const leadByName = new Map<string, string>();
  const countByName = new Map<string, number>();
  names.forEach((name, i) => {
    const key = name.trim().toLowerCase();
    if (!key) return;
    if (!leadByName.has(key)) leadByName.set(key, docIds[i]);
    countByName.set(key, (countByName.get(key) ?? 0) + 1);
  });
  return names.map((name) => {
    const key = name.trim().toLowerCase();
    return key && (countByName.get(key) ?? 0) > 1 ? leadByName.get(key) ?? null : null;
  });
};

/**
 * Next ticket numbers for an event. Uses the monotonic `ticketSeq` counter on
 * the event doc instead of Σ tiers[].sold: Razorpay checkouts hold seats in
 * `sold` and give them back if unpaid, so `sold` can go down and would hand
 * out a number twice. Seeded from Σ sold so it never re-uses an old number.
 * Write the returned `ticketSeq` back in the same transaction.
 * Mirrored in functions/payments/ticketing.js.
 */
export const nextTicketNumbers = (
  eventData: { tiers?: { sold?: number }[]; ticketSeq?: number },
  count: number
): { numbers: number[]; ticketSeq: number } => {
  const totalSold = (eventData.tiers ?? []).reduce(
    (sum, t) => sum + (Number.isFinite(t.sold) ? (t.sold as number) : 0),
    0
  );
  const start = Math.max(Number(eventData.ticketSeq) || 0, totalSold);
  return {
    numbers: Array.from({ length: count }, (_, i) => start + i + 1),
    ticketSeq: start + count,
  };
};

export const formatTicketId = (initials: string, ticketNumber: number): string =>
  `${initials}-${String(ticketNumber).padStart(3, '0')}`;

// Server-side mirror of the frontend's isEventDateInFuture check.
// Never trust the client's markCheckedIn flag alone — a direct API/console
// call could bypass the UI guard entirely.
const isEventDateInFuture = (eventDateValue: unknown): boolean => {
  if (!eventDateValue) return false;
  const eventDate =
    eventDateValue instanceof Date
      ? eventDateValue
      : typeof (eventDateValue as any)?.toDate === 'function'
        ? (eventDateValue as any).toDate() // Firestore Timestamp
        : new Date(eventDateValue as string);

  if (isNaN(eventDate.getTime())) return false;

  const today = new Date();
  eventDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return eventDate.getTime() > today.getTime();
};

export interface WalkInAttendeeInput {
  companyId: string;
  eventId: string;
  eventTitle: string;
  tierId: string;
  tierName: string;
  name: string;
  email: string;
  phone: string;
  amountPaid: number;
  paymentMode: string;
  markCheckedIn: boolean;
  allowOverbook: boolean; // organizer explicitly ticked "Add anyway"
  customFieldAnswers?: Record<string, string>;
}

export interface WalkInAttendeesInput {
  companyId: string;
  eventId: string;
  eventTitle: string;
  tierId: string;
  tierName: string;
  // Per-ticket tierId / tierName / amountPaid override the top-level ones, so
  // one walk-in group can mix tiers (2 × General + 1 × VIP) in one transaction.
  attendees: {
    name: string;
    email: string;
    phone: string;
    tierId?: string;
    tierName?: string;
    amountPaid?: number;
  }[];
  amountPaid: number; // per ticket, same as the singular flow
  paymentMode: string;
  markCheckedIn: boolean;
  allowOverbook: boolean; // organizer explicitly ticked "Add anyway"
  allowOverbookTierIds?: string[]; // per-tier "Add anyway", for mixed-tier groups
  customFieldAnswers?: Record<string, string>;
  screenshotUrl?: string | null; // optional UPI payment proof, shared across the whole group
}

/**
 * Creates one or more on-the-spot attendees in a single Firestore
 * transaction — same approach as CheckoutPage's bulk purchase: increments
 * tier.sold by the whole batch, hands out sequential INITIALS-000 ticketIds
 * via nextTicketNumbers, and (same as a multi-ticket purchase under one
 * buyer) links tickets that share a name under one bookingGroupId so the
 * door can check in "N of M arrived" instead of scanning each one alone.
 * All in one transaction so a walk-in group can never oversell relative to
 * concurrent purchases.
 */
export async function createWalkInAttendees(input: WalkInAttendeesInput): Promise<string[]> {
  const {
    companyId, eventId, eventTitle, tierId, tierName, attendees,
    amountPaid, paymentMode, markCheckedIn, allowOverbook, allowOverbookTierIds = [],
    customFieldAnswers = {}, screenshotUrl = null,
  } = input;

  const count = attendees.length;
  if (count === 0) return [];

  const eventRef = doc(db, 'companies', companyId, 'events', eventId);
  const attendeeRefs = Array.from({ length: count }, () =>
    doc(collection(db, 'companies', companyId, 'events', eventId, 'attendees'))
  );
  const initials = getEventInitials(eventTitle);

  let ticketIds: string[] = [];

  await runTransaction(db, async (transaction) => {
    const eventSnap = await transaction.get(eventRef);
    if (!eventSnap.exists()) throw new Error('Event no longer exists.');

    const eventData = eventSnap.data();

    // Hard block: check-in can never happen before the event's date,
    // no matter what the caller passed in markCheckedIn.
    const effectiveMarkCheckedIn = markCheckedIn && !isEventDateInFuture(eventData.date);

    const currentTiers = (eventData.tiers || []) as {
      id: string; name: string; price: number; quantity: number; sold: number;
    }[];

    // How many tickets this batch takes from each tier.
    const countByTier = new Map<string, number>();
    attendees.forEach((a) => {
      const id = a.tierId ?? tierId;
      countByTier.set(id, (countByTier.get(id) ?? 0) + 1);
    });

    const soldByTier = new Map<string, number>();
    countByTier.forEach((tierCount, id) => {
      const tier = currentTiers.find((t) => t.id === id);
      if (!tier) throw new Error('Selected ticket tier no longer exists.');

      const currentSold = Number.isFinite(tier.sold) ? tier.sold : 0;
      const remaining = tier.quantity - currentSold;

      if (remaining < tierCount && !allowOverbook && !allowOverbookTierIds.includes(id)) {
        throw new Error(
          remaining <= 0
            ? `"${tier.name}" has no tickets remaining.`
            : `"${tier.name}" only has ${remaining} ticket${remaining === 1 ? '' : 's'} remaining.`
        );
      }
      soldByTier.set(id, currentSold + tierCount);
    });

    const updatedTiers = currentTiers.map((t) =>
      soldByTier.has(t.id) ? { ...t, sold: soldByTier.get(t.id)! } : t
    );

    const { numbers, ticketSeq } = nextTicketNumbers(eventData, count);
    ticketIds = numbers.map((n) => formatTicketId(initials, n));

    const bookingGroupIds = assignBookingGroups(
      attendees.map((a) => a.name),
      attendeeRefs.map((r) => r.id)
    );

    transaction.update(eventRef, { tiers: updatedTiers, ticketSeq });

    attendees.forEach((a, i) => {
      transaction.set(attendeeRefs[i], {
        name: a.name,
        email: a.email,
        phone: a.phone,
        tierName: a.tierName ?? tierName,
        ticketTierId: a.tierId ?? tierId,
        customFieldAnswers,
        amountPaid: a.amountPaid ?? amountPaid,
        paymentMode,
        screenshotUrl,
        isWalkIn: true, // reporting ke liye — open question #3 ka jawab
        ticketId: ticketIds[i],
        bookingGroupId: bookingGroupIds[i],
        status: effectiveMarkCheckedIn ? 'checked_in' : 'valid',
        checkedInAt: effectiveMarkCheckedIn ? serverTimestamp() : null,
        createdAt: serverTimestamp(),
        purchasedAt: serverTimestamp(),
      });
    });
  });

  return ticketIds;
}

/** Thin wrapper over createWalkInAttendees for the single-attendee case. */
export async function createWalkInAttendee(input: WalkInAttendeeInput): Promise<string> {
  const { name, email, phone, ...shared } = input;
  const [ticketId] = await createWalkInAttendees({
    ...shared,
    attendees: [{ name, email, phone }],
  });
  return ticketId;
}

export interface SpecialGuestInput {
  companyId: string;
  eventId: string;
  eventTitle: string;
  tierId: string;
  name: string;
  email: string;
  phone: string;
  guestCategory: string; // Singer / Chief Guest / Speaker / Sponsor / VIP / Other
  allowOverbook?: boolean; // organizer explicitly ticked "Add anyway"
}

/**
 * Invites ONE special guest: a free ticket (amountPaid 0) that still takes a
 * seat. In one transaction it bumps tiers[].sold (capacity / public checkout
 * availability stay correct) AND tiers[].guestSold (so revenue can exclude
 * guests: (sold - guestSold) * price). Ticket ID comes from the same
 * ticketSeq counter as walk-ins. Event credits are NOT touched.
 */
export async function createSpecialGuest(
  input: SpecialGuestInput
): Promise<{ ticketId: string; tierName: string }> {
  const {
    companyId, eventId, eventTitle, tierId,
    name, email, phone, guestCategory, allowOverbook = false,
  } = input;

  const eventRef = doc(db, 'companies', companyId, 'events', eventId);
  const attendeeRef = doc(collection(db, 'companies', companyId, 'events', eventId, 'attendees'));
  const initials = getEventInitials(eventTitle);

  let result = { ticketId: '', tierName: '' };

  await runTransaction(db, async (transaction) => {
    const eventSnap = await transaction.get(eventRef);
    if (!eventSnap.exists()) throw new Error('Event no longer exists.');

    const eventData = eventSnap.data();
    const currentTiers = (eventData.tiers || []) as {
      id: string; name: string; price: number; quantity: number; sold: number; guestSold?: number;
    }[];

    const tier = currentTiers.find((t) => t.id === tierId);
    if (!tier) throw new Error('Selected ticket tier no longer exists.');

    const currentSold = Number.isFinite(tier.sold) ? tier.sold : 0;
    if (tier.quantity - currentSold <= 0 && !allowOverbook) {
      throw new Error(`"${tier.name}" has no tickets remaining.`);
    }

    const updatedTiers = currentTiers.map((t) =>
      t.id === tierId
        ? { ...t, sold: currentSold + 1, guestSold: (Number.isFinite(t.guestSold) ? (t.guestSold as number) : 0) + 1 }
        : t
    );

    const { numbers, ticketSeq } = nextTicketNumbers(eventData, 1);
    const ticketId = formatTicketId(initials, numbers[0]);

    transaction.update(eventRef, { tiers: updatedTiers, ticketSeq });

    transaction.set(attendeeRef, {
      name,
      email,
      phone,
      tierName: tier.name,
      ticketTierId: tier.id,
      customFieldAnswers: {},
      amountPaid: 0,
      source: 'special_guest',
      guestCategory,
      ticketId,
      bookingGroupId: null,
      status: 'valid',
      checkedInAt: null,
      createdAt: serverTimestamp(),
      purchasedAt: serverTimestamp(),
    });

    result = { ticketId, tierName: tier.name };
  });

  return result;
}