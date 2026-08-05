import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar, Wifi, Clock, Ticket, X, Star, Radio, ChevronDown, Loader2, Trash2, LinkIcon, Pencil, Share2 } from 'lucide-react';
import { Card } from '../components/ui/card';
//import ThemeToggle from '../components/ui/ThemeToggle';
import EventSubdomainModal from '../components/SubDomainModal';
import EditEventModal from '../components/EditEventModal';
import type { EventFormState } from '../types/event.types';
import { useAuth } from '../context/AuthContext';
import {
  type PublicEvent,
  CATEGORY_GRADIENTS,
  getCategoryLabel,
  formatDateRange,
  formatTime,
  getPriceLabel,
  getAvailability,
} from '../data/events';
import { useOrganizerEvents } from '../hooks/useOrganizerEvents';

type FormatFilter = 'all' | 'in-person' | 'online';

// ─────────────────────────────────────────────────────────────────────────
// Returns true if the event's last day has already passed (end of day)
// ─────────────────────────────────────────────────────────────────────────
const isPastEvent = (event: PublicEvent): boolean => {
  const lastDateStr = event.endDate || event.date;
  const eventEnd = new Date(lastDateStr);
  eventEnd.setHours(23, 59, 59, 999); // event ke din ke end tak valid maano
  return eventEnd.getTime() < Date.now();
};
// ─────────────────────────────────────────────────────────────────────────
// Small pill toggle switch — reused for the Live/Draft and Featured controls
// ─────────────────────────────────────────────────────────────────────────
const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void; disabled?: boolean }> = ({
  checked,
  onChange,
  disabled,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={(e) => {
      e.stopPropagation();
      onChange();
    }}
    className={`relative h-5 w-9 shrink-0 overflow-hidden rounded-full transition-colors disabled:opacity-40 ${checked ? 'bg-[#007A78]' : 'bg-gray-300'
      }`}
  >
    <span
      className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'
        }`}
    />
  </button>
);

// ─────────────────────────────────────────────────────────────────────────
// Organizer event card — same visuals as customer card + status controls
// ─────────────────────────────────────────────────────────────────────────
const OrganizerEventCard: React.FC<{
  event: PublicEvent;
  onOpen: () => void;
  onToggleLive: (id: string) => void;
  onToggleFeatured: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (event: PublicEvent) => void;
}> = ({ event, onOpen, onToggleLive, onToggleFeatured, onDelete, onEdit }) => {
  const label = getCategoryLabel(event);
  const { pct, soldOut, sellingFast } = getAvailability(event.tiers);
  const gradient = CATEGORY_GRADIENTS[event.category] ?? CATEGORY_GRADIENTS.Other;

  // NOTE: assumes PublicEvent has `status: 'draft' | 'published' | 'completed'`
  // and `featured: boolean`. Rename to match your real type if different.
  const isLive = event.status === 'published';
  const isCompleted = event.status === 'completed';

  return (
    <Card className="shadow-sm border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <div className="relative h-36 w-full cursor-pointer" onClick={onOpen}>
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
        {event.coverImage && (
          <img src={event.coverImage} alt={event.title} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <span className="absolute bottom-2 left-2 rounded-sm bg-white/90 px-2 py-0.5 text-xs font-medium text-slate-700">
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
            const shareUrl = `${window.location.origin}/events/e/${event.id}`;
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
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(event);
          }}
          title="Edit event"
          className="absolute bottom-2 right-2 rounded-full bg-white/90 p-1.5 text-slate-500 hover:bg-teal-50 hover:text-[#007A78] transition-colors"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete "${event.title}"? This can't be undone.`)) {
              onDelete(event.id);
            }
          }}
          title="Delete event"
          className="absolute top-2 left-2 rounded-full bg-white/90 p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <Trash2 size={14} />
        </button>
        {soldOut && (
          <span className="absolute bottom-10 right-2 rounded-sm bg-slate-900/80 px-2 py-0.5 text-xs font-medium text-white">
            Sold out
          </span>
        )}
        {!soldOut && sellingFast && (
          <span className="absolute bottom-10 right-2 rounded-sm bg-[#007A78] px-2 py-0.5 text-xs font-medium text-white">
            Selling fast
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-slate-800 cursor-pointer" onClick={onOpen}>
          {event.title}
        </h3>

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
          <div className="h-1.5 rounded-full bg-[#007A78]" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>

        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm font-semibold text-[#007A78]">
            {event.registrationMode === 'rsvp' ? 'RSVP' : getPriceLabel(event.tiers)}
          </span>
          {event.registrationMode === 'rsvp' ? (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Wifi size={13} /> External form
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Ticket size={13} /> {event.tiers.reduce((s, t) => s + t.sold, 0)} sold
            </span>
          )}
        </div>

        {/* ── Organizer controls ─────────────────────────────────── */}
        <div className="mt-1 flex items-center justify-between border-t border-gray-100 pt-2">
          <div className="flex items-center gap-1.5">
            <Radio size={13} className={isLive ? 'text-[#007A78]' : 'text-gray-300'} />
            <span className="text-xs font-medium text-slate-600">{isLive ? 'Live' : 'Draft'}</span>
          </div>
          <ToggleSwitch checked={isLive} disabled={isCompleted} onChange={() => onToggleLive(event.id)} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Star size={13} className={event.featured ? 'fill-[#007A78] text-[#007A78]' : 'text-gray-300'} />
            <span className="text-xs font-medium text-slate-600">Featured</span>
          </div>
          <ToggleSwitch checked={!!event.featured} onChange={() => onToggleFeatured(event.id)} />
        </div>
      </div>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────
const OrganizerEventDiscover: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { events, loading, toggleLive, toggleFeatured, deleteEvent, updateEvent } = useOrganizerEvents();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [format, setFormat] = useState<FormatFilter>('all');
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const [isSubdomainModalOpen, setIsSubdomainModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PublicEvent | null>(null);
  const [showPastEvents, setShowPastEvents] = useState(false);

  const categories = useMemo(() => ['All', ...Array.from(new Set(events.map(getCategoryLabel)))], [events]);

  const formatOptions: { value: FormatFilter; label: string }[] = [
    { value: 'all', label: 'All formats' },
    { value: 'in-person', label: 'In-person' },
    { value: 'online', label: 'Online' },
  ];
  const activeFormatLabel = formatOptions.find((f) => f.value === format)?.label ?? 'All formats';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events
      .filter((e) => {
        const label = getCategoryLabel(e);
        const matchesCategory = activeCategory === 'All' || label === activeCategory;
        const matchesFormat = format === 'all' || (format === 'online' ? e.isOnline : !e.isOnline);
        const matchesSearch =
          !q || e.title.toLowerCase().includes(q) || e.venue.toLowerCase().includes(q) || label.toLowerCase().includes(q);
        const matchesUpcoming = showPastEvents ? true : !isPastEvent(e); // toggle se past events dikhte hain
        return matchesCategory && matchesFormat && matchesSearch && matchesUpcoming;
      })
      .sort((a, b) =>
        showPastEvents ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
      ); // past view mein recent-most-past pehle dikhega
  }, [events, activeCategory, format, search, showPastEvents]);

  const clearFilters = () => {
    setSearch('');
    setActiveCategory('All');
    setFormat('all');
  };

  const openEvent = (event: PublicEvent) => navigate(`/events/e/${event.id}`);

  const handleSaveEdit = async (updated: EventFormState) => {
    if (!editingEvent) return;
    await updateEvent(editingEvent.id, updated);
    setEditingEvent(null);
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-16">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex shrink-0 flex-col gap-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-3.5 shadow-xs">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              Sellar <span className="text-[#007A78] dark:text-[#2DD4BF]">Events</span>
            </h1>
            <div className="flex items-center gap-3">
              <span className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <MapPin size={14} className="text-[#007A78] dark:text-[#2DD4BF]" /> Lucknow, IN
              </span>
              <button
                type="button"
                onClick={() => setIsSubdomainModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-[#007A78] dark:text-[#2DD4BF] hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <LinkIcon size={14} /> <span className="hidden sm:inline">Store Link</span>
              </button>
              {/* <ThemeToggle /> */}
            </div>
          </div>

          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your events"
              className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-700 outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]"
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
                className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-gray-50"
              >
                {activeCategory}
                <ChevronDown size={14} className={`transition-transform ${categoryMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {categoryMenuOpen && (
                <>
                  {/* backdrop to close on outside click */}
                  <div className="fixed inset-0 z-10" onClick={() => setCategoryMenuOpen(false)} />
                  <div className="absolute left-0 top-full z-20 mt-1 w-40 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                    {categories.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          setActiveCategory(c);
                          setCategoryMenuOpen(false);
                        }}
                        className={`block w-full px-3 py-1.5 text-left text-xs font-medium transition-colors ${activeCategory === c ? 'bg-orange-50 text-[#007A78]' : 'text-slate-600 hover:bg-gray-50'
                          }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Past events toggle */}
            <button
              type="button"
              onClick={() => setShowPastEvents((v) => !v)}
              className={`flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors shrink-0 ${
                showPastEvents
                  ? 'border-[#007A78] bg-teal-50 text-[#007A78]'
                  : 'border-gray-300 bg-white text-slate-600 hover:bg-gray-50'
              }`}
            >
              {showPastEvents ? 'Past events' : 'Upcoming'}
            </button>

            {/* Format filter — dropdown, right side */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setFormatMenuOpen((o) => !o)}
                className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-gray-50"
              >
                {activeFormatLabel}
                <ChevronDown size={14} className={`transition-transform ${formatMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {formatMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setFormatMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                    {formatOptions.map((f) => (
                      <button
                        key={f.value}
                        onClick={() => {
                          setFormat(f.value);
                          setFormatMenuOpen(false);
                        }}
                        className={`block w-full px-3 py-1.5 text-left text-xs font-medium transition-colors ${format === f.value ? 'bg-orange-50 text-[#007A78]' : 'text-slate-600 hover:bg-gray-50'
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
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">
                {filtered.length} event{filtered.length === 1 ? '' : 's'}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((event) => (
                  <OrganizerEventCard
                    key={event.id}
                    event={event}
                    onOpen={() => openEvent(event)}
                    onToggleLive={(evId) => toggleLive(evId, event.status)}
                    onToggleFeatured={(evId) => toggleFeatured(evId, !!event.featured)}
                    onDelete={deleteEvent}
                    onEdit={setEditingEvent}
                  />
                ))}
              </div>
            </div>
          )}
         </div>
      </main>

      {profile?.companyId && (
        <EventSubdomainModal
          companyId={profile.companyId}
          forceOpen={isSubdomainModalOpen}
          onClose={() => setIsSubdomainModalOpen(false)}
        />
      )}

      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
};

export default OrganizerEventDiscover;