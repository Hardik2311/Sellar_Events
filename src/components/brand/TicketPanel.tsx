import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface TierRow {
  id: string;
  name: string;
  priceLabel: string;
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
  consent?: {
    text: string;
    acknowledged: boolean;
    onToggle: (v: boolean) => void;
  };
  lineItems: { id: string; label: string; amountLabel: string }[];
  totalLabel: string;
  ctaLabel: string;
  onCta: () => void;
  ctaDisabled: boolean;
  className?: string;
}

// The sticky ticket-selection panel on the event-detail page's right rail
// (desktop) / right-after-title block (mobile): tier rows on top, a dashed
// perforation, then a dark stub with the selected lines, total and CTA.
const TicketPanel: React.FC<TicketPanelProps> = ({
  maxPerOrder,
  tiers,
  allSoldOut,
  emptyMessage,
  consent,
  lineItems,
  totalLabel,
  ctaLabel,
  onCta,
  ctaDisabled,
  className = '',
}) => (
  <div className={`overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm ${className}`}>
    <div className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="brand-display text-lg text-[var(--brand-black)]">Tickets</h2>
        <span className="brand-mono text-[10px] text-black/40">Max {maxPerOrder} per order</span>
      </div>

      {allSoldOut ? (
        <p className="mt-3 rounded-sm bg-slate-50 p-3 text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <div className="mt-3 flex flex-col divide-y divide-gray-100">
          {tiers.map((tier) => (
            <div key={tier.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{tier.name}</p>
                <p className="brand-display text-base text-[var(--brand-black)]">{tier.priceLabel}</p>
                {tier.remainingLabel && (
                  <p className="brand-mono text-[10px] text-slate-400">{tier.remainingLabel}</p>
                )}
              </div>

              {tier.soldOut ? (
                <span className="brand-mono rounded-sm bg-gray-100 px-3 py-1.5 text-[10px] font-bold text-gray-400">
                  {tier.salesEnded ? 'Sales ended' : 'Sold out'}
                </span>
              ) : (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={tier.onDecrement}
                    disabled={tier.decrementDisabled}
                    className="rounded-sm border border-gray-300 p-1.5 text-slate-600 hover:bg-gray-50 disabled:opacity-30"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-5 text-center text-sm font-medium text-slate-800">{tier.qty}</span>
                  <button
                    type="button"
                    onClick={tier.onIncrement}
                    disabled={tier.incrementDisabled}
                    className="rounded-sm border border-gray-300 p-1.5 text-slate-600 hover:bg-gray-50 disabled:opacity-30"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {consent && (
        <label className="mt-3 flex items-start gap-2 text-xs font-medium text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={consent.acknowledged}
            onChange={(e) => consent.onToggle(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 bg-white accent-[var(--brand-teal)]"
          />
          {consent.text}
        </label>
      )}
    </div>

    {lineItems.length > 0 && (
      <>
        <div className="border-t-2 border-dashed border-black/10" />
        <div className="bg-[var(--brand-black)] p-4">
          <div className="space-y-1">
            {lineItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs text-white/70">
                <span>{item.label}</span>
                <span>{item.amountLabel}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
            <span className="brand-mono text-xs font-bold text-white/60">Total</span>
            <span className="brand-display text-xl text-[var(--brand-yellow)]">{totalLabel}</span>
          </div>
          <button
            type="button"
            onClick={onCta}
            disabled={ctaDisabled}
            className="brand-mono mt-3 w-full rounded-sm bg-[var(--brand-yellow)] py-2.5 text-xs font-bold text-black hover:brightness-95 disabled:opacity-40"
          >
            {ctaLabel}
          </button>
        </div>
      </>
    )}
  </div>
);

export default TicketPanel;
