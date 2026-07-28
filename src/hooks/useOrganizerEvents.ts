import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import type { PublicEvent } from '../data/mockEvents';

const mapDocToPublicEvent = (id: string, d: any, organizerName: string): PublicEvent => ({
  id,
  title: d.title,
  category: d.category,
  description: d.description,
  date: d.date,
  endDate: d.endDate,
  time: d.time,
  venue: d.venue || '',
  isOnline: d.isOnline,
  organizerName,
  coverImage: d.coverImageUrl || null,
  status: d.status,
  featured: d.featured || false,
  tiers: (d.tiers || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    price: t.price,
    quantity: t.quantity,
    sold: t.sold || 0,
  })),
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
        mapDocToPublicEvent(docSnap.id, docSnap.data(), organizerName)
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

  return { events, loading, toggleLive, toggleFeatured };
};