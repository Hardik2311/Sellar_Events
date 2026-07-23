import React, { createContext, useState, useContext, useEffect, useCallback, type ReactNode } from 'react';
import { ChevronDown, Calendar } from 'lucide-react';

// Same local-date helper as the catalogue app's Filter.tsx —
// avoids UTC offset bugs when comparing "today" against stored dates.
const getLocalDateString = (date: Date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - offset);
  return localDate.toISOString().split('T')[0];
};

export interface EventFilterState {
  startDate: string;
  endDate: string;
  filterType: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'custom';
}

interface EventFilterContextType {
  filters: EventFilterState;
  setFilters: React.Dispatch<React.SetStateAction<EventFilterState>>;
}

const EventFilterContext = createContext<EventFilterContextType | undefined>(undefined);

export const EventFilterProvider = ({ children }: { children: ReactNode }) => {
  const [filters, setFilters] = useState<EventFilterState>({
    startDate: getLocalDateString(),
    endDate: getLocalDateString(),
    filterType: 'today',
  });

  return <EventFilterContext.Provider value={{ filters, setFilters }}>{children}</EventFilterContext.Provider>;
};

export const useEventFilter = (): EventFilterContextType => {
  const ctx = useContext(EventFilterContext);
  if (!ctx) throw new Error('useEventFilter must be used within an EventFilterProvider');
  return ctx;
};

const PRESET_LABELS: Record<EventFilterState['filterType'], string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7days: 'Last 7 Days',
  last30days: 'Last 30 Days',
  custom: 'Custom Range',
};

// Plain date input styled to look like a picker, same visual pattern as
// FormattedDateInput in the catalogue's Filter.tsx.
const FormattedDateInput: React.FC<{ value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }> = ({
  value,
  onChange,
}) => {
  const displayValue = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'dd/mm/yyyy';

  return (
    <div className="relative w-full">
      <div className="w-full p-2 text-sm border border-slate-300 rounded-sm bg-white flex justify-between items-center pointer-events-none">
        <span className={value ? 'text-slate-800' : 'text-slate-400'}>{displayValue}</span>
        <Calendar size={16} className="text-slate-500" />
      </div>
      <input type="date" value={value} onChange={onChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
    </div>
  );
};

export const EventDateFilter: React.FC = () => {
  const { filters, setFilters } = useEventFilter();
  const [localFilters, setLocalFilters] = useState<EventFilterState>(filters);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => setLocalFilters(filters), [filters]);

  const formatDate = (date: Date) => getLocalDateString(date);

  const applyPreset = useCallback((preset: EventFilterState['filterType']) => {
    const today = new Date();
    let startDate = localFilters.startDate;
    let endDate = localFilters.endDate;

    switch (preset) {
      case 'today':
        startDate = formatDate(today);
        endDate = formatDate(today);
        break;
      case 'yesterday': {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        startDate = formatDate(y);
        endDate = formatDate(y);
        break;
      }
      case 'last7days': {
        const l7 = new Date();
        l7.setDate(l7.getDate() - 6);
        startDate = formatDate(l7);
        endDate = formatDate(today);
        break;
      }
      case 'last30days': {
        const l30 = new Date();
        l30.setDate(l30.getDate() - 29);
        startDate = formatDate(l30);
        endDate = formatDate(today);
        break;
      }
      case 'custom':
        break;
    }

    setLocalFilters({ startDate, endDate, filterType: preset });
    setIsMenuOpen(false);
  }, [localFilters]);

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setLocalFilters((f) => ({ ...f, [field]: value, filterType: 'custom' }));
  };

  const handleApply = () => setFilters(localFilters);

  return (
    <div className="bg-white p-2 rounded-sm shadow-md w-full max-w-lg mx-auto">
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Preset dropdown */}
          <div className="relative sm:col-span-2">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="w-full flex items-center justify-center gap-2 rounded-sm border border-slate-300 p-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {PRESET_LABELS[localFilters.filterType]}
              <ChevronDown size={16} className={`transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isMenuOpen && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-300 rounded-md shadow-lg z-10">
                {(Object.keys(PRESET_LABELS) as EventFilterState['filterType'][]).map((key) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 hover:bg-orange-50 hover:text-[#F97316]"
                  >
                    {PRESET_LABELS[key]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="sm:col-span-2 grid grid-cols-2 gap-2">
            <FormattedDateInput value={localFilters.startDate} onChange={(e) => handleDateChange('startDate', e.target.value)} />
            <FormattedDateInput value={localFilters.endDate} onChange={(e) => handleDateChange('endDate', e.target.value)} />
          </div>
        </div>

        <button
          onClick={handleApply}
          className="w-full px-3 py-1 text-white font-semibold rounded-sm shadow-sm transition-colors bg-[#F97316] hover:bg-[#ea580c]"
        >
          Apply
        </button>
      </div>
    </div>
  );
};

export default EventDateFilter;