import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// Same logic jo CheckoutPage.tsx me hai — "Party Popper" -> "PP" etc.
export const getEventInitials = (title: string): string => {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'EV';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
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

/**
 * Creates a single on-the-spot attendee, mirroring CheckoutPage's
 * transaction: increments tier.sold and generates the same
 * INITIALS-000 style ticketId, all inside one Firestore transaction
 * so it can never oversell relative to concurrent purchases.
 */
export async function createWalkInAttendee(input: WalkInAttendeeInput): Promise<string> {
  const {
    companyId, eventId, eventTitle, tierId, tierName,
    name, email, phone, amountPaid, paymentMode,
    markCheckedIn, allowOverbook, customFieldAnswers = {},
  } = input;

  const eventRef = doc(db, 'companies', companyId, 'events', eventId);
  const attendeeRef = doc(collection(db, 'companies', companyId, 'events', eventId, 'attendees'));
  const initials = getEventInitials(eventTitle);

  let ticketId = '';

  await runTransaction(db, async (transaction) => {
    const eventSnap = await transaction.get(eventRef);
    if (!eventSnap.exists()) throw new Error('Event no longer exists.');

    const currentTiers = (eventSnap.data().tiers || []) as {
      id: string; name: string; price: number; quantity: number; sold: number;
    }[];

    const tier = currentTiers.find((t) => t.id === tierId);
    if (!tier) throw new Error('Selected ticket tier no longer exists.');

    const currentSold = Number.isFinite(tier.sold) ? tier.sold : 0;
    const remaining = tier.quantity - currentSold;

    if (remaining <= 0 && !allowOverbook) {
      throw new Error(`"${tier.name}" has no tickets remaining.`);
    }

    const updatedTiers = currentTiers.map((t) =>
      t.id === tierId ? { ...t, sold: currentSold + 1 } : t
    );

    const totalAlreadySold = currentTiers.reduce(
      (sum, t) => sum + (Number.isFinite(t.sold) ? t.sold : 0), 0
    );
    ticketId = `${initials}-${String(totalAlreadySold + 1).padStart(3, '0')}`;

    transaction.update(eventRef, { tiers: updatedTiers });

    transaction.set(attendeeRef, {
      name,
      email,
      phone,
      tierName,
      ticketTierId: tierId,
      customFieldAnswers,
      amountPaid,
      paymentMode,
      isWalkIn: true, // reporting ke liye — open question #3 ka jawab
      ticketId,
      status: markCheckedIn ? 'checked_in' : 'valid',
      checkedInAt: markCheckedIn ? serverTimestamp() : null,
      createdAt: serverTimestamp(),
      purchasedAt: serverTimestamp(),
    });
  });

  return ticketId;
}