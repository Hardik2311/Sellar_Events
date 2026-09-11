import { useState, useEffect } from 'react';
import { addDoc, arrayUnion, collection, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { generateAccessCode, isCreditExpired, getNewCreditExpiry, type PublicEvent } from '../data/events';
import { DEFAULT_TEXT_STYLE, type EventFormState } from '../types/event.types';

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
  coverImageDesktop: d.coverImageDesktop ?? null,
  coverImageMobile: d.coverImageMobile ?? null,
  pastEventsGallery: d.pastEventsGallery ?? [],
  status: d.status,
  featured: d.featured || false,
  deletedAt: d.deletedAt ?? null,
  isPrivate: d.isPrivate || false,
  creditExpiresAt: d.creditExpiresAt ?? null, // NEW
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
  // NEW — defaults keep old docs (no field written yet) behaving as ticketed
  registrationMode: d.registrationMode || 'tickets',
  rsvpLink: d.rsvpLink || '',
  rsvpButtonLabel: d.rsvpButtonLabel || 'RSVP Now',
  customFields: d.customFields || [],
  titleStyle: d.titleStyle ?? undefined,
  consentText: d.consentText ?? undefined,
  consentStyle: d.consentStyle ?? undefined,
  descriptionStyle: d.descriptionStyle ?? undefined,
  paymentCollectionMode: d.paymentCollectionMode || 'gateway',
  //qrImageUrl: d.qrImageUrl ?? null,
  upiId: d.upiId || '',
  payeeName: d.payeeName || '',
    accessCodes: d.accessCodes ?? [],
  everPublished: d.everPublished || false, // NEW — true once event has been published at least once; drives free re-toggle logic
});

