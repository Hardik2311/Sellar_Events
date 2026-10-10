import React from 'react';
import { Lock } from 'lucide-react';

interface BrandNavHeaderProps {
  organizationName?: string;
  /**
   * 'full'    — wordmark on the left, clickable back to the store, plus an optional
   *             self-positioned rightSlot such as HeaderSearch (discover, event detail)
   * 'minimal' — wordmark on the left + a right-side slot (checkout, payment, private gate)
   */
  variant?: 'full' | 'minimal';
  onBrowse?: () => void;
  rightSlot?: React.ReactNode;
}

// Organizer name in Anton with a small yellow EVENTS tag. Mirrors how the
// rest of the app renders `{settings.organizationName || 'Outsold'} Events`.
const Wordmark: React.FC<{ organizationName?: string }> = ({ organizationName }) => (
  <span className="inline-flex min-w-0 items-center gap-2">
    <span className="brand-display truncate text-[22px] leading-none tracking-[0.02em] text-[var(--brand-black)]">
      {organizationName || 'Outsold'}
    </span>
    <span className="brand-label shrink-0 rounded-sm bg-[var(--brand-yellow)] px-1.5 py-0.5 text-[var(--brand-black)]">Events</span>
  </span>
);

const BrandNavHeader: React.FC<BrandNavHeaderProps> = ({ organizationName, variant = 'full', onBrowse, rightSlot }) => {
  if (variant === 'minimal') {
    return (
      <div className="brand-theme w-full border-b border-[var(--brand-line)] bg-[var(--brand-surface)] px-4 sm:px-8">
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4">
          <Wordmark organizationName={organizationName} />
          {rightSlot ?? (
            <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-[var(--brand-teal)]">
              <Lock size={14} aria-hidden="true" /> Secure checkout
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <header className="brand-theme w-full border-b border-[var(--brand-line)] bg-[var(--brand-surface)] px-4 sm:px-8 lg:px-24">
      <div
        className={`relative mx-auto flex h-16 w-full max-w-[1440px] items-center justify-start ${
          rightSlot ? 'pr-12 lg:pr-72 xl:pr-[22rem]' : ''
        }`}
      >
        {onBrowse ? (
          <button
            type="button"
            onClick={onBrowse}
            className="min-w-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]"
          >
            <Wordmark organizationName={organizationName} />
          </button>
        ) : (
          <Wordmark organizationName={organizationName} />
        )}
        {/* Positions itself — e.g. HeaderSearch pins to the right edge */}
        {rightSlot}
      </div>
    </header>
  );
};

export default BrandNavHeader;
