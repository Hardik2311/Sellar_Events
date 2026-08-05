import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, Loader2, Eye, EyeOff, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchEventDashboardData, CACHE_DURATION } from '../lib/fetchEventDashboardData';
import type { WithCacheMeta } from '../lib/fetchEventDashboardData';
import type { EventDashboardData } from '../types/event.types';
import EventListCard from '../components/EventListCard';
import EventOverviewCard from '../components/EventOverviewCard';
import TicketTierBreakdown from '../components/TicketTierBreakDown';
import SalesTrendCard from '../components/SalesTrendCard';
import { EventFilterProvider, EventDateFilter, useEventFilter } from '../components/ui/EventdateFilter';
//import ThemeToggle from '../components/ui/ThemeToggle';

const EventDashboardContent: React.FC = () => {
  const { profile } = useAuth();
  const { filters } = useEventFilter();
  const [searchValue, setSearchValue] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isDataVisible, setIsDataVisible] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WithCacheMeta<EventDashboardData> | null>(null);

  const selectedEvent = useMemo(
    () => data?.events.find((e) => e.id === selectedEventId) ?? null,
    [data, selectedEventId]
  );

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!profile?.companyId || !filters.startDate || !filters.endDate) {
      setLoading(false);
      return;
    }
    if (!forceRefresh) setLoading(true);
    setError(null);
    try {
      const result = await fetchEventDashboardData({
        companyId: profile.companyId,
        startDate: filters.startDate,
        endDate: filters.endDate,
        cacheKey: `event_dashboard_cache_${profile.companyId}`,
        forceRefresh,
      });
      setData(result);
      setSelectedEventId((prev) => prev ?? result.events[0]?.id ?? null);
    } catch (e) {
      console.error('Event dashboard fetch error:', e);
      setError('Could not load your events. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [profile, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => fetchData(true), CACHE_DURATION);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => fetchData(true);

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-16">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-4 py-3 sticky top-0 z-10 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#007A78]/10 text-[#007A78] dark:bg-[#2DD4BF]/15 dark:text-[#2DD4BF]">
            <LayoutDashboard size={20} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">Organizer Dashboard</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Real-time ticketing & sales analytics</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* <ThemeToggle /> */}
          <button
            onClick={() => setIsDataVisible(!isDataVisible)}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
            title={isDataVisible ? 'Hide Sensitive Data' : 'Show Sensitive Data'}
          >
            {isDataVisible ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <main className="grow overflow-y-auto p-3 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-4 max-w-7xl mx-auto">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span>
              Last updated:{' '}
              {data?.lastUpdated
                ? new Date(data.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Never'}
            </span>
          </p>
          <button
            onClick={handleRefresh}
            className={`p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F9FAFB] dark:bg-[#1E293B] hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all ${loading ? 'animate-spin' : ''
              }`}
            title="Refresh data"
          >
            {loading ? <Loader2 size={16} /> : <RefreshCw size={16} />}
          </button>
        </div>

        <div className="mx-auto max-w-7xl relative">
          <div className="mb-2">
            <EventListCard
              events={data?.events ?? []}
              selectedEventId={selectedEventId}
              onSelect={setSelectedEventId}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              loading={loading}
            />
          </div>

          <div className="mb-2">
            <EventDateFilter />
          </div>
          {error && (
            <div className="mb-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {loading && !data ? (
            <div className="flex h-64 items-center justify-center text-slate-500 dark:text-slate-400">
              <Loader2 className="animate-spin mr-2" size={18} /> Loading dashboard...
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <EventOverviewCard event={selectedEvent} isDataVisible={isDataVisible} loading={loading} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <TicketTierBreakdown
                  tiers={selectedEvent?.tiers ?? []}
                  isDataVisible={isDataVisible}
                  loading={loading}
                />
                <SalesTrendCard data={data?.salesTrend ?? []} isDataVisible={isDataVisible} loading={loading} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
const EventDashboard: React.FC = () => (
  <EventFilterProvider>
    <EventDashboardContent />
  </EventFilterProvider>
);

export default EventDashboard;