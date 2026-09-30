import React from 'react';
import { Lock } from 'lucide-react';

interface BrandNavHeaderProps {
  organizationName?: string;
  /**
   * 'full'    — wordmark + Browse/My tickets/Help nav + Sign in (discover, event detail)
   * 'minimal' — wordmark + a right-side slot only, no nav (checkout, payment, private gate)
   */
  variant?: 'full' | 'minimal';
  onBrowse?: () => void;
  rightSlot?: React.ReactNode;
}

// Dynamic tenant wordmark — "{organizationName} EVENTS", with EVENTS always
// styled in brand yellow, mirroring how the rest of the app already renders
// `{settings.organizationName || 'Outsold'} Events` (see Customereventdiscover).
const Wordmark: React.FC<{ organizationName?: string; className?: string }> = ({ organizationName, className = '' }) => (
  <span className={`brand-mono text-sm font-bold tracking-widest text-white ${className}`}>
    {(organizationName || 'Outsold').toUpperCase()} <span className="text-[var(--brand-yellow)]">EVENTS</span>
  </span>
);

const BrandNavHeader: React.FC<BrandNavHeaderProps> = ({ organizationName, variant = 'full', onBrowse, rightSlot }) => {
  if (variant === 'minimal') {
    return (
      <div className="brand-theme flex items-center justify-between gap-3 bg-[var(--brand-black)] px-4 py-3 sm:px-8">
        <Wordmark organizationName={organizationName} />
        {rightSlot ?? (
          <span className="brand-mono flex items-center gap-1 text-[10px] text-white/50">
            <Lock size={11} /> Secure checkout
          </span>
        )}
      </div>
    );
  }

  return (
    <header className="brand-theme w-full bg-[var(--brand-black)] px-4 py-3 sm:px-8 lg:px-24">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between">
        <Wordmark organizationName={organizationName} className="text-base sm:text-lg" />

        <nav className="flex items-center gap-5">
          <button
            type="button"
            onClick={onBrowse}
            className="brand-mono hidden text-xs font-bold text-white/70 hover:text-white transition-colors sm:inline"
          >
            Browse
          </button>
          <span className="brand-mono hidden text-xs font-bold text-white/30 sm:inline" title="Coming soon">
            My tickets
          </span>
          <span className="brand-mono hidden text-xs font-bold text-white/30 sm:inline" title="Coming soon">
            Help
          </span>
          <button
            type="button"
            className="brand-mono rounded-sm bg-white px-3 py-1.5 text-xs font-bold text-black hover:bg-white/90 transition-colors"
          >
            Sign in
          </button>
        </nav>
      </div>
    </header>
  );
};

export default BrandNavHeader;
