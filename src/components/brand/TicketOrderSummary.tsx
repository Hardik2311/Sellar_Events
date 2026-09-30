import React from 'react';
import TicketDivider from './TicketDivider';

interface OrderLineItem {
  id: string;
  label: string;
  amountLabel: string;
}

interface TicketOrderSummaryProps {
  eventTitle: string;
  dateLabel: string;
  venueLabel: string;
  imageUrl?: string;
  gradientClass?: string;
  lineItems: OrderLineItem[];
  bookingFeeLabel?: string;
  totalLabel: string;
  ctaLabel: string;
  onCta?: () => void;
  ctaDisabled?: boolean;
  className?: string;
}

// The yellow ticket-stub order card used on the checkout / manual-QR payment
// screens — cover image header, dashed perforation, line items, total, CTA.
const TicketOrderSummary: React.FC<TicketOrderSummaryProps> = ({
  eventTitle,
  dateLabel,
  venueLabel,
  imageUrl,
  gradientClass = 'from-slate-700 to-slate-900',
  lineItems,
  bookingFeeLabel,
  totalLabel,
  ctaLabel,
  onCta,
  ctaDisabled,
  className = '',
}) => (
  <div className={`overflow-hidden rounded-lg border border-black/10 shadow-md ${className}`}>
    <div className={`relative h-28 w-full bg-gradient-to-br ${gradientClass}`}>
      {imageUrl && <img src={imageUrl} alt={eventTitle} className="absolute inset-0 h-full w-full object-cover" />}
      <div className="absolute inset-0 bg-black/25" />
    </div>

    <div className="bg-[var(--brand-black)] p-4 text-white">
      <p className="brand-mono text-[10px] text-white/50">Your order</p>
      <h3 className="brand-display truncate text-xl leading-tight">{eventTitle}</h3>
      <p className="brand-mono mt-1 text-[10px] text-white/60">{dateLabel} &middot; {venueLabel}</p>
    </div>

    <div className="relative bg-[var(--brand-yellow)] px-4 pt-4">
      <TicketDivider notchColor="var(--brand-black)" className="absolute inset-x-0 -top-0.5" />
    </div>

    <div className="bg-[var(--brand-yellow)] p-4 pt-3">
      <div className="space-y-1.5">
        {lineItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between text-sm font-medium text-black/80">
            <span>{item.label}</span>
            <span>{item.amountLabel}</span>
          </div>
        ))}
        {bookingFeeLabel && (
          <div className="flex items-center justify-between text-sm font-medium text-black/60">
            <span>Booking fee</span>
            <span>{bookingFeeLabel}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t-2 border-dashed border-black/20 pt-3">
        <span className="brand-mono text-xs font-bold text-black/70">Total</span>
        <span className="brand-display text-2xl text-black">{totalLabel}</span>
      </div>

      {onCta && (
        <button
          type="button"
          onClick={onCta}
          disabled={ctaDisabled}
          className="brand-mono mt-3 w-full rounded-sm border-2 border-dashed border-black/60 bg-transparent py-2.5 text-xs font-bold text-black hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ctaLabel}
        </button>
      )}
    </div>

    <div className="flex items-center justify-center gap-1.5 bg-[var(--brand-black)] py-2.5">
      <span className="brand-mono text-[10px] text-white/40">Ticketing by</span>
      <span className="brand-mono rounded-sm bg-[var(--brand-yellow)] px-1.5 py-0.5 text-[10px] font-bold text-black">Outsold</span>
    </div>
  </div>
);

export default TicketOrderSummary;
