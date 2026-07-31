import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, MapPin, Wifi, Share2, Minus, Plus, Ticket, User, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import ThemeToggle from '../components/ui/ThemeToggle';
import {
  CATEGORY_GRADIENTS,
  getCategoryLabel,
  formatDateRange,
  formatTime,
} from '../data/mockEvents';
import { usePublicEvent } from '../hooks/usePublicEvents';

const CustomerEventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { event, loading } = usePublicEvent(id);

  // Quantity selected per tier id
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-100 dark:bg-[#0F172A]">
        <Loader2 className="animate-spin text-slate-400" size={24} />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-slate-100 dark:bg-[#0F172A] p-6 text-center">
        <Ticket size={28} className="text-gray-300 dark:text-slate-600" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">This event doesn&rsquo;t exist or isn&rsquo;t published yet.</p>
        <button
          onClick={() => navigate('/discover')}
          className="rounded-md bg-[#007A78] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2DD4BF]"
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

  const setQty = (tierId: string, next: number) => {
    const max = remainingFor(tierId);
    const clamped = Math.max(0, Math.min(next, max, 10)); // 10-per-order cap, same as most ticketing flows
    setQuantities((q) => ({ ...q, [tierId]: clamped }));
  };

  const totalTickets = Object.values(quantities).reduce((s, n) => s + n, 0);
  const totalPrice = event.tiers.reduce((sum, t) => sum + (quantities[t.id] ?? 0) * t.price, 0);
  const allSoldOut = event.tiers.every((t) => t.sold >= t.quantity);

  // TODO — backend wiring:
  // Ideally create a checkout/session on the server here and navigate using
  // its session id instead of raw router state (router state is lost on
  // refresh).
  const handleGetTickets = () => {
    navigate(`/checkout/${event.id}`, { state: { quantities } });
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200">
      {/* ── Header / hero ───────────────────────────────────────────── */}
      <div className={`relative h-64 w-full shrink-0 bg-gradient-to-br ${gradient}`}>
        {event.coverImage && (
          <img src={event.coverImage} alt={event.title} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-sm border border-white/40 bg-white/90 p-2 hover:bg-white transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => navigator.clipboard?.writeText(window.location.href)}
              className="rounded-sm border border-white/40 bg-white/90 p-2 hover:bg-white transition-colors"
            >
              <Share2 size={18} />
            </button>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <span className="mb-2 inline-block w-fit rounded-sm bg-white/90 px-2 py-0.5 text-xs font-medium text-slate-700">
            {label}
          </span>
          <h1 className="text-2xl font-bold text-white">{event.title}</h1>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="grow overflow-y-auto p-2 pb-24">
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
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#007A78] px-4 py-2 text-sm font-semibold text-white hover:bg-[#006361]"
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
                    <p className="rounded-md bg-slate-50 dark:bg-slate-800 p-3 text-sm text-slate-500 dark:text-slate-400">
                      All tickets for this event are sold out.
                    </p>
                  ) : (
                    <div className="flex flex-col divide-y divide-gray-100 dark:divide-slate-800">
                      {event.tiers.map((tier) => {
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
                              <p className="text-xs text-slate-400 dark:text-slate-500">
                                {soldOut ? 'Sold out' : `${remaining} left`}
                              </p>
                            </div>

                            {soldOut ? (
                              <span className="rounded-md bg-gray-100 dark:bg-slate-700 px-3 py-1.5 text-xs font-medium text-gray-400 dark:text-slate-400">Sold out</span>
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
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {totalTickets > 0 ? `${totalTickets} ticket${totalTickets === 1 ? '' : 's'}` : 'Select tickets'}
              </p>
              <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                {totalPrice > 0 ? `\u20B9${totalPrice.toLocaleString('en-IN')}` : totalTickets > 0 ? 'Free' : '\u2014'}
              </p>
            </div>
            <button
              onClick={handleGetTickets}
              disabled={totalTickets === 0}
              className="flex-1 rounded-md bg-[#007A78] py-2.5 text-sm font-semibold text-white hover:bg-[#2DD4BF] disabled:opacity-40 disabled:hover:bg-[#2DD4BF] transition-colors"
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