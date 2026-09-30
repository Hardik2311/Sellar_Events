import React from 'react';

interface SectionLabelProps {
  index: string | number;
  children: React.ReactNode;
  className?: string;
}

// The numbered section heading style used across the redesigned checkout /
// manual-QR / event-detail pages: "01 YOUR DETAILS".
const SectionLabel: React.FC<SectionLabelProps> = ({ index, children, className = '' }) => (
  <h2 className={`flex items-baseline gap-2 brand-display text-lg text-[var(--brand-black)] ${className}`}>
    <span className="brand-mono text-xs font-bold text-[var(--brand-teal)]">
      {typeof index === 'number' ? String(index).padStart(2, '0') : index}
    </span>
    {children}
  </h2>
);

export default SectionLabel;
