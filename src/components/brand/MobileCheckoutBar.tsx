import React from 'react';
import BrandButton from './BrandButton';

interface MobileCheckoutBarProps {
  countLabel: string;
  totalLabel: string;
  ctaLabel: string;
  onCta: () => void;
  ctaDisabled?: boolean;
}

// Fixed bottom bar on mobile (event detail / checkout / manual-QR payment):
// ticket count + running total on the left, the one primary action on the
// right. Pages that render it must add `pb-24 lg:pb-0` to their root so the
// footer isn't hidden underneath.
const MobileCheckoutBar: React.FC<MobileCheckoutBarProps> = ({ countLabel, totalLabel, ctaLabel, onCta, ctaDisabled }) => (
  <div className="brand-theme fixed bottom-0 left-0 right-0 z-30 bg-[var(--brand-black)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-[var(--brand-cream)] shadow-[0_-8px_24px_rgb(20_18_15/0.18)] lg:hidden">
    <div className="flex w-full items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="brand-label text-[#c9c4b8]">{countLabel}</p>
        <p className="brand-display mt-0.5 truncate text-2xl leading-none tabular-nums text-[var(--brand-yellow)]">{totalLabel}</p>
      </div>
      <BrandButton variant="onInk" onClick={onCta} disabled={ctaDisabled} className="shrink-0">
        {ctaLabel}
      </BrandButton>
    </div>
  </div>
);

export default MobileCheckoutBar;
