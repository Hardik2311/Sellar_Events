import React, { useState, useMemo, useCallback } from 'react';
import { RefreshCw, Loader2, Eye, EyeOff } from 'lucide-react';
import { SAMPLE_EVENT_DATA } from '../data/sampleEventData';
import EventListCard from '../components/EventListCard';
import EventOverviewCard from '../components/EventOverviewCard';
import TicketTierBreakdown from '../components/TicketTierBreakDown';
import SalesTrendCard from '../components/SalesTrendCard';
import { EventFilterProvider, EventDateFilter } from '../components/ui/EventdateFilter';

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
    <div className="flex min-h-screen w-full flex-col bg-gray-100 mb-16">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between border-b border-slate-300 bg-gray-100 p-2">
        <div className="flex-1 text-center flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">Your business</p>
        </div>

        <div className="w-20 flex justify-end items-center gap-2">
          <button
            onClick={() => setIsDataVisible(!isDataVisible)}
            className="p-2 rounded-sm border border-slate-400 hover:bg-slate-200 transition-colors"
            title={isDataVisible ? 'Hide Data' : 'Show Data'}
          >
            {isDataVisible ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <main className="grow overflow-y-auto p-2">
        <div className="flex justify-center gap-2 mb-2">
          <p className="text-sm text-slate-500 flex items-center">Last updated: just now</p>
          <button
            onClick={handleRefresh}
            className={`p-1 rounded-full hover:bg-slate-200 text-slate-600 transition-all ${
              loading ? 'animate-spin' : ''
            }`}
          >
            {loading ? <Loader2 size={14} /> : <RefreshCw size={14} />}
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