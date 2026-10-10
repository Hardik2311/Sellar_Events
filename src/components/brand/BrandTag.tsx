import React from 'react';

export type BrandTagVariant = 'featured' | 'highlight' | 'neutral' | 'success' | 'muted';

const VARIANTS: Record<BrandTagVariant, string> = {
  featured: 'bg-[var(--brand-yellow)] text-[var(--brand-black)]',
  highlight: 'bg-[var(--brand-discover-bg)] text-[var(--brand-black)] ring-1 ring-inset ring-[var(--brand-yellow)]',
  neutral: 'bg-[var(--brand-surface)] text-[var(--brand-black)] ring-1 ring-inset ring-[var(--brand-line-strong)]',
  success: 'bg-[var(--brand-teal-soft)] text-[var(--brand-teal)]',
  muted: 'bg-[var(--brand-skeleton)] text-[var(--brand-muted)]',
};

interface BrandTagProps {
  variant?: BrandTagVariant;
  icon?: React.ElementType;
  children: React.ReactNode;
  className?: string;
}

// Small status pill in Space Mono: Featured, Few left, In person, Sold out.
const BrandTag: React.FC<BrandTagProps> = ({ variant = 'neutral', icon: Icon, children, className = '' }) => (
  <span className={`brand-label inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 ${VARIANTS[variant]} ${className}`}>
    {Icon && <Icon size={12} strokeWidth={2} aria-hidden="true" />}
    {children}
  </span>
);

export default BrandTag;
