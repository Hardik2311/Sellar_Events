import React from 'react';
import { Check } from 'lucide-react';

interface BrandCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

// Custom checkbox for the customer pages. The native input is visually hidden
// (the global `color-scheme: light dark` made it render black on phones in
// dark mode) and a drawn box takes its place. The whole padded row is one
// <label>, so tapping either the box or the text toggles it.
const BrandCheckbox: React.FC<BrandCheckboxProps> = ({ checked, onChange, children, className = '' }) => (
  <label className={`flex cursor-pointer select-none items-start gap-3 py-1 text-[15px] leading-[22px] text-[var(--brand-black)] ${className}`}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="peer sr-only"
    />
    <span
      aria-hidden="true"
      className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] transition-colors [color-scheme:light] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--brand-teal)] peer-focus-visible:ring-offset-2 ${
        checked ? 'border-[var(--brand-teal)] bg-[var(--brand-teal)]' : 'border-[var(--brand-line-strong)] bg-[var(--brand-surface)]'
      }`}
    >
      {checked && <Check size={14} strokeWidth={3} className="text-[var(--brand-cream)]" />}
    </span>
    <span className="min-w-0">{children}</span>
  </label>
);

export default BrandCheckbox;
