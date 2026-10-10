import React from 'react';

interface BrandEmptyStateProps {
  icon: React.ElementType;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  tone?: 'default' | 'error';
  className?: string;
}

// One template for empty lists, not-found pages and load errors:
// icon, one Anton line, one sentence, one action.
const BrandEmptyState: React.FC<BrandEmptyStateProps> = ({ icon: Icon, title, body, action, tone = 'default', className = '' }) => (
  <div
    className={`flex flex-col items-center gap-3 rounded-xl border-[1.5px] border-dashed border-[var(--brand-line-strong)] bg-[var(--brand-surface)] px-6 py-10 text-center ${className}`}
  >
    <span
      className={`flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-cream)] ${
        tone === 'error' ? 'text-[var(--brand-danger)]' : 'text-[var(--brand-black)]'
      }`}
    >
      <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
    </span>
    <h2 className="brand-display text-2xl leading-tight text-[var(--brand-black)]">{title}</h2>
    {body && <p className="max-w-[40ch] text-[15px] leading-[22px] text-[var(--brand-muted)]">{body}</p>}
    {action && <div className="mt-1">{action}</div>}
  </div>
);

export default BrandEmptyState;
