import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Ticket, Store, LayoutGrid, MonitorSmartphone, CalendarRange, Calendar, X } from 'lucide-react';
import {
    type PublicEvent,
    CATEGORY_GRADIENTS,
    getCategoryLabel,
    getFeaturedEvent,
    buildEventSlugId,
    isSalesClosed,
} from '../data/events';
import { formatShortDate, formatShortDateRange, formatShortTime, formatStartingPrice } from '../lib/storefrontFormat';
import { usePublicEvents } from '../hooks/usePublicEvents';
import { useDomainResolution } from '../hooks/useDomainResolution';
import { getSubdomain } from '../lib/subdomain';
import { useCompanySettings } from '../hooks/useSettings';
import { stripHtmlTags } from '../lib/utils';
import { dismissServerPreview } from '../lib/storefrontData';
import CustomerFooter from '../components/CustomerFooter';
import BrandNavHeader from '../components/brand/BrandNavHeader';
import EventCard from '../components/brand/EventCard';
import FeaturedCarousel, { type FeaturedSlide } from '../components/brand/FeaturedCarousel';
import MarqueeStrip from '../components/brand/MarqueeStrip';
import HeaderSearch from '../components/brand/HeaderSearch';
import BrandButton from '../components/brand/BrandButton';
import BrandEmptyState from '../components/brand/BrandEmptyState';
import FilterDropdown, { type FilterOption } from '../components/brand/FilterDropdown';

type FormatFilter = 'all' | 'in-person' | 'online';
type TimeFilter = 'any' | 'today' | 'tomorrow' | 'weekend' | 'week' | 'month' | 'date';

const MAX_FEATURED_SLIDES = 6;

const FORMAT_OPTIONS: { value: FormatFilter; label: string }[] = [
    { value: 'all', label: 'Online & in person' },
    { value: 'in-person', label: 'In person' },
    { value: 'online', label: 'Online' },
];

const TIME_OPTIONS: FilterOption[] = [
    { value: 'any', label: 'Any time' },
    { value: 'today', label: 'Today' },
    { value: 'tomorrow', label: 'Tomorrow' },
    { value: 'weekend', label: 'This weekend' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
    { value: 'date', label: 'Pick a date', icon: Calendar },
];

const addDays = (d: Date, n: number) => {
    const next = new Date(d);
    next.setDate(d.getDate() + n);
    return next;
};

// [start, end] calendar-day window for a time filter (local time, inclusive).
const getTimeWindow = (filter: TimeFilter, pickedDate?: string): [Date, Date] | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = today.getDay(); // 0 Sun .. 6 Sat
    switch (filter) {
        case 'today':
            return [today, today];
        case 'tomorrow':
            return [addDays(today, 1), addDays(today, 1)];
        case 'weekend': {
            // Upcoming Fri–Sun window (if today already falls in it, that's the window).
            const friday = addDays(today, day === 6 ? -1 : day === 0 ? -2 : 5 - day);
            return [friday, addDays(friday, 2)];
        }
        case 'week':
            return [today, addDays(today, day === 0 ? 0 : 7 - day)]; // through Sunday
        case 'month':
            return [today, new Date(today.getFullYear(), today.getMonth() + 1, 0)];
        case 'date': {
            if (!pickedDate) return null;
            const picked = new Date(pickedDate + 'T00:00:00');
            return [picked, picked];
        }
        default:
            return null;
    }
};

// Multi-day events match if any of their days fall inside the window.
const matchesTimeWindow = (startISO: string, endISO: string | undefined, window: [Date, Date] | null) => {
    if (!window) return true;
    const start = new Date(startISO + 'T00:00:00');
    const end = new Date((endISO || startISO) + 'T00:00:00');
    return start <= window[1] && end >= window[0];
};

// "Sat, 12 Oct · 7 PM" (one middle dot per line, per the storefront copy rules)
const cardDateLabel = (event: PublicEvent) =>
    [formatShortDateRange(event.date, event.endDate), formatShortTime(event.time)].filter(Boolean).join(' · ');

