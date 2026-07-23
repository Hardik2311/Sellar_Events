import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar, Wifi, Clock, Ticket, X } from 'lucide-react';
import { Card } from '../components/ui/card';
import {
  MOCK_EVENTS,
  type PublicEvent,
  CATEGORY_GRADIENTS,
  getCategoryLabel,
  formatDateRange,
  formatTime,
  getPriceLabel,
  getAvailability,
  getFeaturedEvent,
} from '../data/mockEvents';

type FormatFilter = 'all' | 'in-person' | 'online';

// ─────────────────────────────────────────────────────────────────────────
// Event card
// ─────────────────────────────────────────────────────────────────────────
const EventCard: React.FC<{ event: PublicEvent; onOpen: () => void }> = ({ event, onOpen }) => {
  const label = getCategoryLabel(event);
  const { pct, soldOut, sellingFast } = getAvailability(event.tiers);
  const gradient = CATEGORY_GRADIENTS[event.category] ?? CATEGORY_GRADIENTS.Other;

  return (
    <Card
      className="shadow-sm border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow cursor-pointer"
      onClick={onOpen}
    >
      <div className={`relative h-36 w-full bg-gradient-to-br ${gradient}`}>
        {event.coverImage && (
          <img src={event.coverImage} alt={event.title} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <span className="absolute top-2 left-2 rounded-sm bg-white/90 px-2 py-0.5 text-xs font-medium text-slate-700">
          {label}
        </span>
        {event.isOnline && (
          <span className="absolute top-2 right-2 flex items-center gap-1 rounded-sm bg-white/90 px-2 py-0.5 text-xs font-medium text-slate-700">
            <Wifi size={12} /> Online
          </span>
        )}
        {soldOut && (
          <span className="absolute bottom-2 right-2 rounded-sm bg-slate-900/80 px-2 py-0.5 text-xs font-medium text-white">
            Sold out
          </span>
        )}
        {!soldOut && sellingFast && (
          <span className="absolute bottom-2 right-2 rounded-sm bg-[#F97316] px-2 py-0.5 text-xs font-medium text-white">
            Selling fast
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-slate-800">{event.title}</h3>

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Calendar size={13} />
          <span>{formatDateRange(event.date, event.endDate)}</span>
          <span className="text-slate-300">•</span>
          <Clock size={13} />
          <span>{formatTime(event.time)}</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          {event.isOnline ? (
            <>
              <Wifi size={13} />
              <span>Online event</span>
            </>
          ) : (
            <>
              <MapPin size={13} />
              <span className="truncate">{event.venue}</span>
            </>
          )}
        </div>

        <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
          <div className="h-1.5 rounded-full bg-[#F97316]" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>

        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm font-semibold text-[#F97316]">{getPriceLabel(event.tiers)}</span>
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Ticket size={13} /> by {event.organizerName}
          </span>
        </div>
      </div>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────
const EventDiscover: React.FC = () => {
  const navigate = useNavigate();
  const [events] = useState<PublicEvent[]>(MOCK_EVENTS);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [format, setFormat] = useState<FormatFilter>('all');

  const categories = useMemo(() => ['All', ...Array.from(new Set(events.map(getCategoryLabel)))], [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events
      .filter((e) => {
        const label = getCategoryLabel(e);
        const matchesCategory = activeCategory === 'All' || label === activeCategory;
        const matchesFormat = format === 'all' || (format === 'online' ? e.isOnline : !e.isOnline);
        const matchesSearch =
          !q || e.title.toLowerCase().includes(q) || e.venue.toLowerCase().includes(q) || label.toLowerCase().includes(q);
        return matchesCategory && matchesFormat && matchesSearch;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events, activeCategory, format, search]);

  const hasFiltersApplied = search.trim().length > 0 || activeCategory !== 'All' || format !== 'all';

  // The featured pick is independent of filters — it's always the
  // organizer/admin-flagged event (or soonest upcoming as fallback), and
  // only shown on the unfiltered view so it doesn't fight the search results.
  const featured = useMemo(() => getFeaturedEvent(events), [events]);
  const gridEvents = hasFiltersApplied ? filtered : filtered.filter((e) => e.id !== featured?.id);

  const clearFilters = () => {
    setSearch('');
    setActiveCategory('All');
    setFormat('all');
  };

  const openEvent = (event: PublicEvent) => navigate(`/events/e/${event.id}`);

  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-100 mb-16">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex shrink-0 flex-col gap-3 border-b border-slate-300 bg-gray-100/95 p-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-800">
              Sellar <span className="text-[#F97316]">Events</span>
            </h1>
            <span className="flex items-center gap-1 text-sm text-slate-500">
              <MapPin size={15} /> Lucknow
            </span>
          </div>

          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events, venues, or categories"
              className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-700 outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeCategory === c ? 'bg-[#F97316] text-white' : 'border border-gray-300 bg-white text-slate-600 hover:bg-gray-50'
                }`}
              >
                {c}
              </button>
            ))}

            <span className="mx-1 h-5 w-px shrink-0 bg-gray-300" />

            <div className="flex shrink-0 rounded-md border border-gray-300 bg-white p-1">
              {(['all', 'in-person', 'online'] as FormatFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`rounded-sm px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                    format === f ? 'bg-orange-50 text-[#F97316]' : 'text-gray-500'
                  }`}
                >
                  {f === 'all' ? 'All formats' : f}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="grow p-3">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-gray-300 bg-white py-16 text-center">
              <Ticket size={28} className="text-gray-300" />
              <p className="text-sm font-medium text-slate-700">No events match your filters</p>
              <p className="text-xs text-slate-400">Try a different category, format, or search term</p>
              <button
                onClick={clearFilters}
                className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-gray-50"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              {/* Featured event — only shown on the unfiltered view */}
              {!hasFiltersApplied && featured && (
                <Card className="shadow-sm border-gray-200 overflow-hidden cursor-pointer" onClick={() => openEvent(featured)}>
                  <div
                    className={`relative flex h-52 w-full flex-col justify-end bg-gradient-to-br ${
                      CATEGORY_GRADIENTS[featured.category] ?? CATEGORY_GRADIENTS.Other
                    } p-4`}
                  >
                    {featured.coverImage && (
                      <img src={featured.coverImage} alt={featured.title} className="absolute inset-0 h-full w-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    <span className="relative mb-1 w-fit rounded-sm bg-[#F97316] px-2 py-0.5 text-xs font-semibold text-white">
                      Featured
                    </span>
                    <h2 className="relative text-xl font-bold text-white">{featured.title}</h2>
                    <p className="relative mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/90">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} /> {formatDateRange(featured.date, featured.endDate)}, {formatTime(featured.time)}
                      </span>
                      <span className="flex items-center gap-1">
                        {featured.isOnline ? <Wifi size={14} /> : <MapPin size={14} />}
                        {featured.isOnline ? 'Online event' : featured.venue}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <span className="text-sm font-semibold text-[#F97316]">{getPriceLabel(featured.tiers)}</span>
                    <span className="rounded-md bg-[#F97316] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#ea580c]">
                      View details
                    </span>
                  </div>
                </Card>
              )}

              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">
                  {hasFiltersApplied ? `${filtered.length} event${filtered.length === 1 ? '' : 's'} found` : 'Upcoming events'}
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {gridEvents.map((event) => (
                    <EventCard key={event.id} event={event} onOpen={() => openEvent(event)} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default EventDiscover;