import React from 'react';

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

// Section heading on the storefront pages: plain Anton, no numbering.
const SectionLabel: React.FC<SectionLabelProps> = ({ children, className = '' }) => (
  <h2 className={`brand-display text-2xl leading-[1.05] text-[var(--brand-black)] sm:text-[28px] ${className}`}>{children}</h2>
);

export default SectionLabel;
