import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  Share2,
  ShieldCheck,
  Ticket,
  Wifi,
  X,
} from 'lucide-react';
import CoverImageDisplay from '../components/ui/CoverImageDisplay';
import {
  CATEGORY_GRADIENTS,
  getCategoryLabel,
  getAvailability,
  isSalesClosed,
  formatTime,
  isTierExpired,
} from '../data/events';
import { isAccessCodeUsed, usePublicEvent, verifyAccessCode } from '../hooks/usePublicEvents';
import { DEFAULT_MAX_TICKETS_PER_ORDER } from '../data/events';
import { useDomainResolution } from '../hooks/useDomainResolution';
import { getSubdomain } from '../lib/subdomain';
import { useCompanySettings } from '../hooks/useSettings';
import { parseEventIdFromSlug } from '../data/events';
import { useAuth } from '../context/AuthContext';
import RichTextDisplay from '../components/ui/RichTextDisplay';
import ManualQRPaymentCard from '../components/ManualQRpaymentCard';
import { DEFAULT_TEXT_STYLE } from '../types/event.types';
import { useSearchParams } from 'react-router-dom'; // NEW — reads ?code= from the shared link
import BrandNavHeader from '../components/brand/BrandNavHeader';
import SectionLabel from '../components/brand/SectionLabel';
import PrivateAccessGate from '../components/brand/PrivateAccessGate';
import TicketPanel from '../components/brand/TicketPanel';
import CustomerFooter from '../components/CustomerFooter';
import BrandCheckbox from '../components/brand/BrandCheckbox';
import MobileCheckoutBar from '../components/brand/MobileCheckoutBar';
import BrandButton from '../components/brand/BrandButton';
import { brandButtonClass } from '../components/brand/brandButtonClass';
import BrandTag from '../components/brand/BrandTag';
import BrandEmptyState from '../components/brand/BrandEmptyState';
import AutoplayVideo from '../components/brand/AutoplayVideo';
import { stripHtmlTags } from '../lib/utils';
import { dismissServerPreview } from '../lib/storefrontData';
import { formatLongDateRange, formatRupees, formatShortDateRange } from '../lib/storefrontFormat';

// About text collapses to roughly five lines (26px line height) until "Read more".
const ABOUT_COLLAPSED_HEIGHT = 130;

const panelClass = 'rounded-xl border border-[var(--brand-line)] bg-[var(--brand-surface)] p-4 lg:p-5';

// Rough width, in em, of the longest run of the title that can't wrap (text
// between spaces). Anton capitals are about 0.52em wide; emoji about 1.25em.
const longestRunEm = (title: string) =>
  Math.max(
    6,
    ...title
      .split(/\s+/)
      .map((run) =>
        [...run].reduce(
          (em, ch) => em + (/\p{Extended_Pictographic}/u.test(ch) ? 1.25 : /[‍️]/.test(ch) ? 0 : 0.52),
          0
        )
      )
  );

// Skeleton of the event page (cover, title, info rows, ticket panel) while it loads.
const EventDetailSkeleton: React.FC = () => (
  <div className="brand-theme flex min-h-dvh w-full flex-col bg-[var(--brand-cream)]" aria-busy="true" aria-label="Loading event">
    <div className="h-16 border-b border-[var(--brand-line)] bg-[var(--brand-surface)]" />
    <div className="aspect-[4/5] max-h-[60vh] w-full animate-pulse bg-[var(--brand-skeleton)] motion-reduce:animate-none sm:aspect-[8/3]" />
    <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12 lg:px-24">
      <div className="flex flex-col gap-4">
        <div className="h-[22px] w-40 animate-pulse rounded-full bg-[var(--brand-skeleton)] motion-reduce:animate-none" />
        <div className="h-10 w-3/4 animate-pulse rounded-lg bg-[var(--brand-skeleton)] motion-reduce:animate-none" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-9 w-9 animate-pulse rounded-lg bg-[var(--brand-skeleton)] motion-reduce:animate-none" />
            <div className="h-4 w-1/2 animate-pulse rounded-full bg-[var(--brand-skeleton)] motion-reduce:animate-none" />
          </div>
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-[var(--brand-skeleton)] motion-reduce:animate-none" />
    </div>
  </div>
);

