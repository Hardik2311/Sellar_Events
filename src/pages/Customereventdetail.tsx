import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, MapPin, Wifi, Minus, Plus, User, Loader2, Ticket, X } from 'lucide-react';
import BackButton from '../components/ui/BackButton';
import { Card, CardContent } from '../components/ui/card';
import CoverImageDisplay from '../components/ui/CoverImageDisplay'; // NEW
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
      <div className="flex h-dvh w-full items-center justify-center bg-slate-100 dark:bg-[#0F172A]">
        <Loader2 className="animate-spin text-slate-400" size={24} />
      </div>
    );
  }

  if (domainError || (!loading && !event)) {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-slate-100 p-4 text-center dark:bg-[#0F172A]">
        <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center">
          <span className="text-2xl">🎟️</span>
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Event Not Found</h2>
        <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
          We couldn&apos;t find this event. It might have been removed or the link is incorrect.
        </p>
        <button
          onClick={() =>
            navigate(
              getSubdomain() ? '/' : resolvedCompanyId ? `/public/${resolvedCompanyId}` : '/'
            )
          }
          className="mt-2 rounded-md bg-[#007A78] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#006361] dark:bg-[#2DD4BF] dark:text-slate-900 dark:hover:bg-[#22b8a5]"
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
      <div className="fixed inset-0 z-50 h-dvh w-full overflow-hidden bg-slate-100 dark:bg-[#0F172A]">
        {bgImage && (
          <div
            className="absolute inset-0 scale-110 bg-cover bg-center blur-xl"
            style={{ backgroundImage: `url(${bgImage})` }}
            aria-hidden="true"
          />
        )}
        <div className="absolute inset-0 bg-black/55" aria-hidden="true" />

        {/* Popup card — frosted/translucent, floats over the dimmed backdrop */}
        <div className="relative z-10 flex h-full w-full items-center justify-center p-6">
          <div className="flex w-full max-w-xs flex-col items-center gap-4 rounded-lg border border-white/15 bg-white/10 p-6 text-center shadow-2xl backdrop-blur-xl">
            <Ticket size={28} className="text-[#2DD4BF]" />
            <div>
              <h2 className="text-base font-semibold text-white">Enter access code</h2>
              <p className="mt-1 text-sm text-slate-200">This event link is code-protected. Enter the code shared with you.</p>
            </div>
            <input
              type="text"
              value={codeInput}
              onChange={(e) => { setCodeInput(e.target.value); setCodeError(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleVerify(); }}
              placeholder="Enter code"
              maxLength={6}
              className="w-full rounded-sm border border-white/30 bg-white/95 py-2.5 px-3 text-center text-lg font-semibold tracking-widest uppercase text-slate-800 outline-none backdrop-blur-sm focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]"
            />
            {codeError && <p className="text-xs text-red-300">Incorrect code. Please try again.</p>}
            <button
              onClick={handleVerify}
              disabled={!codeInput.trim()}
              className="w-full rounded-sm bg-[#007A78] py-2.5 text-sm font-semibold text-white hover:bg-[#2DD4BF] disabled:opacity-40"
            >
              Unlock event
            </button>
          </div>
        </div>
      </div>
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
      .filter(([id]) => id !== tierId)
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
  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200">
      {/* ── Header / hero ───────────────────────────────────────────── */}
      <div className={`relative h-74 w-full shrink-0 overflow-hidden bg-gradient-to-br ${gradient}`}>
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
                <div className="absolute bottom-14 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
          <BackButton className="border-white/40 bg-white/90 hover:bg-white" />
        </div>

        {/* category badge — back to its original spot, overlaid on the image */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <span className="inline-block w-fit rounded-sm bg-white/90 px-2 py-0.5 text-xs font-medium text-slate-700">
            {label}
          </span>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="p-2 pb-24">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {/* Title */}
          <Card className="shadow-sm border-gray-200 dark:border-slate-800 dark:bg-[#1E293B]">
            <CardContent className="pt-4">
              <RichTextDisplay
                as="h1"
                html={event.title}
                className="text-2xl font-bold text-slate-900 dark:text-white"
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
            </CardContent>
          </Card>

          {/* Key details */}
          <Card className="shadow-sm border-gray-200 dark:border-slate-800 dark:bg-[#1E293B]">
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-start gap-3">
                <Calendar size={18} className="mt-0.5 shrink-0 text-[#007A78] dark:text-[#2DD4BF]" />
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{formatDateRange(event.date, event.endDate)}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <Clock size={12} /> {formatTime(event.time)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                {event.isOnline ? (
                  <Wifi size={18} className="mt-0.5 shrink-0 text-[#007A78] dark:text-[#2DD4BF]" />
                ) : (
                  <MapPin size={18} className="mt-0.5 shrink-0 text-[#007A78] dark:text-[#2DD4BF]" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{event.isOnline ? 'Online event' : event.venue}</p>
                  {event.isOnline && <p className="text-xs text-slate-500 dark:text-slate-400">Link shared with ticket holders before the event</p>}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User size={18} className="mt-0.5 shrink-0 text-[#007A78] dark:text-[#2DD4BF]" />
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{event.organizerName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Organizer</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* About */}
          <Card className="shadow-sm border-gray-200 dark:border-slate-800 dark:bg-[#1E293B]">
            <CardContent className="pt-4">
              <h2 className="mb-2 text-base font-semibold text-gray-900 dark:text-slate-100">About this event</h2>
              <RichTextDisplay
                as="p"
                html={event.description}
                className={`whitespace-pre-line leading-relaxed break-words ${!event.descriptionStyle?.color || event.descriptionStyle.color === DEFAULT_TEXT_STYLE.color
                  ? 'text-slate-800 dark:text-slate-100'
                  : ''
                  }`}
                style={event.descriptionStyle ? { fontSize: event.descriptionStyle.fontSize, fontWeight: event.descriptionStyle.fontWeight, fontStyle: event.descriptionStyle.fontStyle, color: event.descriptionStyle.color === DEFAULT_TEXT_STYLE.color ? undefined : event.descriptionStyle.color } : undefined}
              />
            </CardContent>
          </Card>

          {event.pastEventsGallery && event.pastEventsGallery.length > 0 && (
            <Card className="shadow-sm border-gray-200 dark:border-slate-800 dark:bg-[#1E293B]">
              <CardContent className="pt-4">
                <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-slate-100">Past Events</h2>
                <div className="grid grid-cols-3 gap-2">
                  {event.pastEventsGallery.slice(0, 6).map((item, i) => {
                    const remaining = event.pastEventsGallery.length - 6;
                    const isLastVisible = i === 5 && remaining > 0;
                    return (
                      <button
                        key={item.url + i}
                        onClick={() => setLightboxIndex(i)}
                        className="group relative aspect-square overflow-hidden rounded-sm bg-slate-100 dark:bg-slate-800"
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

          {/* Consent / Important Information */}
          {hasConsent && (
            <Card className="shadow-sm border-gray-200 dark:border-slate-800 dark:bg-[#1E293B]">
              <CardContent className="pt-4">
                <h2 className="mb-2 text-base font-semibold text-gray-900 dark:text-slate-100">Important Information &amp; Consent</h2>
                <RichTextDisplay
                  as="p"
                  html={event.consentText ?? ''}
                  className={`whitespace-pre-line leading-relaxed mb-3 ${!event.consentStyle?.color || event.consentStyle.color === DEFAULT_TEXT_STYLE.color
                    ? 'text-slate-800 dark:text-slate-100'
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
                <label className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentAcknowledged}
                    onChange={(e) => setConsentAcknowledged(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 bg-white accent-[#007A78] [color-scheme:light]"
                  />
                  Acknowledged
                </label>
              </CardContent>
            </Card>
          )}

          {/* Tickets, or RSVP link if this is an RSVP event */}
          <Card className="shadow-sm border-gray-200 dark:border-slate-800 dark:bg-[#1E293B]">
            <CardContent className="pt-4">
              {event.registrationMode === 'rsvp' ? (
                <>
                  <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-slate-100">RSVP</h2>
                  <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                    This event doesn&rsquo;t need a ticket — register through the organizer&rsquo;s form to attend.
                  </p>
                  {event.rsvpLink ? (
                    <a
                      href={consentBlocking ? undefined : event.rsvpLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-disabled={consentBlocking}
                      onClick={(e) => { if (consentBlocking) e.preventDefault(); }}
                      className={`inline-flex items-center gap-1.5 rounded-sm bg-[#007A78] px-4 py-2 text-sm font-semibold text-white hover:bg-[#006361] ${consentBlocking ? 'opacity-40 pointer-events-none' : ''}`}
                    >
                      {event.rsvpButtonLabel || 'RSVP Now'}
                    </a>
                  ) : (
                    <p className="text-xs text-red-500 dark:text-red-400">RSVP link isn&rsquo;t set up yet — check back soon.</p>
                  )}
                  {consentBlocking && (
                    <p className="mt-2 text-xs text-red-500 dark:text-red-400">Please acknowledge the important information above to continue.</p>
                  )}
                </>
              ) : (
                <>
                  <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-slate-100">Tickets</h2>

                  {allSoldOut ? (
                    <p className="rounded-sm bg-slate-50 dark:bg-slate-800 p-3 text-sm text-slate-500 dark:text-slate-400">
                      {visibleTiers.length === 0
                        ? 'No tickets are available for this event right now.'
                        : 'All tickets for this event are sold out.'}
                    </p>
                  ) : (
                    <div className="flex flex-col divide-y divide-gray-100 dark:divide-slate-800">
                      {visibleTiers.map((tier) => {
                        const remaining = remainingFor(tier.id);
                        const soldOut = remaining <= 0;
                        const qty = quantities[tier.id] ?? 0;

                        return (
                          <div key={tier.id} className="flex items-center justify-between gap-3 py-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{tier.name}</p>
                              <p className="text-sm font-semibold text-[#007A78]">
                                {tier.price === 0 ? 'Free' : `\u20B9${tier.price.toLocaleString('en-IN')}`}
                              </p>
                              {settings.ticketDisplay.showTicketsRemaining && (
                                <p className="text-xs text-slate-400 dark:text-slate-500">
                                  {soldOut ? 'Sold out' : `${displayRemainingFor(tier.id)} left`}
                                </p>
                              )}
                            </div>

                            {soldOut ? (
                              <span className="rounded-sm bg-gray-100 dark:bg-slate-700 px-3 py-1.5 text-xs font-medium text-gray-400 dark:text-slate-400">Sold out</span>
                            ) : (
                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  onClick={() => setQty(tier.id, qty - 1)}
                                  disabled={qty === 0}
                                  className="rounded-sm border border-gray-300 dark:border-slate-600 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-30"
                                >
                                  <Minus size={14} />
                                </button>
                                <span className="w-5 text-center text-sm font-medium text-slate-800 dark:text-slate-100">{qty}</span>
                                <button
                                  onClick={() => setQty(tier.id, qty + 1)}
                                  disabled={qty >= remaining || totalTickets >= maxPerOrder}
                                  className="rounded-sm border border-gray-300 dark:border-slate-600 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-30"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* ── Sticky checkout bar — only for ticketed events ───────────── */}
      {!allSoldOut && event.registrationMode !== 'rsvp' && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-3 flex justify-center gap-3 z-30">
          <div className="flex w-full max-w-3xl items-center gap-3">
            <div className="flex-1">
              <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                {totalTickets > 0 ? `${totalTickets} ticket${totalTickets === 1 ? '' : 's'} selected` : 'Select tickets'}
              </p>
            </div>
            <button
              onClick={handleGetTickets}
              disabled={totalTickets === 0 || consentBlocking}
              className="flex-1 rounded-sm bg-[#007A78] py-2.5 text-sm font-semibold text-white hover:bg-[#2DD4BF] disabled:opacity-40 disabled:hover:bg-[#2DD4BF] transition-colors"
            >
              {consentBlocking ? 'Acknowledge to continue' : 'Get tickets'}
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