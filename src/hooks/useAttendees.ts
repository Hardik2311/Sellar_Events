import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Attendee } from '../types/attendee.types';

export function useAttendees(companyId: string | undefined, eventId: string | undefined) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !eventId) {
      setAttendees([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, 'companies', companyId, 'events', eventId, 'attendees'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Attendee[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, any>;
          const rawPurchasedAt = data.purchasedAt ?? data.createdAt;
          const purchasedAtMs =
            rawPurchasedAt instanceof Timestamp
              ? rawPurchasedAt.toMillis()
              : typeof rawPurchasedAt === 'number'
                ? rawPurchasedAt
                : undefined;

          return {
            id: d.id,
            eventId: data.eventId ?? eventId,
            name: data.name ?? '',
            email: data.email ?? '',
            phone: data.phone ?? '',
            tierName: data.tierName ?? '',
            ticketTierId: data.ticketTierId,
            ticketId: data.ticketId ?? d.id,
            status: data.status ?? 'valid',
            amountPaid: Number(data.amountPaid ?? 0),
            purchasedAt: purchasedAtMs,
            createdAt: purchasedAtMs,
            checkedInAt: data.checkedInAt ?? null,
          } as Attendee;
        });
        setAttendees(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsub;
  }, [companyId, eventId]);

  return { attendees, loading, error };
}