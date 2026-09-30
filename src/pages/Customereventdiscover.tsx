import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Ticket, X, Loader2 } from 'lucide-react';
import {
    type PublicEvent,
    CATEGORY_GRADIENTS,
    getCategoryLabel,
    formatDateRange,
    formatTime,
    getPriceLabel,
    getFeaturedEvent,
    buildEventSlugId,
} from '../data/events';
import { usePublicEvents } from '../hooks/usePublicEvents';
import { useDomainResolution } from '../hooks/useDomainResolution';
import { getSubdomain } from '../lib/subdomain';
import { useCompanySettings } from '../hooks/useSettings';
import { stripHtmlTags } from '../lib/utils';
import CustomerFooter from '../components/CustomerFooter';
import BrandNavHeader from '../components/brand/BrandNavHeader';
import EventListingRow from '../components/brand/EventListingRow';
import FeaturedPoster from '../components/brand/FeaturedPoster';
import MarqueeStrip from '../components/brand/MarqueeStrip';

type FormatFilter = 'all' | 'in-person' | 'online';

// Upcoming Fri–Sun window (if today already falls in it, that's the window).
const isThisWeekend = (dateISO: string): boolean => {
    const d = new Date(dateISO + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = today.getDay(); // 0 Sun .. 6 Sat
    const daysToFriday = day <= 5 ? 5 - day : 5 - day + 7; // next/this Friday
    const friday = new Date(today);
    friday.setDate(today.getDate() + (day === 6 ? -1 : day === 0 ? -2 : daysToFriday));
    const sunday = new Date(friday);
    sunday.setDate(friday.getDate() + 2);
    sunday.setHours(23, 59, 59, 999);
    return d >= friday && d <= sunday;
};

const dateParts = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return {
        day: d.toLocaleDateString('en-US', { day: '2-digit' }),
        month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    };
};

