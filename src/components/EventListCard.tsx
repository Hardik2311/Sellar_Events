import React, { useMemo } from 'react';
import type { EventSummary } from '../types/event.types';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
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
  const filteredEvents = useMemo(() => {
    if (!searchValue.trim()) return events;
    const q = searchValue.toLowerCase();
    return events.filter((e) => e.title.toLowerCase().includes(q) || e.category.toLowerCase().includes(q));
  }, [events, searchValue]);

  return (
    <Card className="shadow-sm border-gray-200 h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-900">Your events</CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0">
        <div className="mb-3">
          <SearchBar value={searchValue} onChange={onSearchChange} placeholder="Search your events" />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 max-h-[340px]">
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
                  onClick={() => onSelect(event.id)}
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
      </CardContent>
    </Card>
  );
};

export default EventListCard;