export const useOrganizerEvents = () => {
  const { profile } = useAuth();
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.companyId) return;

    const eventsQuery = query(
      collection(db, 'companies', profile.companyId, 'events'),
      orderBy('createdAt', 'desc')
    );

        const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      const organizerName = profile.organizationName || '';
      const mapped = snapshot.docs.map((docSnap) =>
        mapDocToPublicEvent(docSnap.id, docSnap.data(), organizerName, profile.companyId)
      );
      setEvents(mapped);
      setLoading(false);

      // NEW — lazy auto-unpublish: there's no server cron, so whichever
      // organizer's dashboard loads next after a credit's 3-month window
      // has lapsed flips that event back to Draft. Customer-facing side
      // (usePublicEvents) also filters expired events out independently,
      // so attendees never see a stale published event either way.
      mapped
        .filter((e) => e.status === 'published' && isCreditExpired(e))
        .forEach((e) => {
          updateDoc(doc(db, 'companies', profile.companyId, 'events', e.id), {
            status: 'draft',
          }).catch((err) => console.error('Failed to auto-expire event:', err));
        });
    });

    return () => unsubscribe();
  }, [profile?.companyId, profile?.organizationName]);

      const toggleLive = async (id: string, currentStatus: string) => {
    if (!profile?.companyId) return;
    const newStatus = currentStatus === 'published' ? 'draft' : 'published';
    const eventRef = doc(db, 'companies', profile.companyId, 'events', id);

        if (newStatus === 'published') {
      const companyRef = doc(db, 'companies', profile.companyId);
      await runTransaction(db, async (transaction) => {
        // Read the event doc INSIDE the transaction — never trust local
        // React state here, since that's what makes this bypass-proof.
        const eventSnap = await transaction.get(eventRef);
        const data = eventSnap.data();

        // Free re-publish ONLY while the last credit's 3-month validity
        // window hasn't lapsed yet. Once it expires, going live again is
        // treated exactly like a fresh publish and consumes another credit.
        const stillWithinValidity = !isCreditExpired({ creditExpiresAt: data?.creditExpiresAt ?? null });

        if (stillWithinValidity) {
          transaction.update(eventRef, { status: newStatus });
          return;
        }

        // Credit expired (or never published) — this publish must cost a credit.
        const companySnap = await transaction.get(companyRef);
        const currentCredits = companySnap.data()?.eventCredits ?? 0;

        if (currentCredits < 1) {
          throw new Error('NO_CREDITS');
        }

        transaction.update(eventRef, {
          status: newStatus,
          everPublished: true,
          creditExpiresAt: getNewCreditExpiry(), // resets the 3-month clock
        });
        transaction.update(companyRef, { eventCredits: currentCredits - 1 });
      });
    } else {
      // Draft par wapas laana free hai — koi refund bhi nahi.
      // NOTE: we intentionally do NOT clear creditExpiresAt here — if the
      // organizer manually pauses and re-publishes within the 3-month
      // window, that should still be free.
      await updateDoc(eventRef, { status: newStatus });
    }
  };

  const toggleFeatured = async (id: string, currentFeatured: boolean) => {
    if (!profile?.companyId) return;
    const nextFeatured = !currentFeatured;
    const batch = writeBatch(db);
    const eventRef = doc(db, 'companies', profile.companyId, 'events', id);
    batch.update(eventRef, { featured: nextFeatured });

    // Ek time pe sirf ek hi event featured ho sakta hai —
    // isko ON kar rahe hain to baaki sab jo already featured hain unko OFF karo
    if (nextFeatured) {
      events
        .filter((e) => e.id !== id && e.featured)
        .forEach((e) => {
          const otherRef = doc(db, 'companies', profile.companyId, 'events', e.id);
          batch.update(otherRef, { featured: false });
        });
    }

    await batch.commit();
  };

  /// NEW — generates a fresh access code for a private event and ADDS it to the
  // existing list (old codes stay valid too). Called every time the organizer
  // clicks "Share Link" for a private event.
  const regenerateAccessCode = async (id: string): Promise<string> => {
    if (!profile?.companyId) throw new Error('No company context');
    const code = generateAccessCode(); // single source of truth — same generator used everywhere

    // NOTE: serverTimestamp() can't be used INSIDE an array element, so we use
    // a plain client-side ISO timestamp for entries pushed via arrayUnion.
    await updateDoc(doc(db, 'companies', profile.companyId, 'events', id), {
      accessCodes: arrayUnion({ code, createdAt: new Date().toISOString() }),
    });
    return code;
  };
  const deleteEvent = async (id: string) => {
    if (!profile?.companyId) return;
    // Soft delete — doc stays in Firestore so it can be restored; a Cloud
    // Function can hard-delete anything past deletedAt + N days later.
    await updateDoc(doc(db, 'companies', profile.companyId, 'events', id), {
      status: 'deleted',
      deletedAt: serverTimestamp(),
    });
  };

  const restoreEvent = async (id: string) => {
    if (!profile?.companyId) return;
    // Restored events come back as Draft — organizer republishes manually
    await updateDoc(doc(db, 'companies', profile.companyId, 'events', id), {
      status: 'draft',
      deletedAt: null,
    });
  };

  const duplicateEvent = async (id: string) => {
    if (!profile?.companyId) return;
    const original = events.find((e) => e.id === id);
    if (!original) return;

    // New copy always starts as an unpublished, unfeatured draft with
    // ticket `sold` counts reset — everything else carries over as-is.
    const payload: Record<string, any> = {
      title: `Copy of ${original.title}`,
      category: original.category,
      description: original.description,
      date: original.date,
      endDate: original.endDate,
      time: original.time,
      venue: original.venue,
      isOnline: original.isOnline,
      coverImageUrls: original.images,
      coverImageUrl: original.coverImage || null,
      coverImageDesktop: original.coverImageDesktop || null,
      coverImageMobile: original.coverImageMobile || null,
      pastEventsGallery: original.pastEventsGallery || [],
      titleStyle: original.titleStyle ?? null,
      descriptionStyle: original.descriptionStyle ?? null,
      status: 'draft',
      featured: false,
      registrationMode: original.registrationMode,
      rsvpLink: original.rsvpLink,
      rsvpButtonLabel: original.rsvpButtonLabel,
      customFields: original.customFields || [],
      tiers: original.tiers.map((t) => ({
        id: t.id,
        name: t.name,
        price: t.price,
        quantity: t.quantity,
        sold: 0,
        dummyRemaining: t.dummyRemaining ?? null,
        tierEndDate: t.tierEndDate ?? null,
        tierEndTime: t.tierEndTime ?? null,
      })),
      paymentCollectionMode: original.paymentCollectionMode ?? 'gateway',
      //qrImageUrl: original.qrImageUrl ?? null,
      upiId: original.upiId ?? null,
      payeeName: original.payeeName ?? null,
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, 'companies', profile.companyId, 'events'), payload);
  };

  const updateEvent = async (id: string, form: EventFormState) => {
    if (!profile?.companyId) return;
    // Preserve `sold` counts for existing tiers; new tiers start at 0.
    // dummyRemaining / tierEndDate / tierEndTime all come straight from the
    // form — Firestore rejects `undefined`, so each falls back to null.
    const existingEvent = events.find((e) => e.id === id);
    const tiers = form.tiers.map((t) => {
      const existingTier = existingEvent?.tiers.find((et) => et.id === t.id);
      return {
        id: t.id,
        name: t.name,
        price: t.price,
        quantity: t.quantity,
        sold: existingTier?.sold ?? 0,
        dummyRemaining: t.dummyRemaining ?? null,
        tierEndDate: t.tierEndDate ?? null,
        tierEndTime: t.tierEndTime ?? null,
      };
    });

    const payload: Record<string, any> = {
      title: form.title,
      category: form.category === 'Other' ? form.customCategory.trim() : form.category,
      description: form.description,
      date: form.date,
      endDate: form.endDate,
      time: form.time,
      venue: form.venue,
      isOnline: form.isOnline,
      isPrivate: form.isPrivate,
      coverImageUrls: form.images,
      coverImageUrl: form.images[0] || null,
      coverImageDesktop: form.coverImageDesktop || null,
      coverImageMobile: form.coverImageMobile || null,
      pastEventsGallery: form.pastEventsGallery || [],
      registrationMode: form.registrationMode,
      rsvpLink: form.rsvpLink,
      rsvpButtonLabel: form.rsvpButtonLabel,
      customFields: form.customFields || [],
      titleStyle: {
        ...DEFAULT_TEXT_STYLE,
        ...existingEvent?.titleStyle,
        fontSize: form.titleFontSize,
      },
      descriptionStyle: {
        ...DEFAULT_TEXT_STYLE,
        ...existingEvent?.descriptionStyle,
        fontSize: form.descriptionFontSize,
      },
      consentText: form.consentText.trim() || null,
      consentStyle: form.consentText.trim()
        ? { ...DEFAULT_TEXT_STYLE, ...existingEvent?.consentStyle, fontSize: form.consentFontSize }
        : null,
      // NEW — only meaningful for ticketed events; null-out otherwise so stale
      // QR/UPI data doesn't linger if the organizer switches back to RSVP or gateway
      paymentCollectionMode: form.registrationMode === 'tickets' ? form.paymentCollectionMode : null,
      // qrImageUrl: form.registrationMode === 'tickets' && form.paymentCollectionMode === 'manual_qr'
      //   ? form.qrImage
      //   : null,
      upiId: form.registrationMode === 'tickets' && form.paymentCollectionMode === 'manual_qr'
        ? form.upiId.trim()
        : null,
      payeeName: form.registrationMode === 'tickets' && form.paymentCollectionMode === 'manual_qr'
        ? form.payeeName.trim()
        : null,
    };

    if (form.registrationMode === 'tickets') {
      payload.tiers = tiers;
    }

    await updateDoc(doc(db, 'companies', profile.companyId, 'events', id), payload);
  };

  return { events, loading, toggleLive, toggleFeatured, deleteEvent, restoreEvent, duplicateEvent, updateEvent, regenerateAccessCode };
};