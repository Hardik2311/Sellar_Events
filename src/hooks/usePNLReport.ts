import { useEffect, useMemo, useState } from 'react';
import { useEventFilter } from '../components/ui/EventdateFilter';
import { useAttendees } from './useAttendees';
import { useIncomes } from './useIncomes';
import { useExpenses } from './useExpenses';
import { fetchEventDashboardData } from '../lib/fetchEventDashboardData';
import { CONFIRMED_TICKET_STATUSES } from '../types/attendee.types';
import type { EventSummary } from '../types/event.types';

const formatDateForInput = (d: Date) => d.toISOString().split('T')[0];

export interface LedgerRow {
  id: string;
  date: number;
  type: 'Sale' | 'Income' | 'Expense';
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

  const selectedEvent = useMemo(
    () => events.find(e => e.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const { attendees, loading: attendeesLoading } = useAttendees(companyId, selectedEventId ?? undefined);
  const { expenses, loading: expensesLoading } = useExpenses(companyId, selectedEventId ?? undefined);
  const { incomes, loading: incomesLoading } = useIncomes(companyId, selectedEventId ?? undefined);
  const loading = attendeesLoading || expensesLoading || incomesLoading;

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

    let list = [...saleRows, ...incomeRows, ...expenseRows];

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
  }, [attendees, expenses, incomes, appliedFilters, searchQuery, sortConfig]);

  return {
    events, eventsLoading, eventSearch, setEventSearch,
    selectedEventId, setSelectedEventId, selectedEvent,
    loading,
    startDate, endDate, appliedFilters,
    searchQuery, setSearchQuery,
    sortConfig, handleSort,
    filtered, summary,
  };
}