const CustomerEventDetail: React.FC = () => {
  const { slug, companyId } = useParams<{ slug: string; companyId?: string }>();
  const id = slug ? parseEventIdFromSlug(slug) : undefined;
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();

  const { resolvedCompanyId, loading: domainLoading, error: domainError } = useDomainResolution(companyId);
  const { event, loading: eventLoading, fromServer } = usePublicEvent(id, resolvedCompanyId);
  const { settings } = useCompanySettings(resolvedCompanyId);

  const loading = domainLoading || eventLoading;

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [showManualQR, setShowManualQR] = useState(false);
  const [saved, setSaved] = useState(false);
  // Set when a CTA is tapped before consent; shows an error line under the checkbox until it's ticked
  const [consentHighlight, setConsentHighlight] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [aboutOverflows, setAboutOverflows] = useState(false);
  const aboutRef = useRef<HTMLDivElement>(null);

  // NEW — access-code gate state
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState(false);
  // Event id unlocked with a code during this visit.
  const [codeVerifiedFor, setCodeVerifiedFor] = useState<string | null>(null);

  // Worked out during render, not in an effect: an effect only runs after the
  // first paint, so every event (public ones too) flashed the private-event
  // gate for a frame before being unlocked.
  const isOrganizerLivePreview =
    !!event &&
    searchParams.get('preview') === '1' &&
    !!profile?.companyId &&
    profile.companyId === event.companyId;
  // Gate driven by `isPrivate` — `activeAccessCode` was never populated by
  // the mapper, so checking it left every private event unlocked.
  const isVerified =
    !!event &&
    (!event.isPrivate ||
      isOrganizerLivePreview ||
      codeVerifiedFor === event.id ||
      sessionStorage.getItem(`eventAccessVerified:${event.id}`) === 'true');

  useEffect(() => {
    setActiveImageIndex(0); // event change hone par reset
    setConsentAcknowledged(false);
    setAboutExpanded(false);

    if (!event?.id) return;
    const saved = sessionStorage.getItem(`eventTicketQty:${event.id}`);
    if (saved) {
      try {
        setQuantities(JSON.parse(saved));
      } catch {
        setQuantities({});
      }
    } else {
      setQuantities({});
    }
  }, [event?.id]);
  useEffect(() => {
    if (!event?.id) return;
    sessionStorage.setItem(`eventTicketQty:${event.id}`, JSON.stringify(quantities));
  }, [quantities, event?.id]);

  // Only offer "Read more" when the description is actually taller than the collapsed box.
  useEffect(() => {
    const el = aboutRef.current;
    if (!el) return;
    setAboutOverflows(el.scrollHeight > ABOUT_COLLAPSED_HEIGHT + 4);
  }, [event?.description, isVerified]);

  // The server sends only a private event's gate fields, so a visitor who
  // already unlocked it waits for the live data rather than seeing an empty page.
  const showSkeleton = loading || (fromServer && !!event?.isPrivate && isVerified);

  // Swap the server's plain-HTML preview for the real page once it's drawn.
  useEffect(() => {
    if (!showSkeleton) dismissServerPreview();
  }, [showSkeleton]);

  if (showSkeleton) {
    return <EventDetailSkeleton />;
  }

  if (domainError || (!loading && !event)) {
    return (
      <div className="brand-theme flex min-h-dvh w-full items-center justify-center bg-[var(--brand-cream)] p-4">
        <BrandEmptyState
          icon={Ticket}
          title="This event isn't available"
          body="It may have ended, or the link might be wrong. Have a look at what's on instead."
          className="w-full max-w-md"
          action={
            <BrandButton
              onClick={() =>
                navigate(
                  getSubdomain() ? '/' : resolvedCompanyId ? `/public/${resolvedCompanyId}` : '/'
                )
              }
            >
              All events
            </BrandButton>
          }
        />
      </div>
    );
  }
  if (!event) {
    // Unreachable in practice (handled above) — this just lets
    // TypeScript treat `event` as defined for the rest of the component.
    return null;
  }
  // NEW — code gate: block everything below until verified
  if (!isVerified) {
    const handleVerify = () => {
      // Codes only arrive with the live data; the gate shows "Checking…" until then.
      if (fromServer) return;
      if (verifyAccessCode(event, codeInput)) {
        sessionStorage.setItem(`eventAccessVerified:${event.id}`, 'true');
        // Saved alongside the verified flag so it can be attached to the
        // ticket at booking time and shown back to the attendee.
        sessionStorage.setItem(`eventAccessCode:${event.id}`, codeInput.trim().toUpperCase());
        setCodeVerifiedFor(event.id);
        setCodeError(false);
      } else {
        setCodeError(true);
      }
    };

    return (
      <PrivateAccessGate
        organizationName={settings.organizationName}
        codeInput={codeInput}
        onCodeChange={(v) => { setCodeInput(v); setCodeError(false); }}
        onVerify={handleVerify}
        codeError={codeError}
        verifying={fromServer}
      />
    );
  }

  const label = getCategoryLabel(event);
  const gradient = CATEGORY_GRADIENTS[event.category] ?? CATEGORY_GRADIENTS.Other;
  const plainTitle = stripHtmlTags(event.title);

  const remainingFor = (tierId: string) => {
    const tier = event.tiers.find((t) => t.id === tierId);
    return tier ? tier.quantity - tier.sold : 0;
  };

  // Number to actually DISPLAY to the customer — real remaining, unless the
  // organizer has turned on a dummy threshold for this tier
  const displayRemainingFor = (tierId: string) => {
    const tier = event.tiers.find((t) => t.id === tierId);
    if (!tier) return 0;
    if (settings.ticketDisplay.useDummyThreshold && typeof tier.dummyRemaining === 'number') {
      return tier.dummyRemaining;
    }
    return tier.quantity - tier.sold;
  };

  // Organizer-configured cap on tickets per order (falls back to the
  // platform default when unset), enforced across all tiers combined.
  const maxPerOrder =
    typeof event.maxTicketsPerOrder === 'number' && event.maxTicketsPerOrder > 0
      ? event.maxTicketsPerOrder
      : DEFAULT_MAX_TICKETS_PER_ORDER;

  const setQty = (tierId: string, next: number) => {
    const max = remainingFor(tierId);
    const totalOtherTiers = Object.entries(quantities)
      .filter(([tid]) => tid !== tierId)
      .reduce((s, [, n]) => s + n, 0);
    const orderCap = Math.max(0, maxPerOrder - totalOtherTiers);
    const clamped = Math.max(0, Math.min(next, max, orderCap));
    setQuantities((q) => ({ ...q, [tierId]: clamped }));
  };

  // When the company setting is off, ignore any stray end-date data —
  // every tier stays visible exactly as before.
  const visibleTiers = settings.ticketDisplay.enableTierAvailabilityWindow
    ? event.tiers.filter((t) => !isTierExpired(t))
    : event.tiers;

  const totalTickets = Object.values(quantities).reduce((s, n) => s + n, 0);
  const everyTierSoldOut =
    visibleTiers.length === 0 || visibleTiers.every((t) => t.sold >= t.quantity);
  // Private event opened with a code that has already bought tickets: the
  // page stays viewable, but booking is closed for this code. `event` is a
  // live snapshot, so this also flips right after a purchase on this page.
  const codeAlreadyUsed =
    !isOrganizerLivePreview && isAccessCodeUsed(event, sessionStorage.getItem(`eventAccessCode:${event.id}`));
  // isSalesClosed also covers "event already started" and the organizer's
  // manual Sold Out toggle — not just capacity (everyTierSoldOut already
  // handles capacity on its own filtered tier list, so this is additive).
  const allSoldOut = everyTierSoldOut || codeAlreadyUsed || isSalesClosed(event);
  const hasConsent = Boolean(event.consentText && event.consentText.trim().length > 0);
  const consentBlocking = hasConsent && !consentAcknowledged;

  const selectedTiersBreakdown = event.tiers
    .filter((tier) => (quantities[tier.id] ?? 0) > 0)
    .map((tier) => ({
      id: tier.id,
      name: tier.name,
      qty: quantities[tier.id],
      subtotal: tier.price * quantities[tier.id],
      price: tier.price, // NEW — needed by ManualQRPaymentCard's batch write
    }));

  const totalAmount = selectedTiersBreakdown.reduce((sum, b) => sum + b.subtotal, 0);
  const totalLabel = formatRupees(totalAmount);
  const ticketCountLabel = `${totalTickets} ticket${totalTickets === 1 ? '' : 's'}`;

  const availablePrices = visibleTiers.filter((t) => t.sold < t.quantity).map((t) => t.price);
  const startingPriceLabel = availablePrices.length > 0 ? formatRupees(Math.min(...availablePrices)) : '';
  const fewLeft = getAvailability(visibleTiers).sellingFast;

  const handleBack = () => {
    navigate(getSubdomain() ? '/' : resolvedCompanyId ? `/public/${resolvedCompanyId}` : '/');
  };

  const shareThisEvent = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: plainTitle, url: shareUrl });
      } catch {
        // user cancelled share sheet, no-op
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
    }
  };

  const handleGetTickets = () => {
    if (event.registrationMode === 'tickets' && event.paymentCollectionMode === 'manual_qr') {
      setShowManualQR(true); // inline QR card, no navigation to /checkout
      return;
    }
    const checkoutPath = getSubdomain()
      ? `/checkout/${event.id}`
      : `/public/${resolvedCompanyId}/checkout/${event.id}`;
    const accessCode = event.isPrivate
      ? sessionStorage.getItem(`eventAccessCode:${event.id}`) ?? undefined
      : undefined;
    navigate(checkoutPath, { state: { quantities, accessCode } });
  };

  // Consent checkbox lives under "Before you book" — a CTA tapped before it's
  // ticked scrolls the customer there and shows what's missing.
  const scrollToConsent = () => {
    document.getElementById('before-you-book')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setConsentHighlight(true);
  };

  const scrollToTickets = () => {
    document.getElementById('tickets')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCta = () => {
    if (consentBlocking) {
      scrollToConsent();
      return;
    }
    handleGetTickets();
  };

  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue)}`;
  const isTicketed = event.registrationMode !== 'rsvp';
  const showMobileBar = !allSoldOut && isTicketed;
  const showBookingCard = isTicketed && !allSoldOut && totalTickets === 0;
  const continueLabel = consentBlocking ? 'Acknowledge to continue' : 'Continue';

  const infoRows = [
    {
      key: 'when',
      icon: Calendar,
      title: formatLongDateRange(event.date, event.endDate),
      detail: [formatTime(event.time), event.arriveByTime ? `Arrive by ${formatTime(event.arriveByTime)}` : '']
        .filter(Boolean)
        .join(' · '),
    },
    {
      key: 'where',
      icon: event.isOnline ? Wifi : MapPin,
      title: event.isOnline ? 'Online' : event.venue,
      detail: event.isOnline ? 'The joining link is shared with ticket holders before the event.' : '',
    },
    ...(event.ageLimit ? [{ key: 'age', icon: ShieldCheck, title: event.ageLimit, detail: 'Age limit' }] : []),
  ];

  // ── Ticket panel (right rail on desktop / right-after-title on mobile) ──
  const ticketPanel =
    event.registrationMode === 'rsvp' ? (
      <div className={`${panelClass} flex flex-col gap-3`}>
        <h2 className="brand-display text-2xl leading-none text-[var(--brand-black)]">RSVP</h2>
        <p className="text-[15px] leading-[22px] text-[var(--brand-muted)]">
          This event doesn&rsquo;t need a ticket. Register through the organizer&rsquo;s form to attend.
        </p>
        {event.rsvpLink ? (
          <a
            href={consentBlocking ? undefined : event.rsvpLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (consentBlocking) {
                e.preventDefault();
                scrollToConsent();
              }
            }}
            className={`${brandButtonClass('primary', { block: true })} cursor-pointer`}
          >
            {consentBlocking ? 'Acknowledge to continue' : event.rsvpButtonLabel || 'RSVP'}
          </a>
        ) : (
          <p className="text-[13px] font-medium text-[var(--brand-danger)]">The RSVP link isn&rsquo;t set up yet. Check back soon.</p>
        )}
      </div>
    ) : (
      <TicketPanel
        maxPerOrder={maxPerOrder}
        allSoldOut={allSoldOut}
        emptyMessage={
          codeAlreadyUsed
            ? 'You’ve already booked tickets with this access code. Ask the organizer for a new code to book more.'
            : visibleTiers.length === 0
              ? 'No tickets are available for this event right now.'
              : 'All tickets for this event are sold out.'
        }
        tiers={visibleTiers.map((tier) => {
          const remaining = remainingFor(tier.id);
          const soldOut = remaining <= 0;
          const qty = quantities[tier.id] ?? 0;
          return {
            id: tier.id,
            name: tier.name,
            priceLabel: formatRupees(tier.price),
            remainingLabel: settings.ticketDisplay.showTicketsRemaining && !soldOut ? `${displayRemainingFor(tier.id)} left` : undefined,
            qty,
            soldOut,
            salesEnded: soldOut && tier.sold >= tier.quantity,
            onDecrement: () => setQty(tier.id, qty - 1),
            onIncrement: () => setQty(tier.id, qty + 1),
            decrementDisabled: qty === 0,
            incrementDisabled: qty >= remaining || totalTickets >= maxPerOrder,
          };
        })}
        lineItems={selectedTiersBreakdown.map((b) => ({
          id: b.id,
          label: `${b.qty} × ${b.name}`,
          amountLabel: formatRupees(b.subtotal),
        }))}
        countLabel={ticketCountLabel}
        totalLabel={totalLabel}
        ctaLabel={continueLabel}
        onCta={handleCta}
        ctaDisabled={totalTickets === 0}
        hideCtaOnMobile={showMobileBar}
      />
    );

  return (
    <div className={`brand-theme flex min-h-screen w-full flex-col bg-[var(--brand-cream)] text-[var(--brand-black)] ${showMobileBar ? 'pb-24 lg:pb-0' : ''}`}>
      <BrandNavHeader organizationName={settings.organizationName} onBrowse={handleBack} />

      {/* ── Cover banner ─────────────────────────────────────────────── */}
      {/* Sized to the organizer's uploaded covers: 4:5 on phones when a mobile
          cover exists (1080×1350), 8:3 on desktop when a desktop cover exists
          (1600×600) — so each fills the banner instead of being letterboxed. */}
      <div
        className={`relative w-full shrink-0 overflow-hidden bg-gradient-to-br ${gradient} ${
          event.coverImageMobile ? 'aspect-[4/5] max-h-[80vh]' : 'h-64'
        } ${event.coverImageDesktop ? 'sm:aspect-[8/3] sm:h-auto sm:max-h-[34rem]' : 'sm:aspect-auto sm:h-[26rem]'}`}
      >
        {allSoldOut && (
          <div className="absolute -right-12 top-7 z-20 w-48 rotate-45 shadow-lg" aria-hidden="true">
            <div
              className="h-1 w-full"
              style={{ background: 'repeating-linear-gradient(135deg, #facc15 0 8px, #111827 8px 16px)' }}
            />
            <div className="bg-yellow-400 py-1.5 text-center text-xs font-extrabold uppercase tracking-wider text-black">
              Sold Out
            </div>
          </div>
        )}
        {(event.coverImageDesktop || event.coverImageMobile) ? (
          <CoverImageDisplay
            desktopSrc={event.coverImageDesktop}
            mobileSrc={event.coverImageMobile}
            alt={plainTitle}
            fill
          />
        ) : event.images && event.images.length > 0 && (
          <>
            {event.images.map((src, i) => (
              <img
                key={src + i}
                src={src}
                alt={`${plainTitle} photo ${i + 1}`}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 motion-reduce:transition-none ${i === activeImageIndex ? 'opacity-100' : 'opacity-0'}`}
              />
            ))}
            {event.images.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setActiveImageIndex((i) => (i - 1 + event.images.length) % event.images.length)
                  }
                  className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-sm bg-[var(--brand-black)]/55 text-[var(--brand-cream)] transition-colors hover:bg-[var(--brand-black)]/75"
                  aria-label="Previous photo"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() =>
                    setActiveImageIndex((i) => (i + 1) % event.images.length)
                  }
                  className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-sm bg-[var(--brand-black)]/55 text-[var(--brand-cream)] transition-colors hover:bg-[var(--brand-black)]/75"
                  aria-label="Next photo"
                >
                  <ChevronRight size={20} />
                </button>
                <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
                  {event.images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImageIndex(i)}
                      className={`h-1.5 rounded-sm transition-all ${i === activeImageIndex ? 'w-6 bg-[var(--brand-yellow)]' : 'w-1.5 bg-white/60'
                        }`}
                      aria-label={`Photo ${i + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 sm:p-4">
          <button
            onClick={handleBack}
            className="flex h-10 items-center gap-1.5 rounded-sm bg-[var(--brand-black)]/55 px-3 text-sm font-semibold text-[var(--brand-cream)] transition-colors hover:bg-[var(--brand-black)]/75"
          >
            <ArrowLeft size={18} /> All events
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSaved((v) => !v)}
              aria-label="Save event"
              aria-pressed={saved}
              className="flex h-10 w-10 items-center justify-center rounded-sm bg-[var(--brand-black)]/55 text-[var(--brand-cream)] transition-colors hover:bg-[var(--brand-black)]/75"
            >
              <Heart size={18} className={saved ? 'fill-[var(--brand-yellow)] text-[var(--brand-yellow)]' : ''} />
            </button>
            <button
              onClick={shareThisEvent}
              aria-label="Share event"
              className="flex h-10 w-10 items-center justify-center rounded-sm bg-[var(--brand-black)]/55 text-[var(--brand-cream)] transition-colors hover:bg-[var(--brand-black)]/75"
            >
              <Share2 size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Body: title + content on the left, tickets in the right rail ── */}
      <main className="grow px-4 pt-6 pb-10 sm:px-8 lg:px-24 lg:pt-8">
        <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-12 lg:gap-y-0">
          {/* Title block */}
          <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1">
            <div className="flex flex-wrap gap-2">
              <BrandTag variant="neutral">{event.isOnline ? 'Online' : 'In person'}</BrandTag>
              <BrandTag variant="neutral">{label}</BrandTag>
            </div>
            <RichTextDisplay
              as="h1"
              html={event.title}
              className="brand-display leading-none text-[var(--brand-black)] [--title-size:32px] [text-wrap:balance] sm:[--title-size:44px]"
              style={{
                // The organizer's chosen size (or 32px phone / 44px desktop), but never
                // so big that the longest unbreakable run (a long word, or emojis
                // stuck to a word) can't fit on one line of a narrow screen.
                ['--title-size' as string]: event.titleStyle ? `${event.titleStyle.fontSize + 8}px` : undefined,
                fontSize: `min(var(--title-size), calc((100vw - 4rem) / ${longestRunEm(plainTitle)}))`,
                ...(event.titleStyle
                  ? {
                    fontWeight: event.titleStyle.fontWeight,
                    fontStyle: event.titleStyle.fontStyle,
                    color: event.titleStyle.color === '#FFFFFF' ? undefined : event.titleStyle.color,
                  }
                  : {}),
              }}
            />
            <ul className="mt-1 flex flex-col gap-4">
              {infoRows.map(({ key, icon: Icon, title, detail }) => (
                <li key={key} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--brand-line)] bg-[var(--brand-surface)]">
                    <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold leading-[22px]">{title}</p>
                    {detail && <p className="text-[13px] font-medium leading-[18px] text-[var(--brand-muted)]">{detail}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Right rail on desktop / right after the title on mobile */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto">
            {showBookingCard && (
              <div className={`${panelClass} hidden flex-col gap-4 lg:flex`}>
                <div className="flex flex-wrap gap-2">
                  <BrandTag variant="neutral">{event.isOnline ? 'Online' : 'In person'}</BrandTag>
                  {fewLeft && <BrandTag variant="highlight">Few left</BrandTag>}
                </div>
                <p className="brand-display line-clamp-2 text-2xl leading-[1.1]">{plainTitle}</p>
                <div className="flex flex-col gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    <Calendar size={18} strokeWidth={1.75} aria-hidden="true" />
                    {formatShortDateRange(event.date, event.endDate)}, {formatTime(event.time)}
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    {event.isOnline ? <Wifi size={18} strokeWidth={1.75} aria-hidden="true" /> : <MapPin size={18} strokeWidth={1.75} aria-hidden="true" />}
                    <span className="truncate">{event.isOnline ? 'Online' : event.venue}</span>
                  </span>
                </div>
                <div className="flex items-center gap-3 border-t border-[var(--brand-line)] pt-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-[var(--brand-muted)]">Starts at</p>
                    <p className="brand-display text-2xl leading-none tabular-nums">{startingPriceLabel}</p>
                  </div>
                  <BrandButton onClick={scrollToTickets}>Book tickets</BrandButton>
                </div>
              </div>
            )}
            <div id="tickets" className="scroll-mt-6">
              {ticketPanel}
            </div>
          </aside>

          {/* Content sections */}
          <div className="flex flex-col gap-10 lg:col-start-1 lg:row-start-2 lg:mt-12 lg:gap-12">
            {/* About */}
            <section className="flex flex-col gap-4">
              <SectionLabel>About the event</SectionLabel>
              <div className={panelClass}>
                <div
                  ref={aboutRef}
                  className="relative overflow-hidden"
                  style={!aboutExpanded && aboutOverflows ? { maxHeight: ABOUT_COLLAPSED_HEIGHT } : undefined}
                >
                  <RichTextDisplay
                    as="p"
                    html={event.description}
                    className={`whitespace-pre-line break-words text-[17px] leading-[26px] ${!event.descriptionStyle?.color || event.descriptionStyle.color === DEFAULT_TEXT_STYLE.color
                      ? 'text-[var(--brand-black)]'
                      : ''
                      }`}
                    style={event.descriptionStyle ? { fontSize: event.descriptionStyle.fontSize, fontWeight: event.descriptionStyle.fontWeight, fontStyle: event.descriptionStyle.fontStyle, color: event.descriptionStyle.color === DEFAULT_TEXT_STYLE.color ? undefined : event.descriptionStyle.color } : undefined}
                  />
                  {!aboutExpanded && aboutOverflows && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[var(--brand-surface)] to-transparent" />
                  )}
                </div>
                {aboutOverflows && (
                  <BrandButton variant="link" className="mt-3" onClick={() => setAboutExpanded((v) => !v)} aria-expanded={aboutExpanded}>
                    {aboutExpanded ? 'Show less' : 'Read more'}
                  </BrandButton>
                )}
              </div>
            </section>

            {/* Venue */}
            <section className="flex flex-col gap-4">
              <SectionLabel>{event.isOnline ? 'Joining online' : 'Venue'}</SectionLabel>
              <div className={`${panelClass} flex flex-wrap items-center justify-between gap-4`}>
                <div className="flex min-w-0 items-start gap-3">
                  {event.isOnline ? (
                    <Wifi size={20} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <MapPin size={20} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold leading-[22px]">{event.isOnline ? 'Online event' : event.venue}</p>
                    <p className="text-[13px] font-medium leading-[18px] text-[var(--brand-muted)]">
                      {event.isOnline
                        ? 'The joining link is shared with ticket holders before the event.'
                        : 'Opens the venue in Google Maps.'}
                    </p>
                  </div>
                </div>
                {!event.isOnline && (
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={brandButtonClass('secondary', { size: 'sm' })}
                  >
                    <ArrowUpRight size={18} /> Get directions
                  </a>
                )}
              </div>
            </section>

            {/* From past nights */}
            {event.pastEventsGallery && event.pastEventsGallery.length > 0 && (
              <section className="flex flex-col gap-4">
                <SectionLabel>From past nights</SectionLabel>
                {/* Bento with exactly as many cells as photos shown: one large tile,
                    up to two stacked beside it; the last tile opens the rest. */}
                <div
                  className={`grid gap-2 sm:gap-3 ${
                    event.pastEventsGallery.length === 1
                      ? 'grid-cols-1 grid-rows-[330px] sm:grid-rows-[510px]'
                      : event.pastEventsGallery.length === 2
                        ? 'grid-cols-[2fr_1fr] grid-rows-[300px] sm:grid-rows-[480px]'
                        : 'grid-cols-[2fr_1fr] grid-rows-[156px_156px] sm:grid-rows-[240px_240px] [&>*:first-child]:row-span-2'
                  }`}
                >
                  {event.pastEventsGallery.slice(0, 3).map((item, i) => {
                    const remaining = event.pastEventsGallery.length - 3;
                    const isLastVisible = i === 2 && remaining > 0;
                    return (
                      <button
                        key={item.url + i}
                        onClick={() => setLightboxIndex(i)}
                        aria-label={isLastVisible ? `Open past event photos, ${remaining} more` : `Open past event photo ${i + 1}`}
                        className="group relative h-full w-full overflow-hidden rounded-xl bg-[var(--brand-skeleton)]"
                      >
                        {item.type === 'video' ? (
                          <AutoplayVideo src={item.url} className="h-full w-full object-cover" />
                        ) : (
                          <img src={item.url} alt={`Past event ${i + 1}`} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none" />
                        )}
                        {isLastVisible && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white">
                            +{remaining} more
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Lightbox */}
            {lightboxIndex !== null && event.pastEventsGallery && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                onClick={() => setLightboxIndex(null)}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
                  className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-sm bg-white/20 text-white hover:bg-white/30"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
                {event.pastEventsGallery.length > 1 && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i! - 1 + event.pastEventsGallery.length) % event.pastEventsGallery.length); }}
                      className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-sm bg-black/40 text-white hover:bg-black/60"
                      aria-label="Previous"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i! + 1) % event.pastEventsGallery.length); }}
                      className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-sm bg-black/40 text-white hover:bg-black/60"
                      aria-label="Next"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </>
                )}
                <div className="max-h-[85vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
                  {event.pastEventsGallery[lightboxIndex].type === 'video' ? (
                    <video src={event.pastEventsGallery[lightboxIndex].url} className="max-h-[85vh] max-w-[90vw]" controls autoPlay loop playsInline />
                  ) : (
                    <img
                      src={event.pastEventsGallery[lightboxIndex].url}
                      alt={`Past event ${lightboxIndex + 1}`}
                      className="max-h-[85vh] max-w-[90vw] object-contain"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Before you book — only if the organizer set consent text */}
            {hasConsent && (
              <section id="before-you-book" className="flex scroll-mt-6 flex-col gap-4">
                <SectionLabel>Before you book</SectionLabel>
                <div
                  className={`${panelClass} transition-colors ${consentHighlight && consentBlocking ? 'border-[var(--brand-danger)]' : ''}`}
                >
                  <RichTextDisplay
                    as="p"
                    html={event.consentText ?? ''}
                    className={`whitespace-pre-line text-[15px] leading-[22px] ${!event.consentStyle?.color || event.consentStyle.color === DEFAULT_TEXT_STYLE.color
                      ? 'text-[var(--brand-black)]'
                      : ''
                      }`}
                    style={
                      event.consentStyle
                        ? {
                          fontSize: event.consentStyle.fontSize,
                          fontWeight: event.consentStyle.fontWeight,
                          fontStyle: event.consentStyle.fontStyle,
                          color:
                            event.consentStyle.color === DEFAULT_TEXT_STYLE.color
                              ? undefined
                              : event.consentStyle.color,
                        }
                        : undefined
                    }
                  />
                  <BrandCheckbox
                    checked={consentAcknowledged}
                    onChange={(checked) => {
                      setConsentAcknowledged(checked);
                      if (checked) setConsentHighlight(false);
                    }}
                    className="mt-4 font-medium"
                  >
                    I acknowledge the important information above.
                  </BrandCheckbox>
                  {consentHighlight && consentBlocking && (
                    <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-[var(--brand-danger)]">
                      <AlertCircle size={14} aria-hidden="true" /> Tick the box to continue booking.
                    </p>
                  )}
                </div>
              </section>
            )}
          </div>
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
        host={event.organizerName ? { name: event.organizerName, onMoreEvents: handleBack } : undefined}
        bio={settings.storefront.bio}
        contactEmail={settings.storefront.contactEmail}
        storeBasePath={getSubdomain() ? '' : resolvedCompanyId ? `/public/${resolvedCompanyId}` : ''}
      />

      {/* ── Floating bottom bar — mobile only, ticketed events ───────── */}
      {showMobileBar && (
        totalTickets === 0 ? (
          <MobileCheckoutBar
            countLabel="Starts at"
            totalLabel={startingPriceLabel}
            ctaLabel="Book tickets"
            onCta={scrollToTickets}
          />
        ) : (
          <MobileCheckoutBar
            countLabel={ticketCountLabel}
            totalLabel={totalLabel}
            ctaLabel={continueLabel}
            onCta={handleCta}
          />
        )
      )}

      {/* NEW — inline manual-QR payment card, rendered inside the same JSX tree */}
      {showManualQR && (
        <ManualQRPaymentCard
          event={event}
          totalAmount={totalAmount}
          breakdown={selectedTiersBreakdown}
          quantities={quantities}
          accessCode={event.isPrivate ? sessionStorage.getItem(`eventAccessCode:${event.id}`) ?? undefined : undefined}
          organizationName={settings.organizationName}
          onClose={() => setShowManualQR(false)}
          onSuccess={() => {
            // clear cart after a successful submission, same as a normal checkout would
            setQuantities({});
            sessionStorage.removeItem(`eventTicketQty:${event.id}`);
          }}
        />
      )}
    </div>
  );
};

export default CustomerEventDetail;
