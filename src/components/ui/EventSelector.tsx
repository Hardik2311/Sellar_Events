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
        className="w-full flex items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors"
      >
        <span className="truncate">{selected ? selected.title : 'Select an event'}</span>
        <ChevronDown size={16} className={`flex-shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-20 max-h-64 overflow-y-auto">
          {events.map((event) => (
            <button
              key={event.id}
              onClick={() => {
                onChange(event.id);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-orange-50 hover:text-[#F97316] transition-colors ${
                event.id === selectedEventId ? 'text-[#F97316] font-medium bg-orange-50' : 'text-gray-700'
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