import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { PublicEvent } from '../data/events';

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
  // NEW
  paymentCollectionMode: d.paymentCollectionMode || 'gateway',
  //qrImageUrl: d.qrImageUrl ?? null,
  upiId: d.upiId || '',
  payeeName: d.payeeName || '',
});

export function usePublicEvents(targetCompanyId?: string | null) {
  const { profile } = useAuth();
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const effectiveCompanyId = targetCompanyId || profile?.companyId;
    if (!effectiveCompanyId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    let unsubscribe = () => {};

    const setup = async () => {
      let organizerName = profile?.organizationName || '';

      // If we are overriding the company ID (e.g. public storefront), fetch the org name
      if (targetCompanyId && targetCompanyId !== profile?.companyId) {
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

      unsubscribe = onSnapshot(publicEventsQuery, (snapshot) => {
        const mapped = snapshot.docs.map((docSnap) =>
          mapDocToPublicEvent(docSnap.id, docSnap.data(), organizerName, effectiveCompanyId)
        );
        setEvents(mapped);
        setLoading(false);
      });
    };

    setup();

    return () => unsubscribe();
  }, [targetCompanyId, profile?.companyId, profile?.organizationName]);

  return { events, loading };
}

export function usePublicEvent(id?: string, targetCompanyId?: string | null) {
  const { events, loading } = usePublicEvents(targetCompanyId);
  const event = id ? events.find((e) => e.id === id) : undefined;
  return { event, loading };
}