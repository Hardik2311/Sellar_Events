import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar, Wifi, Clock, Ticket, X, ChevronDown, Loader2, Share2 } from 'lucide-react';
import { Card } from '../components/ui/card';
//import ThemeToggle from '../components/ui/ThemeToggle';
//import ThemeToggle from '../components/ui/ThemeToggle';
import {
    type PublicEvent,
    CATEGORY_GRADIENTS,
    getCategoryLabel,
    formatDateRange,
    formatTime,
    getPriceLabel,
    getAvailability,
    getFeaturedEvent,
    buildEventSlugId,
} from '../data/events';
import { usePublicEvents } from '../hooks/usePublicEvents';
import { useCompanySettings } from '../hooks/useSettings';

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
            className="shadow-sm border-gray-200 dark:border-slate-800 dark:bg-[#1E293B] overflow-hidden flex flex-col hover:shadow-md transition-shadow cursor-pointer"
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
                    <span className="absolute top-2 right-9 flex items-center gap-1 rounded-sm bg-white/90 px-2 py-0.5 text-xs font-medium text-slate-700">
                        <Wifi size={12} /> Online
                    </span>
                )}
                <button
                    type="button"
                    onClick={async (e) => {
                        e.stopPropagation();
                        const shareUrl = `${window.location.origin}/e/${buildEventSlugId(event.title, event.id)}`;
                        if (navigator.share) {
                            try {
                                await navigator.share({ title: event.title, url: shareUrl });
                            } catch {
                                // user cancelled share sheet, no-op
                            }
                        } else {
                            await navigator.clipboard.writeText(shareUrl);
                        }
                    }}
                    title="Share event"
                    className="absolute top-2 right-2 rounded-full bg-white/90 p-1.5 text-slate-500 hover:bg-teal-50 hover:text-[#007A78] transition-colors"
                >
                    <Share2 size={14} />
                </button>
                {event.registrationMode !== 'rsvp' && soldOut && (
                    <span className="absolute bottom-2 right-2 rounded-sm bg-slate-900/80 px-2 py-0.5 text-xs font-medium text-white">
                        Sold out
                    </span>
                )}
                {event.registrationMode !== 'rsvp' && !soldOut && sellingFast && (
                    <span className="absolute bottom-2 right-2 rounded-sm bg-[#007A78] px-2 py-0.5 text-xs font-medium text-white">
                        Selling fast
                    </span>
                )}
            </div>

            <div className="flex flex-1 flex-col gap-2 p-3">
                <h3 className="line-clamp-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{event.title}</h3>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Calendar size={13} />
                    <span>{formatDateRange(event.date, event.endDate)}</span>
                    <span className="text-slate-300">•</span>
                    <Clock size={13} />
                    <span>{formatTime(event.time)}</span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
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

                {event.registrationMode !== 'rsvp' && (
                    <div className="mt-1 h-1.5 w-full rounded-sm bg-gray-100 dark:bg-slate-700">
                        <div className="h-1.5 rounded-sm bg-[#007A78]" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                )}

                <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#007A78]">
                        {event.registrationMode === 'rsvp' ? 'RSVP' : getPriceLabel(event.tiers)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
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
const CustomerEventDiscover: React.FC = () => {
    const navigate = useNavigate();
    const { events, loading } = usePublicEvents(); // organizer-published events only
    const { settings } = useCompanySettings();
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [format, setFormat] = useState<FormatFilter>('all');
    const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
    const [formatMenuOpen, setFormatMenuOpen] = useState(false);

    const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const upcomingEvents = useMemo(
        () => events.filter((e) => (e.endDate || e.date) >= todayISO),
        [events, todayISO]
    );

    const categories = useMemo(
        () => ['All', ...Array.from(new Set(upcomingEvents.map(getCategoryLabel)))],
        [upcomingEvents]
    );

    const formatOptions: { value: FormatFilter; label: string }[] = [
        { value: 'all', label: 'All formats' },
        { value: 'in-person', label: 'In-person' },
        { value: 'online', label: 'Online' },
    ];
    const activeFormatLabel = formatOptions.find((f) => f.value === format)?.label ?? 'All formats';

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return upcomingEvents
            .filter((e) => {
                const label = getCategoryLabel(e);
                const matchesCategory = activeCategory === 'All' || label === activeCategory;
                const matchesFormat = format === 'all' || (format === 'online' ? e.isOnline : !e.isOnline);
                const matchesSearch =
                    !q || e.title.toLowerCase().includes(q) || e.venue.toLowerCase().includes(q) || label.toLowerCase().includes(q);
                return matchesCategory && matchesFormat && matchesSearch;
            })
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [upcomingEvents, activeCategory, format, search]);

    const hasFiltersApplied = search.trim().length > 0 || activeCategory !== 'All' || format !== 'all';

    // The featured pick is independent of filters — it's always the
    // organizer/admin-flagged event (or soonest upcoming as fallback), and
    // only shown on the unfiltered view so it doesn't fight the search results.
    const featured = useMemo(
        () => getFeaturedEvent(upcomingEvents, settings.autoFeatureNearest),
        [upcomingEvents, settings.autoFeatureNearest]
    );
    const gridEvents = hasFiltersApplied ? filtered : filtered.filter((e) => e.id !== featured?.id);

    const clearFilters = () => {
        setSearch('');
        setActiveCategory('All');
        setFormat('all');
    };

    const openEvent = (event: PublicEvent) => navigate(`/e/${buildEventSlugId(event.title, event.id)}`);

    return (
        <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200">
            {/* ── Header ──────────────────────────────────────────────────── */}
            <header className="sticky top-0 z-20 flex shrink-0 flex-col gap-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-3.5 shadow-xs">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                            Sellar <span className="text-[#007A78] dark:text-[#2DD4BF]">Events</span>
                        </h1>
                    </div>

                    <div className="relative">
                        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search events, venues, or categories"
                            className="w-full rounded-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 pl-9 pr-9 text-sm text-slate-700 dark:text-slate-200 dark:placeholder-slate-500 outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]"
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

                    <div className="flex items-center justify-between gap-2">
                        {/* Category filter — dropdown, left side */}
                        <div className="relative shrink-0">
                            <button
                                type="button"
                                onClick={() => setCategoryMenuOpen((o) => !o)}
                                className="flex items-center gap-1 rounded-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                            >
                                {activeCategory}
                                <ChevronDown size={14} className={`transition-transform ${categoryMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {categoryMenuOpen && (
                                <>
                                    {/* backdrop to close on outside click */}
                                    <div className="fixed inset-0 z-10" onClick={() => setCategoryMenuOpen(false)} />
                                    <div className="absolute left-0 top-full z-20 mt-1 w-40 rounded-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-lg">
                                        {categories.map((c) => (
                                            <button
                                                key={c}
                                                onClick={() => {
                                                    setActiveCategory(c);
                                                    setCategoryMenuOpen(false);
                                                }}
                                                className={`block w-full px-3 py-1.5 text-left text-xs font-medium transition-colors ${activeCategory === c ? 'bg-orange-50 dark:bg-orange-950/40 text-[#007A78]' : 'text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                                                    }`}
                                            >
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Format filter — dropdown, right side */}
                        <div className="relative shrink-0">
                            <button
                                type="button"
                                onClick={() => setFormatMenuOpen((o) => !o)}
                                className="flex items-center gap-1 rounded-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                            >
                                {activeFormatLabel}
                                <ChevronDown size={14} className={`transition-transform ${formatMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {formatMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setFormatMenuOpen(false)} />
                                    <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-lg">
                                        {formatOptions.map((f) => (
                                            <button
                                                key={f.value}
                                                onClick={() => {
                                                    setFormat(f.value);
                                                    setFormatMenuOpen(false);
                                                }}
                                                className={`block w-full px-3 py-1.5 text-left text-xs font-medium transition-colors ${format === f.value ? 'bg-orange-50 dark:bg-orange-950/40 text-[#007A78]' : 'text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                                                    }`}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Main content ─────────────────────────────────────────────── */}
            <main className="grow p-3">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="animate-spin text-slate-400" size={24} />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-gray-300 dark:border-slate-700 bg-white dark:bg-[#1E293B] py-16 text-center">
                            <Ticket size={28} className="text-gray-300 dark:text-slate-600" />
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No events match your filters</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">Try a different category, format, or search term</p>
                            <button
                                onClick={clearFilters}
                                className="mt-1 rounded-sm border border-gray-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                            >
                                Clear filters
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Featured event — only shown on the unfiltered view */}
                            {!hasFiltersApplied && featured && (
                                <Card className="shadow-sm border-gray-200 dark:border-slate-800 dark:bg-[#1E293B] overflow-hidden cursor-pointer" onClick={() => openEvent(featured)}>
                                    <div
                                        className={`relative flex h-52 w-full flex-col justify-end bg-gradient-to-br ${CATEGORY_GRADIENTS[featured.category] ?? CATEGORY_GRADIENTS.Other
                                            } p-4`}
                                    >
                                        {featured.coverImage && (
                                            <img src={featured.coverImage} alt={featured.title} className="absolute inset-0 h-full w-full object-cover" />
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                                        <span className="relative mb-1 w-fit rounded-sm bg-[#007A78] px-2 py-0.5 text-xs font-semibold text-white">
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
                                        <span className="text-sm font-semibold text-[#007A78]">{getPriceLabel(featured.tiers)}</span>
                                        <span className="rounded-sm bg-[#007A78] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2DD4BF]">
                                            View details
                                        </span>
                                    </div>
                                </Card>
                            )}

                            <div>
                                <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
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

export default CustomerEventDiscover;