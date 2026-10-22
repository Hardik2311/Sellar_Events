import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import TicketDivider from './TicketDivider';
import PoweredByOutsold from './PoweredByOutsold';
import BrandButton from './BrandButton';

interface OrderLineItem {
  id: string;
  label: string;
  amountLabel: string;
  /** Secondary lines such as tax and round off. */
  muted?: boolean;
  /** Breakdown folded under this row (e.g. tickets + tax under "Order amount"). */
  children?: Omit<OrderLineItem, 'children'>[];
}

interface TicketOrderSummaryProps {
  eventTitle: string;
  dateLabel: string;
  venueLabel: string;
  lineItems: OrderLineItem[];
  totalLabel: string;
  /** Label for the total row. Defaults to "Total". */
  totalTitle?: string;
  ctaLabel: string;
  onCta?: () => void;
  ctaDisabled?: boolean;
  className?: string;
}

// The ticket-stub order summary on the checkout / manual-QR payment screens:
// ink head, punched perforation, line items, total row. Its button only shows
// from lg; below that the MobileCheckoutBar carries the action.
// A row with a breakdown: collapsed to one line, tap to show the parts.
const GroupRow: React.FC<{ item: OrderLineItem }> = ({ item }) => {
  const [open, setOpen] = useState(false);
  return (
    <li className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center justify-between gap-4 text-left text-[15px] leading-[22px] tabular-nums text-[var(--brand-black)]"
      >
        <span className="flex min-w-0 items-center gap-1">
          {item.label}
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={`shrink-0 text-[var(--brand-muted)] transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          />
        </span>
        <span className="shrink-0">{item.amountLabel}</span>
      </button>
      {open && (
        <ul className="flex flex-col gap-0.5 pl-3">
          {item.children!.map((child) => (
            <li
              key={child.id}
              className="flex items-center justify-between gap-4 text-[13px] leading-[20px] tabular-nums text-[var(--brand-muted)]"
            >
              <span className="min-w-0">{child.label}</span>
              <span className="shrink-0">{child.amountLabel}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

const TicketOrderSummary: React.FC<TicketOrderSummaryProps> = ({
  eventTitle,
  dateLabel,
  venueLabel,
  lineItems,
  totalLabel,
  totalTitle = 'Total',
  ctaLabel,
  onCta,
  ctaDisabled,
  className = '',
}) => (
  <div className={className}>
    <div className="overflow-hidden rounded-xl border border-[var(--brand-line)] bg-[var(--brand-surface)]">
      <div className="bg-[var(--brand-black)] px-5 py-4 text-[var(--brand-cream)]">
        <p className="brand-label text-[#c9c4b8]">Your order</p>
        <h3 className="brand-display mt-1.5 line-clamp-2 text-[22px] leading-[1.1]">{eventTitle}</h3>
        <p className="mt-1 text-[13px] leading-[18px] text-[#c9c4b8]">
          {dateLabel} &middot; {venueLabel}
        </p>
      </div>

      <div className="relative h-6 bg-[var(--brand-surface)]">
        <TicketDivider notchColor="var(--brand-cream)" className="absolute inset-x-0 top-1/2" />
      </div>

      <ul className="flex flex-col gap-2 px-5 pb-4">
        {lineItems.map((item) => item.children?.length ? (
          <GroupRow key={item.id} item={item} />
        ) : (
          <li
            key={item.id}
            className={`flex items-center justify-between gap-4 text-[15px] leading-[22px] tabular-nums ${
              item.muted ? 'text-[var(--brand-muted)]' : 'text-[var(--brand-black)]'
            }`}
          >
            <span className="min-w-0">{item.label}</span>
            <span className="shrink-0">{item.amountLabel}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-baseline justify-between gap-4 bg-[var(--brand-discover-bg)] px-5 py-4">
        <span className="text-[15px] font-semibold text-[var(--brand-black)]">{totalTitle}</span>
        <span className="brand-display text-[28px] leading-none tabular-nums text-[var(--brand-black)]">{totalLabel}</span>
      </div>
    </div>

    {onCta && (
      <BrandButton variant="primary" block onClick={onCta} disabled={ctaDisabled} className="mt-4 hidden lg:flex">
        {ctaLabel}
      </BrandButton>
    )}

    <div className="mt-4 flex justify-center">
      <PoweredByOutsold size="sm" />
    </div>
  </div>
);

export default TicketOrderSummary;
