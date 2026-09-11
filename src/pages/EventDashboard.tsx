import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, Loader2, Eye, EyeOff, LayoutDashboard, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEventCredits } from '../hooks/useEventCredits';
import { fetchEventDashboardData, CACHE_DURATION } from '../lib/fetchEventDashboardData';
import type { WithCacheMeta } from '../lib/fetchEventDashboardData';
import type { EventDashboardData } from '../types/event.types';
import EventListCard from '../components/EventListCard';
import EventOverviewCard from '../components/EventOverviewCard';
import TicketTierBreakdown from '../components/TicketTierBreakDown';
import SalesTrendCard from '../components/SalesTrendCard';
import { EventFilterProvider, EventDateFilter, useEventFilter } from '../components/ui/EventdateFilter';
import { usePermissions } from '../hooks/usePermissions';
import { Permission } from '../types/permissions.types';
//import ThemeToggle from '../components/ui/ThemeToggle';

const EventDashboardContent: React.FC = () => {
  const { profile } = useAuth();
  const { can } = usePermissions();
  const { filters } = useEventFilter();
  const { credits, loading: creditsLoading } = useEventCredits();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isDataVisible, setIsDataVisible] = useState<boolean>(false);
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
        cacheKey: `event_dashboard_cache_v2_${profile.companyId}`,
        forceRefresh,
      });
      setData(result);
      const now = new Date();
      const firstUpcoming = result.events.find((e) => new Date(e.startDate) >= now);
      setSelectedEventId((prev) => prev ?? firstUpcoming?.id ?? result.events[0]?.id ?? null);
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
      <header className="relative flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-4 py-5 sticky top-0 z-10 shadow-xs">
        {/* Left: logo — mobile only, desktop already has it in the sidebar */}
        <div className="md:hidden w-fit">
          <img src="/Outsold.png" alt="Outsold" className="h-10 w-auto" />
        </div>

        {/* Center: title + org name + tagline — absolutely centered so it stays true-center regardless of left/right widths */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none px-2 max-w-[60%] sm:max-w-none">
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate">Dashboard</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{profile?.organizationName ?? ''}</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate">Real-time ticketing & sales analytics</p>
        </div>

        {/* Right: credits badge + eye toggle button */}
        <div className="flex items-center justify-end gap-2 ml-auto">
          <button
            onClick={() => navigate('/events/account/recharge')}
            className="flex items-center gap-1.5 rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 text-xs font-bold text-[#007A78] dark:text-[#2DD4BF] hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
            title="Event credits — click to recharge"
          >
            <Wallet size={16} />
            {creditsLoading ? '…' : credits}
          </button>

          {can(Permission.TOGGLE_SENSITIVE_DATA) && (
            <button
              onClick={() => setIsDataVisible(!isDataVisible)}
              className="p-2 rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
              title={isDataVisible ? 'Hide Sensitive Data' : 'Show Sensitive Data'}
            >
              {isDataVisible ? <Eye size={16} /> : <EyeOff size={18} />}
            </button>
          )}
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <main className="grow overflow-y-auto p-1.5 sm:p-5">
        <div className="max-w-7xl mx-auto mb-1">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div />
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
              <span>
                Last updated:{' '}
                {data?.lastUpdated
                  ? new Date(data.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Never'}
              </span>
            </p>
            <div className="flex justify-end">
              <button
                onClick={handleRefresh}
                className={`p-2 rounded-sm border border-slate-200 dark:border-slate-700 bg-[#F9FAFB] dark:bg-[#1E293B] hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all ${loading ? 'animate-spin' : ''
                  }`}
                title="Refresh data"
              >
                {loading ? <Loader2 size={16} /> : <RefreshCw size={16} />}
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl relative">
          <div className="mb-1">
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
            <div className="mb-2 rounded-sm border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-3 py-2 text-sm text-red-700 dark:text-red-300">
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
                <SalesTrendCard data={selectedEvent?.salesTrend ?? []} isDataVisible={isDataVisible} loading={loading} />
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