import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useEventFilter } from '../components/ui/EventdateFilter';
import { useAttendees } from './useAttendees';
import { useIncomes, type Income } from './useIncomes';
import { useExpenses, type Expense } from './useExpenses';
import { fetchEventDashboardData } from '../lib/fetchEventDashboardData';
import { CONFIRMED_TICKET_STATUSES } from '../types/attendee.types';
import type { Attendee } from '../types/attendee.types';
import type { EventSummary } from '../types/event.types';
import { ALL_EVENTS_ID } from '../components/EventListCard';
import { stripHtmlTags } from '../lib/utils';

const formatDateForInput = (d: Date) => d.toISOString().split('T')[0];

export interface LedgerRow {
  id: string;
  date: number;
  type: 'Sale' | 'Income' | 'Expense' | 'Event';
  description: string;
  amount: number;
}

export type PnlSortKey = 'date' | 'type' | 'amount';

export function usePnlReport(companyId: string | undefined, initialEventId?: string) {
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
          cacheKey: `pnl-report-events-${companyId}`,
        });
        setEvents(data.events || []);
      } catch (e) {
        console.error('Failed to load events for PNL report', e);
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

  const { attendees: singleEventAttendees, loading: singleAttendeesLoading } = useAttendees(
    companyId, isAllEvents ? undefined : selectedEventId ?? undefined,
  );
  const { expenses: singleEventExpenses, loading: singleExpensesLoading } = useExpenses(
    companyId, isAllEvents ? undefined : selectedEventId ?? undefined,
  );
  const { incomes: singleEventIncomes, loading: singleIncomesLoading } = useIncomes(
    companyId, isAllEvents ? undefined : selectedEventId ?? undefined,
  );

  // Same "loop over every event with getDocs" pattern used by useCustomerReport's
  // All Events mode — these subcollections live under each event, so there's no
  // single collection to query across all of them at once.
  const [allEventsAttendees, setAllEventsAttendees] = useState<(Attendee & { eventId: string })[]>([]);
  const [allEventsExpenses, setAllEventsExpenses] = useState<(Expense & { eventId: string })[]>([]);
  const [allEventsIncomes, setAllEventsIncomes] = useState<(Income & { eventId: string })[]>([]);
  const [allEventsLoading, setAllEventsLoading] = useState(false);

  useEffect(() => {
    if (!isAllEvents || !companyId || events.length === 0) return;

    const loadAll = async () => {
      setAllEventsLoading(true);
      try {
        const [attendeeResults, expenseResults, incomeResults] = await Promise.all([
          Promise.all(events.map(async (ev) => {
            const snap = await getDocs(collection(db, 'companies', companyId, 'events', ev.id, 'attendees'));
            return snap.docs.map((d) => {
              const data: any = d.data();
              const purchasedAtRaw = data.purchasedAt ?? data.createdAt;
              const purchasedAt = purchasedAtRaw instanceof Timestamp ? purchasedAtRaw.toMillis() : purchasedAtRaw;
              return { id: d.id, eventId: ev.id, ...data, purchasedAt } as Attendee & { eventId: string };
            });
          })),
          Promise.all(events.map(async (ev) => {
            const snap = await getDocs(collection(db, 'companies', companyId, 'events', ev.id, 'expenses'));
            return snap.docs.map((d) => ({ id: d.id, eventId: ev.id, ...d.data() } as Expense & { eventId: string }));
          })),
          Promise.all(events.map(async (ev) => {
            const snap = await getDocs(collection(db, 'companies', companyId, 'events', ev.id, 'incomes'));
            return snap.docs.map((d) => ({ id: d.id, eventId: ev.id, ...d.data() } as Income & { eventId: string }));
          })),
        ]);
        setAllEventsAttendees(attendeeResults.flat());
        setAllEventsExpenses(expenseResults.flat());
        setAllEventsIncomes(incomeResults.flat());
      } catch (err) {
        console.error('Failed to load all-events PNL data', err);
        setAllEventsAttendees([]);
        setAllEventsExpenses([]);
        setAllEventsIncomes([]);
      } finally {
        setAllEventsLoading(false);
      }
    };

    loadAll();
  }, [isAllEvents, companyId, events]);

  const attendees = isAllEvents ? allEventsAttendees : singleEventAttendees;
  const expenses = isAllEvents ? allEventsExpenses : singleEventExpenses;
  const incomes = isAllEvents ? allEventsIncomes : singleEventIncomes;
  const loading = isAllEvents
    ? allEventsLoading
    : singleAttendeesLoading || singleExpensesLoading || singleIncomesLoading;

  const { filters } = useEventFilter();
  const { startDate, endDate } = filters;

  const appliedFilters = useMemo(() => {
    if (!startDate || !endDate) return null;
    const s = new Date(startDate); s.setHours(0, 0, 0, 0);
    const e = new Date(endDate); e.setHours(23, 59, 59, 999);
    return { start: s.getTime(), end: e.getTime() };
  }, [startDate, endDate]);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: PnlSortKey; direction: 'asc' | 'desc' }>({
    key: 'date', direction: 'desc',
  });

  const handleSort = (key: PnlSortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const { filtered, summary } = useMemo(() => {
     if (!appliedFilters) {
      return { filtered: [] as LedgerRow[], summary: { totalSales: 0, totalIncome: 0, totalExpenses: 0, netProfit: 0, ticketsSold: 0 } };
    }

    const saleRows: LedgerRow[] = attendees
      .filter(a =>
        CONFIRMED_TICKET_STATUSES.has(a.status) &&
        !!a.purchasedAt &&
        a.purchasedAt! >= appliedFilters.start &&
        a.purchasedAt! <= appliedFilters.end,
      )
      .map(a => ({
        id: `sale-${a.id}`,
        date: a.purchasedAt!,
        type: 'Sale' as const,
        description: `Ticket — ${a.tierName || 'N/A'} (${a.name || 'N/A'})`,
        amount: a.amountPaid || 0,
      }));

    const incomeRows: LedgerRow[] = incomes
      .filter(inc => inc.date >= appliedFilters.start && inc.date <= appliedFilters.end)
      .map(inc => ({
        id: `inc-${inc.id}`,
        date: inc.date,
        type: 'Income' as const,
        description: inc.source ? `${inc.source} — ${inc.description || ''}`.trim().replace(/—\s*$/, '—') : (inc.description || 'Income'),
        amount: inc.amount || 0,
      }));

    const expenseRows: LedgerRow[] = expenses
      .filter(e => e.date >= appliedFilters.start && e.date <= appliedFilters.end)
      .map(e => ({
        id: `exp-${e.id}`,
        date: e.date,
        type: 'Expense' as const,
        description: e.title || e.description || 'Expense',
        amount: e.amount || 0,
      }));

    let list: LedgerRow[];

    if (isAllEvents) {
      // "All Events" mode shows each event's own profitability as a single
      // row instead of every individual transaction — the per-transaction
      // rows above still feed the totals, just not the visible list.
      const byEvent = new Map<string, { sales: number; income: number; expenses: number; latestDate: number }>();
      const bump = (eventId: string | undefined, key: 'sales' | 'income' | 'expenses', amount: number, date: number) => {
        if (!eventId) return;
        const entry = byEvent.get(eventId) ?? { sales: 0, income: 0, expenses: 0, latestDate: 0 };
        entry[key] += amount;
        entry.latestDate = Math.max(entry.latestDate, date);
        byEvent.set(eventId, entry);
      };
      (attendees as (Attendee & { eventId?: string })[])
        .filter(a =>
          CONFIRMED_TICKET_STATUSES.has(a.status) &&
          !!a.purchasedAt &&
          a.purchasedAt! >= appliedFilters.start &&
          a.purchasedAt! <= appliedFilters.end,
        )
        .forEach(a => bump(a.eventId, 'sales', a.amountPaid || 0, a.purchasedAt!));
      (incomes as (Income & { eventId?: string })[])
        .filter(inc => inc.date >= appliedFilters.start && inc.date <= appliedFilters.end)
        .forEach(inc => bump(inc.eventId, 'income', inc.amount || 0, inc.date));
      (expenses as (Expense & { eventId?: string })[])
        .filter(e => e.date >= appliedFilters.start && e.date <= appliedFilters.end)
        .forEach(e => bump(e.eventId, 'expenses', e.amount || 0, e.date));

      list = Array.from(byEvent.entries()).map(([eventId, totals]) => {
        const event = events.find(ev => ev.id === eventId);
        const netProfit = totals.sales + totals.income - totals.expenses;
        return {
          id: `event-${eventId}`,
          date: totals.latestDate,
          type: 'Event' as const,
          description: event ? stripHtmlTags(event.title) : 'Unknown event',
          amount: netProfit,
        };
      });
    } else {
      list = [...saleRows, ...incomeRows, ...expenseRows];
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => r.description.toLowerCase().includes(q) || r.type.toLowerCase().includes(q));
    }

    list = [...list].sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      const va = a[sortConfig.key];
      const vb = b[sortConfig.key];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });

    const totalSales = saleRows.reduce((s, r) => s + r.amount, 0);
    const totalIncome = incomeRows.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expenseRows.reduce((s, r) => s + r.amount, 0);
    return {
      filtered: list,
      summary: {
        totalSales,
        totalIncome,
        totalExpenses,
        netProfit: totalSales + totalIncome - totalExpenses,
        ticketsSold: saleRows.length,
      },
    };
  }, [attendees, expenses, incomes, appliedFilters, searchQuery, sortConfig, isAllEvents, events]);

  return {
    events, eventsLoading, eventSearch, setEventSearch,
    selectedEventId, setSelectedEventId, selectedEvent, isAllEvents,
    loading,
    startDate, endDate, appliedFilters,
    searchQuery, setSearchQuery,
    sortConfig, handleSort,
    filtered, summary,
  };
}