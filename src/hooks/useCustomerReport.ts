import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useEventFilter } from '../components/ui/EventdateFilter';
import { useAttendees } from './useAttendees';
import { fetchEventDashboardData } from '../lib/fetchEventDashboardData';
import { CONFIRMED_TICKET_STATUSES } from '../types/attendee.types';
import type { EventSummary } from '../types/event.types';
import { ALL_EVENTS_ID } from '../components/EventListCard';

const formatDateForInput = (d: Date) => d.toISOString().split('T')[0];

export interface CustomerRow {
  key: string;
  name: string;
  phone: string;
  email: string;
  tiersBought: string[];
  ticketsBought: number;
  totalSpent: number;
  lastPurchase: number;
}

export type CustomerSortKey = 'name' | 'ticketsBought' | 'totalSpent' | 'lastPurchase';

export function useCustomerReport(companyId: string | undefined, initialEventId?: string) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventSearch, setEventSearch] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialEventId ?? null);

  useEffect(() => {
    const load = async () => {
      if (!companyId) return;
      try {
        const data = await fetchEventDashboardData({
          companyId,
          startDate: '2000-01-01',
          endDate: formatDateForInput(new Date()),
          cacheKey: `customer-report-events-${companyId}`,
        });
        setEvents(data.events || []);
      } catch (e) {
        console.error('Failed to load events for customer report', e);
      } finally {
        setEventsLoading(false);
      }
    };
    load();
  }, [companyId]);
  const isAllEvents = selectedEventId === ALL_EVENTS_ID;

  const selectedEvent = useMemo(() => {
    if (isAllEvents) return null; // synthetic — page shows "All Events" via selectedEventId check
    return events.find(e => e.id === selectedEventId) ?? null;
  }, [events, selectedEventId, isAllEvents]);

  const { attendees: singleEventAttendees, loading: singleEventLoading } = useAttendees(
    companyId,
    isAllEvents ? undefined : selectedEventId ?? undefined,
  );

  const [allEventsAttendees, setAllEventsAttendees] = useState<any[]>([]);
  const [allEventsLoading, setAllEventsLoading] = useState(false);

  useEffect(() => {
    if (!isAllEvents || !companyId || events.length === 0) return;

    const loadAll = async () => {
      setAllEventsLoading(true);
      try {
        const results = await Promise.all(
          events.map(async (ev) => {
            const snap = await getDocs(
              collection(db, 'companies', companyId, 'events', ev.id, 'attendees')
            );
            return snap.docs.map((d) => {
              const data: any = d.data();
              const purchasedAtRaw = data.purchasedAt ?? data.createdAt;
              const purchasedAt =
                purchasedAtRaw instanceof Timestamp ? purchasedAtRaw.toMillis() : purchasedAtRaw;
              return { id: d.id, ...data, purchasedAt };
            });
          })
        );
        setAllEventsAttendees(results.flat());
      } catch (err) {
        console.error('Failed to load all-events attendees', err);
        setAllEventsAttendees([]);
      } finally {
        setAllEventsLoading(false);
      }
    };

    loadAll();
  }, [isAllEvents, companyId, events]);

  const attendees = isAllEvents ? allEventsAttendees : singleEventAttendees;
  const attendeesLoading = isAllEvents ? allEventsLoading : singleEventLoading;

  const { filters } = useEventFilter();
  const { startDate, endDate } = filters;

  const appliedFilters = useMemo(() => {
    if (!startDate || !endDate) return null;
    const s = new Date(startDate); s.setHours(0, 0, 0, 0);
    const e = new Date(endDate); e.setHours(23, 59, 59, 999);
    return { start: s.getTime(), end: e.getTime() };
  }, [startDate, endDate]);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: CustomerSortKey; direction: 'asc' | 'desc' }>({
    key: 'totalSpent', direction: 'desc',
  });

  const handleSort = (key: CustomerSortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const { filtered, summary } = useMemo(() => {
    if (!appliedFilters)
      return {
        filtered: [] as CustomerRow[],
        summary: { totalCustomers: 0, totalRevenue: 0, topCustomerByTickets: null as CustomerRow | null },
      };

    const confirmed = attendees.filter(a =>
      CONFIRMED_TICKET_STATUSES.has(a.status) &&
      !!a.purchasedAt &&
      a.purchasedAt! >= appliedFilters.start &&
      a.purchasedAt! <= appliedFilters.end,
    );

    const groups = new Map<string, CustomerRow>();
    for (const a of confirmed) {
      const key = (a.phone && a.phone.trim()) || (a.email && a.email.trim()) || a.id;
      const existing = groups.get(key);
      if (existing) {
        existing.ticketsBought += 1;
        existing.totalSpent += a.amountPaid || 0;
        existing.lastPurchase = Math.max(existing.lastPurchase, a.purchasedAt!);
        if (a.tierName && !existing.tiersBought.includes(a.tierName)) existing.tiersBought.push(a.tierName);
      } else {
        groups.set(key, {
          key,
          name: a.name || 'N/A',
          phone: a.phone || '—',
          email: a.email || '—',
          tiersBought: a.tierName ? [a.tierName] : [],
          ticketsBought: 1,
          totalSpent: a.amountPaid || 0,
          lastPurchase: a.purchasedAt!,
        });
      }
    }

    let list = Array.from(groups.values());

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    }

    list = [...list].sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      const va = a[sortConfig.key];
      const vb = b[sortConfig.key];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });

    const totalRevenue = list.reduce((s, c) => s + c.totalSpent, 0);
    const topCustomerByTickets = list.reduce<CustomerRow | null>((top, c) => {
      if (!top || c.ticketsBought > top.ticketsBought) return c;
      return top;
    }, null);

    return {
      filtered: list,
      summary: { totalCustomers: list.length, totalRevenue, topCustomerByTickets },
    };
  }, [attendees, appliedFilters, searchQuery, sortConfig]);

  return {
    events, eventsLoading, eventSearch, setEventSearch,
    selectedEventId, setSelectedEventId, selectedEvent,
    attendeesLoading,
    startDate, endDate, appliedFilters,
    searchQuery, setSearchQuery,
    sortConfig, handleSort,
    filtered, summary,
  };
}