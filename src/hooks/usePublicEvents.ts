import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { isCreditExpired, type PublicEvent } from '../data/events';
import { getStorefrontSeed } from '../lib/storefrontData';

const mapDocToPublicEvent = (id: string, d: any, organizerName: string, companyId: string): PublicEvent => ({
  id,
  companyId,
  title: d.title,
  category: d.category,
  description: d.description,
  date: d.date,
  endDate: d.endDate,
  time: d.time,
  venue: d.venue || '',
  isOnline: d.isOnline,
  organizerName,
  coverImage: d.coverImageUrls?.[0] || d.coverImageUrl || null,
  images: d.coverImageUrls || (d.coverImageUrl ? [d.coverImageUrl] : []),
  // NEW
  coverImageDesktop: d.coverImageDesktop ?? null,
  coverImageMobile: d.coverImageMobile ?? null,
  pastEventsGallery: d.pastEventsGallery ?? [],
  status: d.status,
  featured: d.featured || false,
  isPrivate: d.isPrivate || false,
  accessCodes: d.accessCodes ?? [],
  creditExpiresAt: d.creditExpiresAt ?? null, // NEW
  manuallySoldOut: d.manuallySoldOut || false, // NEW
  referralCodesEnabled: d.referralCodesEnabled || false, // NEW
  referralCodes: d.referralCodes ?? [], // NEW
  everPublished: d.everPublished || false,
  tiers: (d.tiers || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    price: t.price,
    quantity: t.quantity,
    sold: t.sold || 0,
    dummyRemaining: typeof t.dummyRemaining === 'number' ? t.dummyRemaining : null,
    tierEndDate: t.tierEndDate ?? null,
    tierEndTime: t.tierEndTime ?? null,
  })),
  // NEW — keep in sync with useOrganizerEvents.ts
  registrationMode: d.registrationMode || 'tickets',
  rsvpLink: d.rsvpLink || '',
  rsvpButtonLabel: d.rsvpButtonLabel || 'RSVP Now',
  customFields: d.customFields || [],
  titleStyle: d.titleStyle ?? undefined,
  descriptionStyle: d.descriptionStyle ?? undefined,
    consentText: d.consentText ?? undefined,
  consentStyle: d.consentStyle ?? undefined,
  goodToKnowText: d.goodToKnowText ?? undefined,
  goodToKnowStyle: d.goodToKnowStyle ?? undefined,
  // See useOrganizerEvents.ts — missing/legacy field must default to manual_qr,
  // not 'gateway' (the unwired mock payment path).
  paymentCollectionMode: d.paymentCollectionMode || 'manual_qr',
  taxType: d.taxType ?? null,
  //qrImageUrl: d.qrImageUrl ?? null,
  upiId: d.upiId || '',
  payeeName: d.payeeName || '',
   maxTicketsPerOrder: typeof d.maxTicketsPerOrder === 'number' ? d.maxTicketsPerOrder : undefined,
  arriveByTime: d.arriveByTime ?? null,
  ageLimit: d.ageLimit ?? null,
  helplineNumber: d.helplineNumber ?? null,
});

// Events the server sent with this storefront page (see lib/storefrontData.ts).
const seededEvents = (companyId?: string | null) => {
  const seed = companyId ? getStorefrontSeed(companyId) : null;
  if (!seed?.events) return null;
  const organizerName = seed.company.organizationName || seed.company.name || '';
  return {
    organizerName,
    events: seed.events
      .map(({ id, data }) => mapDocToPublicEvent(id, data, organizerName, seed.companyId))
      .filter((e) => !isCreditExpired(e)),
  };
};