const priceLabelFor = (event: PublicEvent) =>
    event.registrationMode === 'rsvp' ? 'Free, RSVP' : formatStartingPrice(event.tiers.map((t) => t.price));

// Skeleton shapes of the hero and the poster grid while events load.
const DiscoverSkeleton: React.FC = () => (
    <div className="brand-theme flex min-h-screen w-full flex-col bg-[var(--brand-cream)]" aria-busy="true" aria-label="Loading events">
        <div className="h-16 border-b border-[var(--brand-line)] bg-[var(--brand-surface)]" />
        <div className="h-[480px] w-full animate-pulse bg-[var(--brand-skeleton)] motion-reduce:animate-none sm:h-[460px] lg:h-[560px]" />
        <div className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-8 lg:px-24">
            <div className="mb-6 h-7 w-44 animate-pulse rounded-full bg-[var(--brand-skeleton)] motion-reduce:animate-none" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="flex flex-col gap-3">
                        <div className="aspect-[4/5] w-full animate-pulse rounded-xl bg-[var(--brand-skeleton)] motion-reduce:animate-none" />
                        <div className="h-3 w-1/2 animate-pulse rounded-full bg-[var(--brand-skeleton)] motion-reduce:animate-none" />
                        <div className="h-4 w-11/12 animate-pulse rounded-full bg-[var(--brand-skeleton)] motion-reduce:animate-none" />
                        <div className="h-3 w-2/3 animate-pulse rounded-full bg-[var(--brand-skeleton)] motion-reduce:animate-none" />
                    </div>
                ))}
            </div>
        </div>
    </div>
);

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
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('any');
    const [pickedDate, setPickedDate] = useState(''); // YYYY-MM-DD, used when timeFilter is 'date'

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
        const timeWindow = getTimeWindow(timeFilter, pickedDate);
        return upcomingEvents
            .filter((e) => {
                const label = getCategoryLabel(e);
                const matchesCategory = activeCategory === 'All' || label === activeCategory;
                const matchesFormat = format === 'all' || (format === 'online' ? e.isOnline : !e.isOnline);
                const matchesTime = matchesTimeWindow(e.date, e.endDate, timeWindow);
                const matchesSearch =
                    !q || e.title.toLowerCase().includes(q) || e.venue.toLowerCase().includes(q) || label.toLowerCase().includes(q);
                return matchesCategory && matchesFormat && matchesTime && matchesSearch;
            })
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [upcomingEvents, activeCategory, format, timeFilter, pickedDate, search]);

    const hasFiltersApplied = search.trim().length > 0 || activeCategory !== 'All' || format !== 'all' || timeFilter !== 'any';

    // Hero slideshow picks are independent of filters: every organizer-flagged
    // upcoming event (soonest first), or — when none are flagged — the single
    // soonest upcoming event as a fallback.
    const featuredEvents = useMemo(() => {
        const flagged = upcomingEvents
            .filter((e) => e.featured)
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, MAX_FEATURED_SLIDES);
        if (flagged.length > 0) return flagged;
        // helper ka "autoFeatureNearest" arg ka purana matlab hai "fallback allowed" —
        // naye setting mapping mein ON = manual-only, isliye yahan invert karke bhej rahe hain
        const fallback = getFeaturedEvent(upcomingEvents, !settings.autoFeatureNearest);
        return fallback ? [fallback] : [];
    }, [upcomingEvents, settings.autoFeatureNearest]);

    const clearFilters = () => {
        setSearch('');
        setActiveCategory('All');
        setFormat('all');
        setTimeFilter('any');
        setPickedDate('');
    };

    const subdomain = getSubdomain();

    const openEvent = (event: PublicEvent) => {
        const slugId = buildEventSlugId(event.title, event.id);
        navigate(subdomain ? `/e/${slugId}` : `/public/${resolvedCompanyId}/e/${slugId}`);
    };

    // Swap the server's plain-HTML preview for the real page once it's drawn.
    useEffect(() => {
        if (!loading) dismissServerPreview();
    }, [loading]);

    if (loading) {
        return <DiscoverSkeleton />;
    }

    if (domainError || (!loading && !resolvedCompanyId)) {
        return (
            <div className="brand-theme flex min-h-screen items-center justify-center bg-[var(--brand-cream)] p-4">
                <BrandEmptyState
                    icon={Store}
                    title="This store isn't available"
                    body="The link may be wrong, or the store has moved. Check the address and try again."
                    className="w-full max-w-md"
                />
            </div>
        );
    }

    const scrollToList = () => document.getElementById('whats-on')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const headline = (
        <>
            Find your <span className="text-[var(--brand-yellow)]">next experience.</span>
        </>
    );

    // Brand slide (organizer's cover from Edit Profile) leads, then one slide
    // per featured event.
    const slides: FeaturedSlide[] = [
        ...(settings.brandCoverUrl
            ? [{
                id: 'brand',
                eyebrow: `${settings.organizationName || 'Outsold'} Events`,
                title: headline,
                titleText: 'Find your next experience',
                desktopImage: settings.brandCoverUrl,
                ctaLabel: 'Browse events',
                onCta: scrollToList,
            }]
            : []),
        ...featuredEvents.map((e) => ({
            id: e.id,
            eyebrow: 'Featured',
            title: stripHtmlTags(e.title),
            titleText: stripHtmlTags(e.title),
            dateLabel: cardDateLabel(e),
            venueLabel: e.isOnline ? 'Online' : e.venue,
            priceLabel: priceLabelFor(e),
            desktopImage: e.coverImageDesktop || e.coverImage || e.images?.[0] || null,
            mobileImage: e.coverImageMobile || null,
            gradientClass: CATEGORY_GRADIENTS[e.category] ?? CATEGORY_GRADIENTS.Other,
            ctaLabel: 'Book tickets',
            onCta: () => openEvent(e),
        })),
    ];

    return (
        <div className="brand-theme flex min-h-screen w-full flex-col bg-[var(--brand-cream)] text-[var(--brand-black)]">
            <BrandNavHeader
                organizationName={settings.organizationName}
                onBrowse={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                rightSlot={
                    <HeaderSearch
                        value={search}
                        onChange={setSearch}
                        onSubmit={scrollToList}
                    />
                }
            />

            {slides.length > 0 ? (
                /* ── Hero slideshow: brand cover + featured events, edge to edge ── */
                <FeaturedCarousel slides={slides} />
            ) : (
                /* ── Fallback hero when there's nothing to feature ───────────── */
                <section className="flex min-h-[320px] items-center bg-[var(--brand-black)] px-4 py-10 sm:min-h-[380px] sm:px-8 lg:min-h-[480px] lg:px-24">
                    <div className="mx-auto w-full max-w-[1440px]">
                        <h1 className="brand-display max-w-xl text-[40px] leading-[0.95] text-[var(--brand-cream)] sm:text-[64px]">{headline}</h1>
                    </div>
                </section>
            )}

            {upcomingEvents.length > 0 && (
                <MarqueeStrip
                    items={upcomingEvents.slice(0, 6).map((e) => `${stripHtmlTags(e.title)} · ${formatShortDateRange(e.date, e.endDate)}`)}
                />
            )}

            {/* ── Main content ─────────────────────────────────────────────── */}
            <main id="whats-on" className="grow scroll-mt-4 px-4 py-8 sm:px-8 lg:px-24">
                <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
                    <div className="flex items-baseline justify-between gap-4">
                        <h2 className="brand-display text-2xl leading-[1.05] text-[var(--brand-black)] sm:text-[28px]">
                            What&rsquo;s <span className="text-[var(--brand-teal)]">on</span>
                        </h2>
                        <span className="text-sm text-[var(--brand-muted)]">
                            {filtered.length} event{filtered.length === 1 ? '' : 's'}
                        </span>
                    </div>

                    {/* Filters — dropdowns under the "What’s on" heading */}
                    <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5">
                        <FilterDropdown
                            icon={LayoutGrid}
                            label="Category"
                            value={activeCategory}
                            onChange={setActiveCategory}
                            options={[{ value: 'All', label: 'All categories' }, ...categories.map((c) => ({ value: c, label: c }))]}
                            active={activeCategory !== 'All'}
                            shortLabel="Category"
                            className="sm:w-60"
                        />
                        <FilterDropdown
                            icon={MonitorSmartphone}
                            label="Online or in person"
                            value={format}
                            onChange={(v) => setFormat(v as FormatFilter)}
                            options={FORMAT_OPTIONS}
                            active={format !== 'all'}
                            shortLabel="Mode"
                            className="sm:w-60"
                        />
                        <FilterDropdown
                            icon={CalendarRange}
                            label="Date"
                            value={timeFilter}
                            displayLabel={timeFilter === 'date' ? (pickedDate ? formatShortDate(pickedDate) : 'Pick a date') : undefined}
                            onChange={(v) => setTimeFilter(v as TimeFilter)}
                            options={TIME_OPTIONS}
                            active={timeFilter !== 'any' && (timeFilter !== 'date' || !!pickedDate)}
                            keepOpenFor={['date']}
                            shortLabel="Date"
                            menuAlign="right"
                            footer={
                                timeFilter === 'date'
                                    ? (
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-[13px] font-semibold text-[var(--brand-black)]">Date</span>
                                            <input
                                                type="date"
                                                value={pickedDate}
                                                min={todayISO}
                                                onChange={(e) => setPickedDate(e.target.value)}
                                                className="h-11 w-full rounded-lg border border-[var(--brand-line-strong)] bg-[var(--brand-surface)] px-3 text-[15px] text-[var(--brand-black)] outline-none [color-scheme:light] focus:border-[var(--brand-teal)] focus:ring-1 focus:ring-[var(--brand-teal)]"
                                            />
                                        </label>
                                    )
                                    : undefined
                            }
                            className="sm:w-60"
                        />
                        {hasFiltersApplied && (
                            <BrandButton variant="link" onClick={clearFilters} className="col-span-3 justify-self-start px-1 sm:self-center !text-[var(--brand-black)]">
                                <X size={16} /> Clear filters
                            </BrandButton>
                        )}
                    </div>

                    {filtered.length === 0 ? (
                        <BrandEmptyState
                            icon={Ticket}
                            title="No events match these filters"
                            body="Try another category, date or search, or clear the filters to see everything coming up."
                            action={
                                <BrandButton variant="secondary" onClick={clearFilters}>
                                    Clear filters
                                </BrandButton>
                            }
                        />
                    ) : (
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
                            {filtered.map((event) => (
                                <EventCard
                                    key={event.id}
                                    title={stripHtmlTags(event.title)}
                                    imageUrl={event.coverImageMobile || event.coverImageDesktop || event.coverImage || undefined}
                                    gradientClass={CATEGORY_GRADIENTS[event.category] ?? CATEGORY_GRADIENTS.Other}
                                    dateLabel={cardDateLabel(event)}
                                    venueLabel={event.isOnline ? 'Online' : event.venue}
                                    priceLabel={priceLabelFor(event)}
                                    onOpen={() => openEvent(event)}
                                    soldOut={isSalesClosed(event)}
                                />
                            ))}
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
                bio={settings.storefront.bio}
                contactEmail={settings.storefront.contactEmail}
                storeBasePath={subdomain ? '' : `/public/${resolvedCompanyId}`}
            />
        </div>
    );
};

export default CustomerEventDiscover;
