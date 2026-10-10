import React from 'react';
import { Minus, Plus } from 'lucide-react';
import BrandButton from './BrandButton';
import BrandTag from './BrandTag';
import TicketDivider from './TicketDivider';

interface TierRow {
  id: string;
  name: string;
  priceLabel: string;
  description?: string;
  remainingLabel?: string;
  qty: number;
  soldOut: boolean;
  salesEnded?: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementDisabled: boolean;
  incrementDisabled: boolean;
}

interface TicketPanelProps {
  maxPerOrder: number;
  tiers: TierRow[];
  allSoldOut: boolean;
  emptyMessage: string;
  lineItems: { id: string; label: string; amountLabel: string }[];
  countLabel: string;
  totalLabel: string;
  ctaLabel: string;
  onCta: () => void;
  ctaDisabled: boolean;
  /** The MobileCheckoutBar carries the action below lg, so the panel's own button hides there. */
  hideCtaOnMobile?: boolean;
  className?: string;
}

// The ticket picker on the event page: tier rows with a stepper, then a
// punched perforation and an ink stub with the lines, total and CTA.
const TicketPanel: React.FC<TicketPanelProps> = ({
  maxPerOrder,
  tiers,
  allSoldOut,
  emptyMessage,
  lineItems,
  countLabel,
  totalLabel,
  ctaLabel,
  onCta,
  ctaDisabled,
  hideCtaOnMobile = false,
  className = '',
}) => (
  <div className={`overflow-hidden rounded-xl border border-[var(--brand-line)] bg-[var(--brand-surface)] ${className}`}>
    <div className="p-4 lg:p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="brand-display text-2xl leading-none text-[var(--brand-black)]">Tickets</h2>
        <span className="text-[13px] text-[var(--brand-muted)]">Max {maxPerOrder} per order</span>
      </div>

      {allSoldOut ? (
        <p className="mt-4 rounded-lg bg-[var(--brand-skeleton)] p-3 text-sm text-[var(--brand-muted)]">{emptyMessage}</p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {tiers.map((tier) => {
            const selected = tier.qty > 0;
            return (
              <div
                key={tier.id}
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-lg p-4 ${
                  selected
                    ? 'border-[1.5px] border-[var(--brand-teal)] bg-[var(--brand-teal-soft)]'
                    : 'border border-[var(--brand-line)]'
                } ${tier.soldOut ? 'opacity-70' : ''}`}
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold leading-[22px] text-[var(--brand-black)]">
                    {tier.name}
                    {tier.remainingLabel && !tier.soldOut && <BrandTag variant="highlight">{tier.remainingLabel}</BrandTag>}
                  </p>
                  <p className="text-[15px] font-bold leading-[22px] tabular-nums text-[var(--brand-black)]">{tier.priceLabel}</p>
                </div>

                {tier.soldOut ? (
                  <BrandTag variant="muted">{tier.salesEnded ? 'Sales ended' : 'Sold out'}</BrandTag>
                ) : (
                  <div
                    className={`inline-flex h-9 shrink-0 items-center rounded-sm border bg-[var(--brand-surface)] ${
                      selected ? 'border-[var(--brand-teal)]' : 'border-[var(--brand-line-strong)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={tier.onDecrement}
                      disabled={tier.decrementDisabled}
                      aria-label={`Remove one ${tier.name} ticket`}
                      className="flex h-full w-9 items-center justify-center rounded-sm text-[var(--brand-black)] hover:bg-[var(--brand-skeleton)] disabled:text-[var(--brand-line-strong)] disabled:hover:bg-transparent"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="min-w-6 text-center text-[15px] font-bold tabular-nums text-[var(--brand-black)]" aria-live="polite">
                      {tier.qty}
                    </span>
                    <button
                      type="button"
                      onClick={tier.onIncrement}
                      disabled={tier.incrementDisabled}
                      aria-label={`Add one ${tier.name} ticket`}
                      className="flex h-full w-9 items-center justify-center rounded-sm text-[var(--brand-black)] hover:bg-[var(--brand-skeleton)] disabled:text-[var(--brand-line-strong)] disabled:hover:bg-transparent"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                )}

                {tier.description && (
                  <p className="col-span-2 text-[13px] font-medium leading-[18px] text-[var(--brand-muted)]">{tier.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>

    {lineItems.length > 0 && (
      <>
        <div className="relative h-6 bg-[var(--brand-surface)]">
          <TicketDivider notchColor="var(--brand-cream)" className="absolute inset-x-0 top-1/2" />
        </div>
        <div className="bg-[var(--brand-black)] px-4 py-4 text-[var(--brand-cream)] lg:px-5">
          <ul className="flex flex-col gap-1.5">
            {lineItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 text-sm tabular-nums text-[#c9c4b8]">
                <span className="min-w-0 truncate">{item.label}</span>
                <span>{item.amountLabel}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-end justify-between gap-4 border-t border-white/10 pt-3">
            <span className="brand-label text-[#c9c4b8]">{countLabel}</span>
            <span className="brand-display text-2xl leading-none tabular-nums text-[var(--brand-yellow)]">{totalLabel}</span>
          </div>
          <BrandButton
            variant="onInk"
            block
            onClick={onCta}
            disabled={ctaDisabled}
            className={`mt-4 ${hideCtaOnMobile ? 'hidden lg:flex' : ''}`}
          >
            {ctaLabel}
          </BrandButton>
        </div>
      </>
    )}
  </div>
);

export default TicketPanel;
