import React from 'react';
import { AlertCircle, Lock } from 'lucide-react';
import BrandNavHeader from './BrandNavHeader';
import BrandButton from './BrandButton';
import BrandTag from './BrandTag';
import PoweredByOutsold from './PoweredByOutsold';

interface PrivateAccessGateProps {
  organizationName?: string;
  codeInput: string;
  onCodeChange: (value: string) => void;
  onVerify: () => void;
  codeError?: boolean;
  // Access codes haven't loaded yet, so a code can't be checked.
  verifying?: boolean;
}

// Full-screen "invite only" gate shown for private events until the visitor
// enters a valid access code. Purely presentational — verification stays
// with the caller (`verifyAccessCode`, sessionStorage persistence, etc).
const PrivateAccessGate: React.FC<PrivateAccessGateProps> = ({
  organizationName,
  codeInput,
  onCodeChange,
  onVerify,
  codeError,
  verifying,
}) => (
  <div className="brand-theme fixed inset-0 z-50 flex h-dvh w-full flex-col overflow-y-auto bg-[var(--brand-black)]">
    <BrandNavHeader organizationName={organizationName} variant="minimal" rightSlot={<span />} />

    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6">
      <div className="flex w-full max-w-[420px] flex-col gap-3.5 rounded-xl bg-[var(--brand-surface)] p-7 text-[var(--brand-black)]">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-discover-bg)]">
          <Lock size={22} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <BrandTag variant="neutral" className="self-start">Invite only</BrandTag>
        <h1 className="brand-display text-[28px] leading-[1.05]">
          This one&rsquo;s <span className="text-[var(--brand-teal)]">private.</span>
        </h1>
        <p className="text-[15px] leading-[22px] text-[var(--brand-muted)]">
          Enter the access code the organizer shared with you to see the event and book.
        </p>

        <label className="mt-1 flex flex-col gap-2">
          <span className="text-[13px] font-semibold">Access code</span>
          <input
            type="text"
            value={codeInput}
            onChange={(e) => onCodeChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onVerify();
            }}
            maxLength={6}
            autoComplete="off"
            aria-invalid={codeError || undefined}
            className={`brand-mono h-14 w-full rounded-lg border bg-[var(--brand-surface)] px-3 text-center text-xl font-bold tracking-[0.3em] text-[var(--brand-black)] outline-none focus:ring-1 ${
              codeError
                ? 'border-[var(--brand-danger)] focus:ring-[var(--brand-danger)]'
                : 'border-[var(--brand-line-strong)] focus:border-[var(--brand-teal)] focus:ring-[var(--brand-teal)]'
            }`}
          />
        </label>
        {codeError && (
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--brand-danger)]">
            <AlertCircle size={14} aria-hidden="true" /> That code didn&rsquo;t match. Check it and try again.
          </p>
        )}

        <BrandButton variant="primary" block onClick={onVerify} disabled={!codeInput.trim() || verifying}>
          {verifying && codeInput.trim() ? 'Checking…' : 'Unlock event'}
        </BrandButton>
        <p className="text-center text-[13px] text-[var(--brand-muted)]">No code? Ask the host who invited you.</p>
      </div>

      <PoweredByOutsold size="sm" />
    </div>
  </div>
);

export default PrivateAccessGate;
