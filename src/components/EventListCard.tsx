import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
  events,
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
    if (!searchValue.trim()) return events;
    const q = searchValue.toLowerCase();
    return events.filter((e) => e.title.toLowerCase().includes(q) || e.category.toLowerCase().includes(q));
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
        className="w-full flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
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
        <div className="absolute top-full left-0 mt-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-30 p-3">
          <div className="mb-2">
            <SearchBar value={searchValue} onChange={onSearchChange} placeholder="Search your events" />
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {loading ? (
              [1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-md bg-gray-100" />)
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">No events match your search</p>
              </div>
            ) : (
              filteredEvents.map((event) => {
                const isActive = event.id === selectedEventId;
                return (
                  <button
                    key={event.id}
                    onClick={() => handleSelect(event.id)}
                    className={`w-full text-left rounded-xl border p-3 transition-all ${
                      isActive
                        ? 'border-[#007A78]/40 bg-[#007A78]/10 dark:border-[#2DD4BF]/40 dark:bg-[#2DD4BF]/15 font-bold'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(event.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ·{' '}
                          {event.ticketsSold}/{event.ticketsTotal} sold
                        </p>
                      </div>
                      <StatusBadge status={event.status} />
                    </div>
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