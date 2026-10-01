import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Wifi, Heart, Share2, X, Navigation } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import CoverImageDisplay from '../components/ui/CoverImageDisplay';
import {
  CATEGORY_GRADIENTS,
  getCategoryLabel,
  formatDateRange,
  formatTime,
  isTierExpired,
} from '../data/events';
import { usePublicEvent, verifyAccessCode } from '../hooks/usePublicEvents';
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
import { stripHtmlTags } from '../lib/utils';

const CustomerEventDetail: React.FC = () => {
  const { slug, companyId } = useParams<{ slug: string; companyId?: string }>();
  const id = slug ? parseEventIdFromSlug(slug) : undefined;
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();

  const { resolvedCompanyId, loading: domainLoading, error: domainError } = useDomainResolution(companyId);
  const { event, loading: eventLoading } = usePublicEvent(id, resolvedCompanyId);
  const { settings } = useCompanySettings(resolvedCompanyId);

  const loading = domainLoading || eventLoading;

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [showManualQR, setShowManualQR] = useState(false);
  const [saved, setSaved] = useState(false);

  // NEW — access-code gate state
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    if (!event?.id) return;

    const isOrganizerLivePreview =
      searchParams.get('preview') === '1' &&
      !!profile?.companyId &&
      profile.companyId === event.companyId;

    if (isOrganizerLivePreview) {
      setIsVerified(true);
      return;
    }

    // Gate driven by `isPrivate` — `activeAccessCode` was never populated by
    // the mapper, so this check was always false and every private event
    // unlocked itself instantly without asking for a code.
    if (!event.isPrivate) {
      setIsVerified(true);
      return;
    }
    const savedVerified = sessionStorage.getItem(`eventAccessVerified:${event.id}`);
    if (savedVerified === 'true') {
      setIsVerified(true);
    }
  }, [event?.id, event?.isPrivate, event?.companyId, profile?.companyId, searchParams]);

  useEffect(() => {
    setActiveImageIndex(0); // event change hone par reset
    setConsentAcknowledged(false);

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
  if (loading) {
    return (
      <div className="brand-theme flex h-dvh w-full items-center justify-center bg-[var(--brand-cream)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--brand-teal)] border-t-transparent" />
      </div>
    );
  }

  if (domainError || (!loading && !event)) {
    return (
      <div className="brand-theme flex h-dvh w-full flex-col items-center justify-center gap-4 bg-[var(--brand-cream)] p-4 text-center">
        <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center">
          <span className="text-2xl">🎟️</span>
        </div>
        <h2 className="brand-display text-xl text-[var(--brand-black)]">Event not found</h2>
        <p className="max-w-xs text-sm text-black/50">
          We couldn&apos;t find this event. It might have been removed or the link is incorrect.
        </p>
        <button
          onClick={() =>
            navigate(
              getSubdomain() ? '/' : resolvedCompanyId ? `/public/${resolvedCompanyId}` : '/'
            )
          }
          className="brand-mono mt-2 rounded-sm bg-[var(--brand-yellow)] px-6 py-2.5 text-xs font-bold text-black shadow-sm hover:brightness-95"
        >
          Return to Events
        </button>
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
      if (verifyAccessCode(event, codeInput)) {
        sessionStorage.setItem(`eventAccessVerified:${event.id}`, 'true');
        // Saved alongside the verified flag so it can be attached to the
        // ticket at booking time and shown back to the attendee.
        sessionStorage.setItem(`eventAccessCode:${event.id}`, codeInput.trim().toUpperCase());
        setIsVerified(true);
        setCodeError(false);
      } else {
        setCodeError(true);
      }
    };

    const bgImage = event.coverImageDesktop || event.coverImageMobile || event.images?.[0];

    return (
      <PrivateAccessGate
        organizationName={settings.organizationName}
        bgImage={bgImage}
        codeInput={codeInput}
        onCodeChange={(v) => { setCodeInput(v); setCodeError(false); }}
        onVerify={handleVerify}
        codeError={codeError}
      />
    );
  }

  const label = getCategoryLabel(event);
  const gradient = CATEGORY_GRADIENTS[event.category] ?? CATEGORY_GRADIENTS.Other;

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
  const allSoldOut =
    visibleTiers.length === 0 || visibleTiers.every((t) => t.sold >= t.quantity);
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

  const handleBack = () => {
    navigate(getSubdomain() ? '/' : resolvedCompanyId ? `/public/${resolvedCompanyId}` : '/');
  };

  const shareThisEvent = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: stripHtmlTags(event.title), url: shareUrl });
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

  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue)}`;

  // ── Ticket panel (right rail on desktop / right-after-title on mobile) ──
  const ticketPanel =
    event.registrationMode === 'rsvp' ? (
      <div className="rounded-lg border border-black/10 bg-white p-4">
        <h2 className="brand-display text-lg text-[var(--brand-black)]">RSVP</h2>
        <p className="mt-2 text-sm text-slate-600">
          This event doesn&rsquo;t need a ticket — register through the organizer&rsquo;s form to attend.
        </p>
        {event.rsvpLink ? (
          <a
            href={consentBlocking ? undefined : event.rsvpLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={consentBlocking}
            onClick={(e) => { if (consentBlocking) e.preventDefault(); }}
            className={`brand-mono mt-3 inline-flex items-center gap-1.5 rounded-sm bg-[var(--brand-yellow)] px-4 py-2 text-xs font-bold text-black hover:brightness-95 ${consentBlocking ? 'opacity-40 pointer-events-none' : ''}`}
          >
            {event.rsvpButtonLabel || 'RSVP Now'}
          </a>
        ) : (
          <p className="mt-3 text-xs text-red-500">RSVP link isn&rsquo;t set up yet — check back soon.</p>
        )}
        {consentBlocking && (
          <p className="mt-2 text-xs text-red-500">Please acknowledge the important information above to continue.</p>
        )}
      </div>
    ) : (
      <TicketPanel
        maxPerOrder={maxPerOrder}
        allSoldOut={allSoldOut}
        emptyMessage={visibleTiers.length === 0 ? 'No tickets are available for this event right now.' : 'All tickets for this event are sold out.'}
        tiers={visibleTiers.map((tier) => {
          const remaining = remainingFor(tier.id);
          const soldOut = remaining <= 0;
          const qty = quantities[tier.id] ?? 0;
          return {
            id: tier.id,
            name: tier.name,
            priceLabel: tier.price === 0 ? 'Free' : `₹${tier.price.toLocaleString('en-IN')}`,
            remainingLabel: settings.ticketDisplay.showTicketsRemaining ? (soldOut ? 'Sold out' : `${displayRemainingFor(tier.id)} left`) : undefined,
            qty,
            soldOut,
            salesEnded: soldOut && tier.sold >= tier.quantity,
            onDecrement: () => setQty(tier.id, qty - 1),
            onIncrement: () => setQty(tier.id, qty + 1),
            decrementDisabled: qty === 0,
            incrementDisabled: qty >= remaining || totalTickets >= maxPerOrder,
          };
        })}
        consent={
          hasConsent
            ? { text: 'I acknowledge the important information above.', acknowledged: consentAcknowledged, onToggle: setConsentAcknowledged }
            : undefined
        }
        lineItems={selectedTiersBreakdown.map((b) => ({
          id: b.id,
          label: `${b.qty}× ${b.name}`,
          amountLabel: b.subtotal === 0 ? 'Free' : `₹${b.subtotal.toLocaleString('en-IN')}`,
        }))}
        totalLabel={totalAmount === 0 && totalTickets > 0 ? 'Free' : `₹${totalAmount.toLocaleString('en-IN')}`}
        ctaLabel={consentBlocking ? 'Acknowledge to continue' : 'Continue to checkout'}
        onCta={handleGetTickets}
        ctaDisabled={totalTickets === 0 || consentBlocking}
      />
    );

  return (
    <div className="brand-theme flex min-h-screen w-full flex-col bg-[var(--brand-cream)] text-[var(--brand-black)]">
      <BrandNavHeader organizationName={settings.organizationName} onBrowse={handleBack} />

      {/* ── Cover banner ─────────────────────────────────────────────── */}
      <div className={`relative w-full shrink-0 overflow-hidden bg-gradient-to-br aspect-[4/3] sm:aspect-[21/6] sm:max-h-[340px] ${gradient}`}>
        {(event.coverImageDesktop || event.coverImageMobile) ? (
          <CoverImageDisplay
            desktopSrc={event.coverImageDesktop}
            mobileSrc={event.coverImageMobile}
            alt={event.title}
          />
        ) : event.images && event.images.length > 0 && (
          <>
            {event.images.map((src, i) => (
              <img
                key={src + i}
                src={src}
                alt={`${event.title} photo ${i + 1}`}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === activeImageIndex ? 'opacity-100' : 'opacity-0'}`}
              />
            ))}
            {event.images.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setActiveImageIndex((i) => (i - 1 + event.images.length) % event.images.length)
                  }
                  className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-sm bg-black/40 p-1.5 text-white hover:bg-black/60 transition-colors"
                  aria-label="Previous photo"
                >
                  <ArrowLeft size={16} />
                </button>
                <button
                  onClick={() =>
                    setActiveImageIndex((i) => (i + 1) % event.images.length)
                  }
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-sm bg-black/40 p-1.5 text-white hover:bg-black/60 transition-colors rotate-180"
                  aria-label="Next photo"
                >
                  <ArrowLeft size={16} />
                </button>
                <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
                  {event.images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImageIndex(i)}
                      className={`h-1.5 rounded-sm transition-all ${i === activeImageIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
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
            className="brand-mono flex items-center gap-1.5 rounded-sm bg-black/50 px-3 py-2 text-xs font-bold text-white hover:bg-black/70 transition-colors"
          >
            <ArrowLeft size={14} /> All events
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSaved((v) => !v)}
              aria-label="Save event"
              className="rounded-sm bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
            >
              <Heart size={16} className={saved ? 'fill-[var(--brand-yellow)] text-[var(--brand-yellow)]' : ''} />
            </button>
            <button
              onClick={shareThisEvent}
              aria-label="Share event"
              className="rounded-sm bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
            >
              <Share2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Title band ───────────────────────────────────────────────── */}
      <div className="border-b border-black/10 bg-white px-4 py-5 sm:px-8 lg:px-24">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="brand-mono flex items-center gap-2 text-[10px] font-bold">
              <span className="rounded-sm bg-[var(--brand-yellow)] px-2 py-0.5 text-black">{label}</span>
              <span className="rounded-sm bg-[var(--brand-teal)] px-2 py-0.5 text-white">{event.isOnline ? 'Online' : 'In person'}</span>
            </div>
            <RichTextDisplay
              as="h1"
              html={event.title}
              className="brand-display mt-2 text-3xl leading-tight text-[var(--brand-black)] sm:text-4xl"
              style={
                event.titleStyle
                  ? {
                    fontSize: event.titleStyle.fontSize + 8,
                    fontWeight: event.titleStyle.fontWeight,
                    fontStyle: event.titleStyle.fontStyle,
                    color: event.titleStyle.color === '#FFFFFF' ? undefined : event.titleStyle.color,
                  }
                  : undefined
              }
            />
          </div>

          <div className="brand-mono flex shrink-0 flex-wrap gap-x-5 gap-y-1 text-[11px] text-black/50 sm:text-right">
            <span>
              <span className="text-black/30">Runs</span> {formatDateRange(event.date, event.endDate)}
            </span>
            <span>
              <span className="text-black/30">Starts</span> {formatTime(event.time)}
            </span>
            <span>
              <span className="text-black/30">Where</span> {event.isOnline ? 'Online' : event.venue}
            </span>
          </div>
        </div>
      </div>

      {/* ── Body: main column + ticket panel ────────────────────────── */}
      <main className="grow px-4 py-6 pb-24 sm:px-8 lg:px-24 lg:pb-10">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
          {/* Ticket panel — first on mobile (right after title), right rail on desktop */}
          <div className="order-1 lg:order-2 lg:w-[380px] lg:shrink-0">
            <div className="lg:sticky lg:top-6">{ticketPanel}</div>
          </div>

          {/* Content sections */}
          <div className="order-2 flex flex-col gap-5 lg:order-1 lg:w-[760px]">
            {/* 01 About the night */}
            <div>
              <SectionLabel index={1} className="mb-2">About the night</SectionLabel>
              <Card className="shadow-sm border-black/10 bg-white">
                <CardContent className="pt-4">
                  <RichTextDisplay
                    as="p"
                    html={event.description}
                    className={`whitespace-pre-line leading-relaxed break-words ${!event.descriptionStyle?.color || event.descriptionStyle.color === DEFAULT_TEXT_STYLE.color
                      ? 'text-slate-800'
                      : ''
                      }`}
                    style={event.descriptionStyle ? { fontSize: event.descriptionStyle.fontSize, fontWeight: event.descriptionStyle.fontWeight, fontStyle: event.descriptionStyle.fontStyle, color: event.descriptionStyle.color === DEFAULT_TEXT_STYLE.color ? undefined : event.descriptionStyle.color } : undefined}
                  />
                </CardContent>
              </Card>
            </div>

            {/* 02 Where & when */}
            <div>
              <SectionLabel index={2} className="mb-2">Where &amp; when</SectionLabel>
              <Card className="shadow-sm border-black/10 bg-white">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-sm bg-slate-50 p-3 text-center">
                      <p className="brand-mono text-[9px] text-black/40">Starts</p>
                      <p className="mt-1 text-xs font-semibold text-slate-800">{event.date}</p>
                    </div>
                    <div className="rounded-sm bg-slate-50 p-3 text-center">
                      <p className="brand-mono text-[9px] text-black/40">Ends</p>
                      <p className="mt-1 text-xs font-semibold text-slate-800">{event.endDate || event.date}</p>
                    </div>
                    <div className="rounded-sm bg-slate-50 p-3 text-center">
                      <p className="brand-mono text-[9px] text-black/40">Time</p>
                      <p className="mt-1 text-xs font-semibold text-slate-800">{formatTime(event.time)}</p>
                    </div>
                  </div>

                  {event.isOnline ? (
                    <div className="mt-3 flex items-center gap-3 rounded-sm bg-[var(--brand-black)] p-3">
                      <Wifi size={18} className="shrink-0 text-[var(--brand-yellow)]" />
                      <div>
                        <p className="text-sm font-medium text-white">Online event</p>
                        <p className="text-xs text-white/50">The joining link is shared with ticket holders before the event.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-sm bg-slate-50 p-3">
                      <div className="flex items-start gap-3">
                        <MapPin size={18} className="mt-0.5 shrink-0 text-[var(--brand-teal)]" />
                        <div>
                          <p className="text-sm font-medium text-slate-800">{event.venue}</p>
                          <p className="text-xs text-slate-500">Venue address</p>
                        </div>
                      </div>
                      <a
                        href={directionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="brand-mono flex shrink-0 items-center gap-1 rounded-sm bg-[var(--brand-black)] px-3 py-1.5 text-[10px] font-bold text-white hover:brightness-110"
                      >
                        <Navigation size={11} /> Get directions
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 03 From past nights */}
            {event.pastEventsGallery && event.pastEventsGallery.length > 0 && (
              <div>
                <SectionLabel index={3} className="mb-2">From past nights</SectionLabel>
                <Card className="shadow-sm border-black/10 bg-white">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-3 gap-2 sm:grid-rows-2 sm:[&>*:first-child]:col-span-2 sm:[&>*:first-child]:row-span-2">
                      {event.pastEventsGallery.slice(0, 6).map((item, i) => {
                        const remaining = event.pastEventsGallery.length - 6;
                        const isLastVisible = i === 5 && remaining > 0;
                        return (
                          <button
                            key={item.url + i}
                            onClick={() => setLightboxIndex(i)}
                            className="group relative aspect-square overflow-hidden rounded-sm bg-slate-100"
                          >
                            {item.type === 'video' ? (
                              <video src={item.url} className="h-full w-full object-cover" muted playsInline />
                            ) : (
                              <img src={item.url} alt={`Past event ${i + 1}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
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
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Lightbox */}
            {lightboxIndex !== null && event.pastEventsGallery && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                onClick={() => setLightboxIndex(null)}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
                  className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
                {event.pastEventsGallery.length > 1 && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i! - 1 + event.pastEventsGallery.length) % event.pastEventsGallery.length); }}
                      className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
                      aria-label="Previous"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i! + 1) % event.pastEventsGallery.length); }}
                      className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 rotate-180"
                      aria-label="Next"
                    >
                      <ArrowLeft size={20} />
                    </button>
                  </>
                )}
                <div className="max-h-[85vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
                  {event.pastEventsGallery[lightboxIndex].type === 'video' ? (
                    <video src={event.pastEventsGallery[lightboxIndex].url} className="max-h-[85vh] max-w-[90vw]" controls autoPlay />
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

            {/* 04 Before you book — only if the organizer set consent text */}
            {hasConsent && (
              <div>
                <SectionLabel index={4} className="mb-2">Before you book</SectionLabel>
                <Card className="shadow-sm border-black/10 bg-white">
                  <CardContent className="pt-4">
                    <RichTextDisplay
                      as="p"
                      html={event.consentText ?? ''}
                      className={`whitespace-pre-line leading-relaxed ${!event.consentStyle?.color || event.consentStyle.color === DEFAULT_TEXT_STYLE.color
                        ? 'text-slate-800'
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
                    <p className="brand-mono mt-3 text-[10px] text-black/40">
                      You&rsquo;ll acknowledge this in the ticket panel before continuing.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 05 Your host */}
            <div>
              <SectionLabel index={hasConsent ? 5 : 4} className="mb-2">Your host</SectionLabel>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-[var(--brand-black)] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-[var(--brand-yellow)]">
                    <span className="brand-display text-lg text-black">{event.organizerName?.[0]?.toUpperCase() || 'S'}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{event.organizerName}</p>
                    <p className="brand-mono text-[10px] text-white/40">Organizer</p>
                  </div>
                </div>
                <button
                  onClick={handleBack}
                  className="brand-mono shrink-0 rounded-sm border border-white/20 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-white/10"
                >
                  More events &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <CustomerFooter variant="slim" organizationName={settings.organizationName} />

      {/* ── Floating bottom bar — mobile only, ticketed events ───────── */}
      {!allSoldOut && event.registrationMode !== 'rsvp' && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-black/10 bg-white p-3 flex justify-center gap-3 z-30 lg:hidden">
          <div className="flex w-full items-center gap-3">
            <div className="flex-1">
              <p className="brand-mono text-[10px] text-black/40">{totalTickets} ticket{totalTickets === 1 ? '' : 's'}</p>
              <p className="brand-display text-lg text-[var(--brand-black)]">
                {totalAmount === 0 && totalTickets > 0 ? 'Free' : `₹${totalAmount.toLocaleString('en-IN')}`}
              </p>
            </div>
            <button
              onClick={handleGetTickets}
              disabled={totalTickets === 0 || consentBlocking}
              className="brand-mono flex-1 rounded-sm bg-[var(--brand-yellow)] py-2.5 text-xs font-bold text-black hover:brightness-95 disabled:opacity-40 transition-colors"
            >
              {consentBlocking ? 'Acknowledge to continue' : 'Checkout'}
            </button>
          </div>
        </div>
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
