import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { EventSummary } from '../../types/event.types';

interface EventSelectorProps {
  events: EventSummary[];
  selectedEventId: string;
  onChange: (eventId: string) => void;
}

export const EventSelector: React.FC<EventSelectorProps> = ({ events, selectedEventId, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selected = events.find((e) => e.id === selectedEventId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#F9FAFB] dark:bg-[#1E293B] px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs"
      >
        <span className="truncate flex items-center gap-2">
          {selected ? selected.title : 'Select an event'}
        </span>
        <ChevronDown size={18} className={`shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-30 max-h-64 overflow-y-auto">
          {events.map((event) => (
            <button
              key={event.id}
              onClick={() => {
                onChange(event.id);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors ${
                event.id === selectedEventId
                  ? 'text-[#007A78] dark:text-[#2DD4BF] bg-[#007A78]/10 dark:bg-[#2DD4BF]/15 font-extrabold'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-[#007A78]/10 dark:hover:bg-[#2DD4BF]/15 hover:text-[#007A78] dark:hover:text-[#2DD4BF]'
              }`}
            >
              {event.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventSelector;