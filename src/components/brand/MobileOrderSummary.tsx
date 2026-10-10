import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface MobileOrderSummaryProps {
  /** e.g. "2 × General Admission" or "3 tickets". */
  itemsLabel: string;
  totalLabel: string;
  /** The full TicketOrderSummary, shown when expanded. */
  children: React.ReactNode;
  className?: string;
}

// Phone-only order row at the top of Checkout / manual QR: what's in the
// order and the total, expanding into the full ticket-stub summary.
const MobileOrderSummary: React.FC<MobileOrderSummaryProps> = ({ itemsLabel, totalLabel, children, className = '' }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`lg:hidden ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--brand-line)] bg-[var(--brand-surface)] px-4 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]"
      >
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold leading-[22px] text-[var(--brand-black)]">{itemsLabel}</span>
          <span className="block text-[13px] leading-[18px] text-[var(--brand-muted)]">
            {open ? 'Hide order details' : 'View order details'}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="brand-display text-[22px] leading-none tabular-nums text-[var(--brand-black)]">{totalLabel}</span>
          <ChevronDown size={18} className={`transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
};

export default MobileOrderSummary;
