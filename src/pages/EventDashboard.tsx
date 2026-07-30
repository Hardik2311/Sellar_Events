import React, { useState, useMemo, useCallback } from 'react';
import { RefreshCw, Loader2, Eye, EyeOff, LayoutDashboard } from 'lucide-react';
import { SAMPLE_EVENT_DATA } from '../data/sampleEventData';
import EventListCard from '../components/EventListCard';
import EventOverviewCard from '../components/EventOverviewCard';
import TicketTierBreakdown from '../components/TicketTierBreakDown';
import SalesTrendCard from '../components/SalesTrendCard';
import { EventFilterProvider, EventDateFilter } from '../components/ui/EventdateFilter';
import ThemeToggle from '../components/ui/ThemeToggle';

// TODO — backend wiring (mirrors HomePage.tsx in the catalogue app):
// 1. Replace SAMPLE_EVENT_DATA with `fetchDashboardData<EventDashboardData>({ ... })`
// 2. Add the same cache/refresh pattern (CACHE_DURATION interval + manual refresh button)
// 3. Wire `loading` to the real fetch state instead of the local mock below

const EventDashboardContent: React.FC = () => {
  const [searchValue, setSearchValue] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(SAMPLE_EVENT_DATA.events[0]?.id ?? null);
  const [isDataVisible, setIsDataVisible] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);

  const data = SAMPLE_EVENT_DATA; // <- swap for fetched state

  const selectedEvent = useMemo(
    () => data.events.find((e) => e.id === selectedEventId) ?? null,
    [data.events, selectedEventId]
  );

  const handleRefresh = useCallback(() => {
    setLoading(true);
    // TODO: call fetchData(true) once wired to a real source
    setTimeout(() => setLoading(false), 600);
  }, []);

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
          <ThemeToggle />
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
            <span>Last updated: just now</span>
          </p>
          <button
            onClick={handleRefresh}
            className={`p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F9FAFB] dark:bg-[#1E293B] hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all ${
              loading ? 'animate-spin' : ''
            }`}
            title="Refresh data"
          >
            {loading ? <Loader2 size={16} /> : <RefreshCw size={16} />}
          </button>
        </div>

        <div className="mx-auto max-w-7xl relative">
          <div className="mb-2">
            <EventDateFilter />
          </div>

          <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
            {/* Left: event picker */}
            <div className="lg:col-span-1 h-full">
              <EventListCard
                events={data.events}
                selectedEventId={selectedEventId}
                onSelect={setSelectedEventId}
                searchValue={searchValue}
                onSearchChange={setSearchValue}
                loading={loading}
              />
            </div>

            {/* Right: selected event detail */}
            <div className="lg:col-span-2 flex flex-col gap-2">
              <EventOverviewCard event={selectedEvent} isDataVisible={isDataVisible} loading={loading} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <TicketTierBreakdown
                  tiers={selectedEvent?.tiers ?? []}
                  isDataVisible={isDataVisible}
                  loading={loading}
                />
                <SalesTrendCard data={data.salesTrend} isDataVisible={isDataVisible} loading={loading} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// EventFilterProvider wraps EventDashboardContent so useEventFilter() works inside it —
// same pattern as FilterProvider wrapping HomePageContent in the catalogue app.
const EventDashboard: React.FC = () => (
  <EventFilterProvider>
    <EventDashboardContent />
  </EventFilterProvider>
);

export default EventDashboard;