// ─────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────
const CustomerEventDiscover: React.FC = () => {
    const navigate = useNavigate();
    const { companyId } = useParams<{ companyId: string }>();
    const { resolvedCompanyId, loading: domainLoading, error: domainError } = useDomainResolution(companyId);

    const { events, loading: eventsLoading } = usePublicEvents(resolvedCompanyId); // organizer-published events only
    const { settings } = useCompanySettings(resolvedCompanyId);

    const loading = domainLoading || eventsLoading;

    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [format, setFormat] = useState<FormatFilter>('all');
    const [thisWeekendOnly, setThisWeekendOnly] = useState(false);

    // Private events must never show up in the public discover grid only
    // a direct shared link + code should reach them. `isPrivate` is the
    // real source of truth (activeAccessCode was never populated by the mapper).
    const visibleEvents = useMemo(
        () => events.filter((e) => !e.isPrivate),
        [events]
    );

    const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const upcomingEvents = useMemo(
        () => visibleEvents.filter((e) => (e.endDate || e.date) >= todayISO),
        [visibleEvents, todayISO]
    );

    const categories = useMemo(
        () => Array.from(new Set(upcomingEvents.map(getCategoryLabel))),
        [upcomingEvents]
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return upcomingEvents
            .filter((e) => {
                const label = getCategoryLabel(e);
                const matchesCategory = activeCategory === 'All' || label === activeCategory;
                const matchesFormat = format === 'all' || (format === 'online' ? e.isOnline : !e.isOnline);
                const matchesWeekend = !thisWeekendOnly || isThisWeekend(e.date);
                const matchesSearch =
                    !q || e.title.toLowerCase().includes(q) || e.venue.toLowerCase().includes(q) || label.toLowerCase().includes(q);
                return matchesCategory && matchesFormat && matchesWeekend && matchesSearch;
            })
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [upcomingEvents, activeCategory, format, thisWeekendOnly, search]);

    const hasFiltersApplied = search.trim().length > 0 || activeCategory !== 'All' || format !== 'all' || thisWeekendOnly;

    // The featured pick is independent of filters it's always the
    // organizer/admin-flagged event (or soonest upcoming as fallback), and
    // only shown on the unfiltered view so it doesn't fight the search results.
    const featured = useMemo(
        // helper ka "autoFeatureNearest" arg ka purana matlab hai "fallback allowed" —
        // naye setting mapping mein ON = manual-only, isliye yahan invert karke bhej rahe hain
        () => getFeaturedEvent(upcomingEvents, !settings.autoFeatureNearest),
        [upcomingEvents, settings.autoFeatureNearest]
    );
    const listEvents = hasFiltersApplied ? filtered : filtered.filter((e) => e.id !== featured?.id);

    const clearFilters = () => {
        setSearch('');
        setActiveCategory('All');
        setFormat('all');
        setThisWeekendOnly(false);
    };

    const subdomain = getSubdomain();

    const openEvent = (event: PublicEvent) => {
        const slugId = buildEventSlugId(event.title, event.id);
        navigate(subdomain ? `/e/${slugId}` : `/public/${resolvedCompanyId}/e/${slugId}`);
    };

    if (loading) {
        return (
            <div className="brand-theme flex min-h-screen items-center justify-center bg-[var(--brand-cream)]">
                <div className="flex flex-col items-center gap-4 text-black/50">
                    <Loader2 size={32} className="animate-spin text-[var(--brand-teal)]" />
                    <p className="brand-mono text-xs">Loading events...</p>
                </div>
            </div>
        );
    }

    if (domainError || (!loading && !resolvedCompanyId)) {
        return (
            <div className="brand-theme flex min-h-screen items-center justify-center bg-[var(--brand-cream)] p-4 text-center">
                <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8 border border-black/10">
                    <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">🏪</span>
                    </div>
                    <h2 className="brand-display text-xl text-[var(--brand-black)] mb-2">Store not found</h2>
                    <p className="text-black/50 mb-6">
                        The store you are looking for does not exist or has been moved.
                    </p>
                </div>
            </div>
        );
    }

    const chips: { key: string; label: string; active: boolean; onClick: () => void }[] = [
        { key: 'all', label: 'All', active: !hasFiltersApplied, onClick: clearFilters },
        ...categories.map((c) => ({
            key: `cat-${c}`,
            label: c,
            active: activeCategory === c,
            onClick: () => setActiveCategory((cur) => (cur === c ? 'All' : c)),
        })),
        {
            key: 'online',
            label: 'Online',
            active: format === 'online',
            onClick: () => setFormat((cur) => (cur === 'online' ? 'all' : 'online')),
        },
        {
            key: 'in-person',
            label: 'In person',
            active: format === 'in-person',
            onClick: () => setFormat((cur) => (cur === 'in-person' ? 'all' : 'in-person')),
        },
        {
            key: 'weekend',
            label: 'This weekend',
            active: thisWeekendOnly,
            onClick: () => setThisWeekendOnly((v) => !v),
        },
    ];

    return (
        <div className="brand-theme flex min-h-screen w-full flex-col bg-[var(--brand-cream)] text-[var(--brand-black)]">
            <BrandNavHeader organizationName={settings.organizationName} onBrowse={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />

            {/* ── Hero, two columns ────────────────────────────────────────── */}
            <section className="bg-[var(--brand-black)] px-4 pb-10 pt-8 sm:px-8 lg:px-24">
                <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_380px]">
                    {/* Left: copy + search + filters */}
                    <div>
                        <p className="brand-mono text-xs font-bold text-[var(--brand-yellow)]">
                            Season {new Date().getFullYear()} &middot; Now booking
                        </p>
                        <h1 className="brand-display mt-2 max-w-xl text-4xl leading-[0.95] text-white sm:text-6xl">
                            Nights worth <span className="text-[var(--brand-yellow)]">showing up</span> for.
                        </h1>
                        <p className="mt-3 max-w-md text-sm text-white/60">
                            {settings.organizationName || 'Outsold'} Events — the nights worth showing up for.
                        </p>

                        <div className="mt-5 flex max-w-xl items-stretch gap-2">
                            <div className="relative flex-1">
                                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search events, venues or categories"
                                    className="w-full rounded-sm border border-white/15 bg-white/5 py-2.5 pl-9 pr-9 text-sm text-white placeholder-white/40 outline-none focus:border-[var(--brand-yellow)]"
                                />
                                {search && (
                                    <button
                                        onClick={() => setSearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                                    >
                                        <X size={15} />
                                    </button>
                                )}
                            </div>
                            <button
                                type="button"
                                className="brand-mono shrink-0 rounded-sm bg-[var(--brand-yellow)] px-4 text-xs font-bold text-black hover:brightness-95"
                            >
                                Search
                            </button>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            {chips.map((chip) => (
                                <button
                                    key={chip.key}
                                    type="button"
                                    onClick={chip.onClick}
                                    className={`brand-mono rounded-sm border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                                        chip.active
                                            ? 'border-[var(--brand-yellow)] bg-[var(--brand-yellow)] text-black'
                                            : 'border-white/20 text-white/70 hover:bg-white/5'
                                    }`}
                                >
                                    {chip.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right: featured poster */}
                    {featured && (
                        <FeaturedPoster
                            title={stripHtmlTags(featured.title)}
                            imageUrl={featured.coverImageDesktop || featured.coverImageMobile || featured.coverImage || undefined}
                            gradientClass={CATEGORY_GRADIENTS[featured.category] ?? CATEGORY_GRADIENTS.Other}
                            categoryLabel={getCategoryLabel(featured)}
                            dateLabel={`${formatDateRange(featured.date, featured.endDate)} · ${formatTime(featured.time)}`}
                            priceLabel={getPriceLabel(featured.tiers)}
                            onOpen={() => openEvent(featured)}
                            className="hidden lg:block"
                        />
                    )}
                </div>
            </section>

            {upcomingEvents.length > 0 && (
                <MarqueeStrip
                    items={upcomingEvents.slice(0, 6).map((e) => `${stripHtmlTags(e.title)} · ${formatDateRange(e.date, e.endDate)}`)}
                />
            )}

            {/* ── Main content ─────────────────────────────────────────────── */}
            <main className="grow px-4 py-8 sm:px-8 lg:px-24">
                <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
                    <div className="flex items-center justify-between border-b border-black/10 pb-3">
                        <h2 className="brand-display text-2xl text-[var(--brand-black)]">
                            What&rsquo;s <span className="text-[var(--brand-teal)]">on</span>
                        </h2>
                        <span className="brand-mono text-xs text-black/40">
                            {String(filtered.length).padStart(2, '0')} event{filtered.length === 1 ? '' : 's'}
                        </span>
                    </div>

                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 rounded-sm border-2 border-dashed border-black/15 bg-white py-16 text-center">
                            <Ticket size={28} className="text-black/20" />
                            <p className="text-sm font-medium text-black/70">No events match your filters</p>
                            <p className="brand-mono text-xs text-black/40">Try a different category, format, or search term</p>
                            <button
                                onClick={clearFilters}
                                className="brand-mono mt-1 rounded-sm border border-black/20 px-3 py-1.5 text-xs font-bold text-black/70 hover:bg-black/5"
                            >
                                Clear filters
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {listEvents.map((event, i) => {
                                const { day, month } = dateParts(event.date);
                                return (
                                    <EventListingRow
                                        key={event.id}
                                        index={i + 1}
                                        title={stripHtmlTags(event.title)}
                                        imageUrl={event.coverImageDesktop || event.coverImageMobile || event.coverImage || undefined}
                                        gradientClass={CATEGORY_GRADIENTS[event.category] ?? CATEGORY_GRADIENTS.Other}
                                        categoryLabel={getCategoryLabel(event)}
                                        isOnline={event.isOnline}
                                        dateLabel={formatDateRange(event.date, event.endDate)}
                                        timeLabel={formatTime(event.time)}
                                        venueLabel={event.venue}
                                        organizerName={event.organizerName}
                                        dateDay={day}
                                        dateMonth={month}
                                        priceLabel={event.registrationMode === 'rsvp' ? 'RSVP' : getPriceLabel(event.tiers)}
                                        onOpen={() => openEvent(event)}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            <CustomerFooter
                variant="brand"
                organizationName={settings.organizationName}
                website={settings.website}
                instagram={settings.instagram}
                facebook={settings.facebook}
                twitter={settings.twitter}
                whatsappNumber={settings.whatsappNumber}
            />
        </div>
    );
};

export default CustomerEventDiscover;
