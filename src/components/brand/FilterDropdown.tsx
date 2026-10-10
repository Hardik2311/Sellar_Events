import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
  /** Optional icon on the right of the option, e.g. a calendar for "Pick a date". */
  icon?: React.ElementType;
}

interface FilterDropdownProps {
  icon: React.ElementType;
  /** Accessible name, e.g. "Category". */
  label: string;
  value: string;
  /** Overrides the trigger text (e.g. the picked date instead of "Pick a date"). */
  displayLabel?: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  /** Not on its default value: teal border and tint. */
  active: boolean;
  /** Extra content at the bottom of the open menu (e.g. a date input). The menu
   *  closes once an input inside it changes to a non-empty value. */
  footer?: React.ReactNode;
  /** Keep the menu open after choosing these values (e.g. "date", so the date input can be used). */
  keepOpenFor?: string[];
  /** Phone only: shown instead of the default option's label (e.g. "Category") so three fit in a row. */
  shortLabel?: string;
  /** Phone only: open the menu towards the left (for the last filter in the row). */
  menuAlign?: 'left' | 'right';
  className?: string;
}

// Discover filter: a 48px trigger with a teal icon and chevron that opens a
// listbox menu, the selected option ticked. A filter off its default gets a
// teal border and tint so buyers see at a glance what is narrowing the list.
const FilterDropdown: React.FC<FilterDropdownProps> = ({
  icon: Icon,
  label,
  value,
  displayLabel,
  options,
  onChange,
  active,
  footer,
  keepOpenFor = [],
  shortLabel,
  menuAlign = 'left',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIndex];

  // Close on a click outside or when focus leaves the dropdown.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const openMenu = () => {
    setHighlight(selectedIndex);
    setOpen(true);
    requestAnimationFrame(() => listRef.current?.focus());
  };

  const close = (focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    if (!keepOpenFor.includes(option.value)) close();
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openMenu();
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlight((h) => Math.min(options.length - 1, h + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
        break;
      case 'Home':
        e.preventDefault();
        setHighlight(0);
        break;
      case 'End':
        e.preventDefault();
        setHighlight(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        choose(highlight);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div
      ref={rootRef}
      className={`relative min-w-0 ${className}`}
      onBlur={(e) => {
        if (open && !rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${displayLabel ?? selected?.label ?? ''}`}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className={`flex h-11 w-full items-center gap-1.5 rounded-lg border px-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)] sm:h-12 sm:gap-2.5 sm:px-3.5 ${
          open
            ? 'border-[var(--brand-teal)] bg-[var(--brand-surface)] ring-1 ring-[var(--brand-teal)]'
            : active
              ? 'border-[var(--brand-teal)] bg-[#ebf3ea]'
              : 'border-[var(--brand-line-strong)] bg-[var(--brand-surface)] hover:border-[var(--brand-black)]'
        }`}
      >
        <Icon size={16} strokeWidth={1.75} className="shrink-0 text-[var(--brand-teal)] sm:h-[18px] sm:w-[18px]" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--brand-black)] sm:text-[15px]">
          <span className="sm:hidden">{!active && shortLabel ? shortLabel : displayLabel ?? selected?.label}</span>
          <span className="hidden sm:inline">{displayLabel ?? selected?.label}</span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[var(--brand-muted)] transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className={`absolute top-[calc(100%+6px)] z-30 w-max min-w-[220px] max-w-[calc(100vw-2rem)] rounded-xl sm:left-0 sm:right-0 sm:w-auto ${
            menuAlign === 'right' ? 'right-0' : 'left-0'
          }`}
        >
        <div className="rounded-xl border border-[var(--brand-line)] bg-[var(--brand-surface)] p-1.5 shadow-[0_12px_32px_rgb(20_18_15/0.14)]">
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label={label}
            aria-activedescendant={`${listId}-${highlight}`}
            onKeyDown={onListKeyDown}
            className="max-h-80 overflow-y-auto outline-none"
          >
            {options.map((option, i) => {
              const isSelected = option.value === selected?.value;
              const OptionIcon = option.icon;
              return (
                <li
                  key={option.value}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => choose(i)}
                  className={`flex h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-[15px] text-[var(--brand-black)] ${
                    isSelected ? 'bg-[#ebf3ea] font-semibold' : i === highlight ? 'bg-[var(--brand-cream)] font-medium' : 'font-medium'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected ? (
                    <Check size={18} className="shrink-0 text-[var(--brand-teal)]" aria-hidden="true" />
                  ) : (
                    OptionIcon && <OptionIcon size={18} strokeWidth={1.75} className="shrink-0 text-[var(--brand-teal)]" aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ul>
          {footer && (
            <div
              className="mt-1.5 border-t border-[var(--brand-line)] px-1.5 pt-2 pb-1"
              onChange={(e) => {
                if ((e.target as HTMLInputElement).value) close();
              }}
            >
              {footer}
            </div>
          )}
        </div>
        </div>
      )}
    </div>
  );
};

export default FilterDropdown;
