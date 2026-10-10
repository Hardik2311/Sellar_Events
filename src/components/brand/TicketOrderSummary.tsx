import React from 'react';
import TicketDivider from './TicketDivider';
import PoweredByOutsold from './PoweredByOutsold';
import BrandButton from './BrandButton';

interface OrderLineItem {
  id: string;
  label: string;
  amountLabel: string;
  /** Secondary lines such as tax and round off. */
  muted?: boolean;
}

interface TicketOrderSummaryProps {
  eventTitle: string;
  dateLabel: string;
  venueLabel: string;
  lineItems: OrderLineItem[];
  totalLabel: string;
  ctaLabel: string;
  onCta?: () => void;
  ctaDisabled?: boolean;
  className?: string;
}

// The ticket-stub order summary on the checkout / manual-QR payment screens:
// ink head, punched perforation, line items, total row. Its button only shows
// from lg; below that the MobileCheckoutBar carries the action.
const TicketOrderSummary: React.FC<TicketOrderSummaryProps> = ({
  eventTitle,
  dateLabel,
  venueLabel,
  lineItems,
  totalLabel,
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
        {lineItems.map((item) => (
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
        <span className="text-[15px] font-semibold text-[var(--brand-black)]">Total</span>
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
