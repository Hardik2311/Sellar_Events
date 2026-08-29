import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, CalendarDays } from 'lucide-react';
import type { EventSummary } from '../types/event.types';
import SearchBar from './ui/SearchBar';
import StatusBadge from './ui/StatusBadge';

interface EventListCardProps {
  events: EventSummary[];
  selectedEventId: string | null;
  onSelect: (id: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  loading?: boolean;
}

export const EventListCard: React.FC<EventListCardProps> = ({
  events = [],
  selectedEventId,
  onSelect,
  searchValue,
  onSearchChange,
  loading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId]
  );

  const filteredEvents = useMemo(() => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Show all events (past + upcoming). Sort so upcoming events come first
  // (soonest first), then past events (most recent first) below them.
  const sorted = [...events].sort((a, b) => {
    const aDate = new Date(a.startDate).setHours(0, 0, 0, 0);
    const bDate = new Date(b.startDate).setHours(0, 0, 0, 0);
    const aUpcoming = aDate >= startOfToday.getTime();
    const bUpcoming = bDate >= startOfToday.getTime();

    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    return aUpcoming ? aDate - bDate : bDate - aDate;
  });

  if (!searchValue.trim()) return sorted;
  const q = searchValue.toLowerCase();
  return sorted.filter(
    (e) => e.title.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
  );
}, [events, searchValue]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    onSelect(id);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full max-w-lg lg:max-w-4xl mx-auto" ref={containerRef}>
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between rounded-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="min-w-0 text-left">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Your events</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {loading ? 'Loading...' : selectedEvent ? selectedEvent.title : 'Select an event'}
          </p>
        </div>
        <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm shadow-xl z-30 p-3">
          <div className="mb-2">
            <SearchBar value={searchValue} onChange={onSearchChange} placeholder="Search your events" />
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {loading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                  <div className="w-14 h-14 rounded-sm bg-gray-100 dark:bg-slate-800 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-2/3 rounded bg-gray-100 dark:bg-slate-800" />
                    <div className="h-3 w-1/3 rounded bg-gray-100 dark:bg-slate-800" />
                  </div>
                </div>
              ))
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 dark:text-slate-400">No events match your search</p>
              </div>
            ) : (
              filteredEvents.map((event) => {
                const isActive = event.id === selectedEventId;
                return (
                  <button
                    key={event.id}
                    onClick={() => handleSelect(event.id)}
                    className={`w-full text-left rounded-sm border p-2 transition-all flex items-center gap-3 ${isActive
                      ? 'border-[#007A78]/40 bg-[#007A78]/10 dark:border-[#2DD4BF]/40 dark:bg-[#2DD4BF]/15'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                  >
                    {event.coverImage ? (
                      <img
                        src={event.coverImage}
                        alt=""
                        className="w-14 h-14 rounded-sm object-cover shrink-0 border border-slate-100 dark:border-slate-800"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-sm shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <CalendarDays size={20} className="text-slate-400" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className={`text-sm truncate ${isActive ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-900 dark:text-white'}`}>
                        {event.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">
                        {new Date(event.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {event.venue} ·{' '}
                        {event.ticketsSold}/{event.ticketsTotal} sold
                      </p>
                    </div>

                    <StatusBadge status={event.status} />
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EventListCard;