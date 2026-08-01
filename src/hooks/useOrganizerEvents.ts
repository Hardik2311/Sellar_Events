import { useState, useEffect } from 'react';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import type { PublicEvent } from '../data/events';
import type { EventFormState } from '../types/event.types';

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
  status: d.status,
  featured: d.featured || false,
  tiers: (d.tiers || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    price: t.price,
    quantity: t.quantity,
    sold: t.sold || 0,
  })),
  // NEW — defaults keep old docs (no field written yet) behaving as ticketed
  registrationMode: d.registrationMode || 'tickets',
  rsvpLink: d.rsvpLink || '',
  rsvpButtonLabel: d.rsvpButtonLabel || 'RSVP Now',
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
    });

    return () => unsubscribe();
  }, [profile?.companyId, profile?.organizationName]);

  const toggleLive = async (id: string, currentStatus: string) => {
    if (!profile?.companyId) return;
    const newStatus = currentStatus === 'published' ? 'draft' : 'published';
    await updateDoc(doc(db, 'companies', profile.companyId, 'events', id), { status: newStatus });
  };

  const toggleFeatured = async (id: string, currentFeatured: boolean) => {
    if (!profile?.companyId) return;
    await updateDoc(doc(db, 'companies', profile.companyId, 'events', id), { featured: !currentFeatured });
  };

  const deleteEvent = async (id: string) => {
    if (!profile?.companyId) return;
    await deleteDoc(doc(db, 'companies', profile.companyId, 'events', id));
  };

  const updateEvent = async (id: string, form: EventFormState) => {
    if (!profile?.companyId) return;

    // Preserve `sold` counts for existing tiers; new tiers start at 0
    const existingEvent = events.find((e) => e.id === id);
    const tiers = form.tiers.map((t) => {
      const existingTier = existingEvent?.tiers.find((et) => et.id === t.id);
      return {
        id: t.id,
        name: t.name,
        price: t.price,
        quantity: t.quantity,
        sold: existingTier?.sold ?? 0,
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
      coverImageUrls: form.images,
      coverImageUrl: form.images[0] || null,
      registrationMode: form.registrationMode,
      rsvpLink: form.rsvpLink,
      rsvpButtonLabel: form.rsvpButtonLabel,
    };

    if (form.registrationMode === 'tickets') {
      payload.tiers = tiers;
    }

    await updateDoc(doc(db, 'companies', profile.companyId, 'events', id), payload);
  };

  return { events, loading, toggleLive, toggleFeatured, deleteEvent, updateEvent };
};