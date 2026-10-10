import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

interface HeaderSearchProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired on Enter — e.g. scroll the results into view. */
  onSubmit?: () => void;
  placeholder?: string;
}

// Search for the top-right corner of BrandNavHeader. Desktop: an always-visible
// pill input. Mobile: a search icon that expands into an input covering the
// whole header bar (the bar must be `relative`), with an X to collapse it.
const HeaderSearch: React.FC<HeaderSearchProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search events, venues',
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mobileOpen) mobileInputRef.current?.focus();
  }, [mobileOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
      onSubmit?.();
    }
  };

  const inputClass =
    'h-10 w-full rounded-full border border-[var(--brand-line-strong)] bg-[var(--brand-cream)] pl-10 pr-9 text-sm font-medium text-[var(--brand-black)] outline-none placeholder:text-[var(--brand-muted)] focus:border-[var(--brand-teal)] focus:ring-1 focus:ring-[var(--brand-teal)]';

  return (
    <>
      {/* Desktop */}
      <div className="absolute right-0 top-1/2 hidden w-64 -translate-y-1/2 lg:block xl:w-80">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--brand-muted)]" />
        <input
          type="text"
          enterKeyHint="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Search events"
          className={inputClass}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-[var(--brand-muted)] hover:text-[var(--brand-black)]"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Mobile */}
      {mobileOpen ? (
        <div className="absolute inset-0 z-10 flex items-center gap-2 bg-[var(--brand-surface)] lg:hidden">
          <div className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--brand-muted)]" />
            <input
              ref={mobileInputRef}
              type="text"
              enterKeyHint="search"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              aria-label="Search events"
              className={inputClass}
            />
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close search"
            className="flex h-10 w-10 items-center justify-center rounded-sm text-[var(--brand-black)] hover:bg-[var(--brand-skeleton)]"
          >
            <X size={20} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Search events"
          className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-sm border border-[var(--brand-line-strong)] bg-[var(--brand-surface)] text-[var(--brand-black)] hover:bg-[var(--brand-cream)] lg:hidden"
        >
          <Search size={20} />
          {value && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--brand-teal)]" />}
        </button>
      )}
    </>
  );
};

export default HeaderSearch;
