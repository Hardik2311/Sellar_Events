import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, MapPin, Wifi, Share2, Minus, Plus, Ticket, User, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import {
  CATEGORY_GRADIENTS,
  getCategoryLabel,
  formatDateRange,
  formatTime,
  isTierExpired,
} from '../data/events';
import { usePublicEvent } from '../hooks/usePublicEvents';
import { useCompanySettings } from '../hooks/useSettings';
import { parseEventIdFromSlug } from '../data/events';

const CustomerEventDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const id = slug ? parseEventIdFromSlug(slug) : undefined;
  const navigate = useNavigate();
  const { event, loading } = usePublicEvent(id);
  const { settings } = useCompanySettings();

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [pastEventIndex, setPastEventIndex] = useState(0);

  useEffect(() => {
    setActiveImageIndex(0); // event change hone par reset
    setPastEventIndex(0);
  }, [event?.id]);
  if (loading) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-slate-100 dark:bg-[#0F172A]">
        <Loader2 className="animate-spin text-slate-400" size={24} />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-3 bg-slate-100 dark:bg-[#0F172A] p-6 text-center">
        <Ticket size={28} className="text-gray-300 dark:text-slate-600" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">This event doesn&rsquo;t exist or isn&rsquo;t published yet.</p>
        <button
          onClick={() => navigate('/discover')}
          className="rounded-sm bg-[#007A78] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2DD4BF]"
        >
          Back to events
        </button>
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

  const setQty = (tierId: string, next: number) => {
    const max = remainingFor(tierId);
    const clamped = Math.max(0, Math.min(next, max, 10)); // 10-per-order cap, same as most ticketing flows
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

  const handleGetTickets = () => {
    navigate(`/checkout/${event.id}`, { state: { quantities } });
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200">
      {/* ── Header / hero ───────────────────────────────────────────── */}
      <div className={`relative h-64 w-full shrink-0 overflow-hidden bg-gradient-to-br ${gradient}`}>
        {event.images && event.images.length > 0 && (
          <>
            {event.images.map((src, i) => (
              <img
                key={src + i}
                src={src}
                alt={`${event.title} photo ${i + 1}`}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === activeImageIndex ? 'opacity-100' : 'opacity-0'
                  }`}
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
          <button
            onClick={() => navigate(-1)}
            className="rounded-sm border border-white/40 bg-white/90 p-2 text-slate-700 hover:bg-white transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            onClick={() => navigator.clipboard?.writeText(window.location.href)}
            className="rounded-sm border border-white/40 bg-white/90 p-2 text-slate-700 hover:bg-white transition-colors"
          >
            <Share2 size={18} />
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <span className="mb-2 inline-block w-fit rounded-sm bg-white/90 px-2 py-0.5 text-xs font-medium text-slate-700">
            {label}
          </span>
          <h1 className="text-2xl font-bold text-white">{event.title}</h1>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="p-2 pb-24">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
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
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-400">{event.description}</p>
            </CardContent>
          </Card>

          {/* Past events gallery slider */}
          {event.pastEventsGallery && event.pastEventsGallery.length > 0 && (
            <Card className="shadow-sm border-gray-200 dark:border-slate-800 dark:bg-[#1E293B]">
              <CardContent className="pt-4">
                <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-slate-100">Past Events</h2>
                <div className="relative h-48 w-full overflow-hidden rounded-sm bg-slate-100 dark:bg-slate-800">
                  {event.pastEventsGallery.map((item, i) => (
                    <div
                      key={item.url + i}
                      className={`absolute inset-0 transition-opacity duration-500 ${i === pastEventIndex ? 'opacity-100' : 'opacity-0'}`}
                    >
                      {item.type === 'video' ? (
                        <video src={item.url} className="h-full w-full object-cover" muted loop playsInline autoPlay />
                      ) : (
                        <img src={item.url} alt={`Past event ${i + 1}`} className="h-full w-full object-cover" />
                      )}
                    </div>
                  ))}
                  {event.pastEventsGallery.length > 1 && (
                    <>
                      <button
                        onClick={() =>
                          setPastEventIndex((i) => (i - 1 + event.pastEventsGallery.length) % event.pastEventsGallery.length)
                        }
                        className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-sm bg-black/40 p-1.5 text-white hover:bg-black/60 transition-colors"
                        aria-label="Previous"
                      >
                        <ArrowLeft size={16} />
                      </button>
                      <button
                        onClick={() => setPastEventIndex((i) => (i + 1) % event.pastEventsGallery.length)}
                        className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-sm bg-black/40 p-1.5 text-white hover:bg-black/60 transition-colors rotate-180"
                        aria-label="Next"
                      >
                        <ArrowLeft size={16} />
                      </button>
                      <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
                        {event.pastEventsGallery.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setPastEventIndex(i)}
                            className={`h-1.5 rounded-sm transition-all ${i === pastEventIndex ? 'w-4 bg-[#007A78] dark:bg-[#2DD4BF]' : 'w-1.5 bg-slate-300 dark:bg-slate-600'}`}
                            aria-label={`Slide ${i + 1}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
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
                      href={event.rsvpLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-sm bg-[#007A78] px-4 py-2 text-sm font-semibold text-white hover:bg-[#006361]"
                    >
                      {event.rsvpButtonLabel || 'RSVP Now'}
                    </a>
                  ) : (
                    <p className="text-xs text-red-500 dark:text-red-400">RSVP link isn&rsquo;t set up yet — check back soon.</p>
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
                                  disabled={qty >= Math.min(remaining, 10)}
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
              disabled={totalTickets === 0}
              className="flex-1 rounded-sm bg-[#007A78] py-2.5 text-sm font-semibold text-white hover:bg-[#2DD4BF] disabled:opacity-40 disabled:hover:bg-[#2DD4BF] transition-colors"
            >
              Get tickets
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerEventDetail;