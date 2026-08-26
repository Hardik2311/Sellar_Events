import { useEffect, useMemo, useState } from 'react';
import { useEventFilter } from '../components/ui/EventdateFilter';
import { useAttendees } from './useAttendees';
import { fetchEventDashboardData } from '../lib/fetchEventDashboardData';
import { CONFIRMED_TICKET_STATUSES, type Attendee } from '../types/attendee.types';
import type { EventSummary } from '../types/event.types';

const formatDateForInput = (d: Date) => d.toISOString().split('T')[0];

export type SalesSortKey = 'purchasedAt' | 'name' | 'tierName' | 'amountPaid';

export function useSalesReport(companyId: string | undefined, initialEventId?: string) {
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
          cacheKey: `sales-report-events-${companyId}`,
        });
        setEvents(data.events || []);
      } catch (e) {
        console.error('Failed to load events for sales report', e);
      } finally {
        setEventsLoading(false);
      }
    };
    load();
  }, [companyId]);

  const selectedEvent = useMemo(
    () => events.find(e => e.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const { attendees, loading: attendeesLoading } = useAttendees(companyId, selectedEventId ?? undefined);

  const { filters } = useEventFilter();
  const { startDate, endDate } = filters;

  const appliedFilters = useMemo(() => {
    if (!startDate || !endDate) return null;
    const s = new Date(startDate); s.setHours(0, 0, 0, 0);
    const e = new Date(endDate); e.setHours(23, 59, 59, 999);
    return { start: s.getTime(), end: e.getTime() };
  }, [startDate, endDate]);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SalesSortKey; direction: 'asc' | 'desc' }>({
    key: 'purchasedAt', direction: 'desc',
  });

  const handleSort = (key: SalesSortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const { filtered, summary } = useMemo(() => {
    if (!appliedFilters) return { filtered: [] as Attendee[], summary: { total: 0, ticketsSold: 0 } };

    let list = attendees.filter(a =>
      CONFIRMED_TICKET_STATUSES.has(a.status) &&
      !!a.purchasedAt &&
      a.purchasedAt! >= appliedFilters.start &&
      a.purchasedAt! <= appliedFilters.end,
    );

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.tierName.toLowerCase().includes(q) ||
        a.phone.toLowerCase().includes(q)
      );
    }

    list = [...list].sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      const va = a[sortConfig.key] ?? '';
      const vb = b[sortConfig.key] ?? '';
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });

    const total = list.reduce((s, a) => s + (a.amountPaid || 0), 0);
    return { filtered: list, summary: { total, ticketsSold: list.length } };
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