export function usePublicEvents(targetCompanyId?: string | null) {
  const { profile } = useAuth();
  // allEvents = published events including private ones (needed so a direct
  // shared link + code can still resolve to the event).
  const [allEvents, setAllEvents] = useState<PublicEvent[]>(() => seededEvents(targetCompanyId)?.events ?? []);
  const [loading, setLoading] = useState(() => !seededEvents(targetCompanyId));
  // True while showing what the server sent, until the live listener's first
  // snapshot replaces it. The server never sends a private event's access
  // codes, so codes can only be checked once this is false.
  const [fromServer, setFromServer] = useState(() => !!seededEvents(targetCompanyId));

  useEffect(() => {
    const effectiveCompanyId = targetCompanyId || profile?.companyId;
    if (!effectiveCompanyId) {
      setLoading(false);
      return;
    }

    const seeded = seededEvents(targetCompanyId);
    if (seeded) {
      setAllEvents(seeded.events);
      setFromServer(true);
      setLoading(false);
    } else {
      setFromServer(false);
      setLoading(true);
    }

    let unsubscribe = () => { };

    const setup = async () => {
      let organizerName = seeded?.organizerName || profile?.organizationName || '';

      // If we are overriding the company ID (e.g. public storefront), fetch the org name
      if (!seeded && targetCompanyId && targetCompanyId !== profile?.companyId) {
        try {
          const companySnap = await getDoc(doc(db, 'companies', effectiveCompanyId));
          if (companySnap.exists()) {
            organizerName = companySnap.data().organizationName || companySnap.data().name || '';
          }
        } catch (err) {
          console.error("Failed to fetch company details:", err);
        }
      }

      const publicEventsQuery = query(
        collection(db, 'companies', effectiveCompanyId, 'events'),
        where('status', '==', 'published')
      );

      unsubscribe = onSnapshot(
        publicEventsQuery,
        (snapshot) => {
          // When Firestore can't reach its backend it reports an empty
          // from-cache result after ~10s; that must not replace what the
          // server already sent with the page.
          if (seeded && snapshot.metadata.fromCache) return;
          const mapped = snapshot.docs
            .map((docSnap) => mapDocToPublicEvent(docSnap.id, docSnap.data(), organizerName, effectiveCompanyId))
            // NEW — hide events whose credit validity has run out even if the
            // organizer hasn't opened their dashboard yet to trigger the
            // status flip to 'draft'. Effectively "already unpublished".
            .filter((e) => !isCreditExpired(e));
          setAllEvents(mapped);
          setFromServer(false);
          setLoading(false);
        },
        (err) => {
          // Without this a failed listener left `loading` true forever, so the
          // page sat on its skeleton instead of showing "not available".
          console.error('Failed to load published events:', err);
          setLoading(false);
        }
      );
    };

    setup();

    return () => unsubscribe();
  }, [targetCompanyId, profile?.companyId, profile?.organizationName]);

  // Customer-facing listing must never show private events — they should
  // only be reachable via a direct shared link + access code.
  const events = allEvents.filter((e) => !e.isPrivate);

  return { events, loading, allEvents, fromServer };
}

export function usePublicEvent(id?: string, targetCompanyId?: string | null) {
  // Use allEvents (not the filtered list) — a private event's direct link
  // must still resolve; verifyAccessCode() is what gates access to it.
  const { allEvents, loading, fromServer } = usePublicEvents(targetCompanyId);
  const event = id ? allEvents.find((e) => e.id === id) : undefined;
  return { event, loading, fromServer };
}

// Whether a code may OPEN the private event page. A code that has already
// bought tickets still unlocks viewing — the buyer can come back to the event
// as often as they like. Buying again is blocked separately: see
// isAccessCodeUsed() on the page, and the CODE_ALREADY_USED check inside the
// checkout transactions, which is the real enforcement.
export function verifyAccessCode(event: PublicEvent, enteredCode: string): boolean {
  if (!event.isPrivate) return true; // public events don't need a code at all
  if (!event.accessCodes || event.accessCodes.length === 0) return false; // private, but organizer hasn't generated any code yet — deny by default
  const cleaned = enteredCode.trim().toUpperCase();
  return event.accessCodes.some(
    (entry) =>
      entry.code.trim().toUpperCase() === cleaned &&
      (!entry.expiresAt || new Date(entry.expiresAt).getTime() > Date.now())
  );
}

// Codes are single-use for purchases: true once this code has bought tickets.
export function isAccessCodeUsed(event: PublicEvent, code: string | null | undefined): boolean {
  if (!event.isPrivate || !code) return false;
  const cleaned = code.trim().toUpperCase();
  return !!event.accessCodes?.some((entry) => entry.code.trim().toUpperCase() === cleaned && !!entry.usedAt);
}