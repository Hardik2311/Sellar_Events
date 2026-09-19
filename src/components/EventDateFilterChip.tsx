import React, { useState, useRef, useEffect } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { useEventFilter, type EventFilterState } from './ui/EventdateFilter';

const PRESET_LABELS: Record<EventFilterState['filterType'], string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7days: 'Last 7 Days',
  last30days: 'Last 30 Days',
  custom: 'Custom Range',
  alltime: 'All Time',
};

const getLocalDateString = (date: Date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().split('T')[0];
};

const buildPresetRange = (preset: EventFilterState['filterType']): EventFilterState => {
  const today = new Date();
  switch (preset) {
    case 'yesterday': {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return { startDate: getLocalDateString(y), endDate: getLocalDateString(y), filterType: 'yesterday' };
    }
    case 'last7days': {
      const l7 = new Date();
      l7.setDate(l7.getDate() - 6);
      return { startDate: getLocalDateString(l7), endDate: getLocalDateString(today), filterType: 'last7days' };
    }
    case 'last30days': {
      const l30 = new Date();
      l30.setDate(l30.getDate() - 29);
      return { startDate: getLocalDateString(l30), endDate: getLocalDateString(today), filterType: 'last30days' };
    }
    case 'alltime':
      return { startDate: '', endDate: '', filterType: 'alltime' };
    default:
      return { startDate: getLocalDateString(today), endDate: getLocalDateString(today), filterType: 'today' };
  }
};

const PRESETS: EventFilterState['filterType'][] = ['today', 'yesterday', 'last7days', 'last30days', 'alltime'];

export const EventDateFilterChip: React.FC = () => {
  const { filters, setFilters } = useEventFilter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePick = (preset: EventFilterState['filterType']) => {
    setFilters(buildPresetRange(preset));
    setOpen(false);
  };

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex shrink-0 items-center justify-center gap-0 sm:gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 sm:px-3 sm:py-2 text-xs font-bold text-slate-600 dark:text-slate-300 shadow-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        aria-label="Filter by date"
      >
        <Filter size={16} className="text-[#007A78] dark:text-[#2DD4BF]" />
        <span className="hidden sm:inline">{PRESET_LABELS[filters.filterType] ?? 'Last 30 Days'}</span>
        <ChevronDown size={13} className={`hidden sm:inline text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-40 sm:w-44 max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
          {PRESETS.map((key) => (
            <button
              key={key}
              onClick={() => handlePick(key)}
              className={`w-full px-3 py-2 text-left text-xs font-bold transition-colors curusor-pointer ${filters.filterType === key
                  ? 'bg-[#007A78]/10 text-[#007A78] dark:bg-[#2DD4BF]/15 dark:text-[#2DD4BF]'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
            >
              {PRESET_LABELS[key]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventDateFilterChip;