import React, { useState, useRef, useEffect } from 'react';

interface TimeSelectProps {
  value: string; // '00' to '23' or '00' to '59'
  options: string[];
  onChange: (value: string) => void;
}

const TimeSelect: React.FC<TimeSelectProps> = ({ value, options, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && listRef.current) {
      const selectedEl = listRef.current.querySelector('[data-selected="true"]') as HTMLElement;
      selectedEl?.scrollIntoView({ block: 'center' });
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="text-sm font-medium text-slate-800 dark:text-slate-100 bg-transparent outline-none px-1 py-0.5 rounded-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        {value || '00'}
      </button>

      {isOpen && (
        <ul
          ref={listRef}
          className="absolute left-0 top-full mt-1 max-h-40 w-16 overflow-y-auto rounded-sm border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg z-50"
        >
          {options.map((opt) => (
            <li
              key={opt}
              data-selected={opt === value}
              onClick={() => {
                onChange(opt);
                setIsOpen(false);
              }}
              className={`px-3 py-1.5 text-sm cursor-pointer text-center ${
                opt === value
                  ? 'bg-[#007A78]/10 text-[#007A78] dark:bg-[#2DD4BF]/10 dark:text-[#2DD4BF] font-semibold'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TimeSelect;