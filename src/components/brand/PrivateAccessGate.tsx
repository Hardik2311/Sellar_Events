import React from 'react';
import { Lock } from 'lucide-react';
import BrandNavHeader from './BrandNavHeader';

interface PrivateAccessGateProps {
  organizationName?: string;
  codeInput: string;
  onCodeChange: (value: string) => void;
  onVerify: () => void;
  codeError?: boolean;
  bgImage?: string;
}

// Full-bleed "invite only" gate shown for private events until the visitor
// enters a valid access code. Purely presentational — verification stays
// with the caller (`verifyAccessCode`, sessionStorage persistence, etc).
const PrivateAccessGate: React.FC<PrivateAccessGateProps> = ({
  organizationName,
  codeInput,
  onCodeChange,
  onVerify,
  codeError,
  bgImage,
}) => (
  <div className="brand-theme fixed inset-0 z-50 flex h-dvh w-full flex-col overflow-hidden bg-[var(--brand-black)]">
    <BrandNavHeader organizationName={organizationName} variant="minimal" rightSlot={<span />} />

    {bgImage && (
      <div
        className="absolute inset-0 scale-110 bg-cover bg-center opacity-30 blur-xl"
        style={{ backgroundImage: `url(${bgImage})` }}
        aria-hidden="true"
      />
    )}
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--brand-yellow)]/10 blur-3xl"
      aria-hidden="true"
    />

    <div className="relative z-10 flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-[var(--brand-yellow)]">
          <Lock size={26} className="text-[var(--brand-yellow)]" />
        </div>

        <p className="brand-mono text-xs font-bold text-[var(--brand-yellow)]">Invite only</p>

        <h1 className="brand-display text-4xl leading-none text-white">
          This one&rsquo;s <span className="text-[var(--brand-yellow)]">private.</span>
        </h1>

        <p className="text-sm text-white/60">
          Enter the access code the organizer shared with you to view the event and get tickets.
        </p>

        <div className="mt-2 flex w-full items-stretch gap-2">
          <input
            type="text"
            value={codeInput}
            onChange={(e) => onCodeChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onVerify();
            }}
            placeholder="Access code"
            maxLength={6}
            className="brand-mono flex-1 rounded-sm border border-white/20 bg-white/5 px-3 py-3 text-center text-sm font-bold tracking-[0.2em] text-white placeholder:text-white/30 outline-none focus:border-[var(--brand-yellow)]"
          />
          <button
            type="button"
            onClick={onVerify}
            disabled={!codeInput.trim()}
            className="brand-mono shrink-0 rounded-sm bg-[var(--brand-yellow)] px-5 py-3 text-xs font-bold text-black hover:brightness-95 disabled:opacity-40"
          >
            Unlock
          </button>
        </div>
        {codeError && <p className="text-xs text-red-400">Incorrect code. Please try again.</p>}

        <p className="text-xs text-white/40">Don&rsquo;t have a code? Ask the host who invited you.</p>
      </div>
    </div>

    <div className="relative z-10 flex items-center justify-center gap-1.5 pb-6">
      <span className="brand-mono text-[10px] text-white/40">Ticketing by</span>
      <span className="brand-mono rounded-sm bg-[var(--brand-yellow)] px-1.5 py-0.5 text-[10px] font-bold text-black">Outsold</span>
    </div>
  </div>
);

export default PrivateAccessGate;
