import React from 'react';
import { ArrowUpRight } from 'lucide-react';

// Outsold's marketing site — every customer-facing "Ticketing by Outsold"
// badge links here (tagged so storefront traffic shows up in analytics).
export const OUTSOLD_SITE_URL = 'https://outsold.in/?utm_source=storefront&utm_medium=ticketing_badge';

interface PoweredByOutsoldProps {
  size?: 'sm' | 'md';
  className?: string;
}

// Prominent "Ticketing by OUTSOLD ↗" button — Outsold's marketing slot on
// every organizer storefront (footers, order summary, ticket confirmation).
const PoweredByOutsold: React.FC<PoweredByOutsoldProps> = ({ size = 'md', className = '' }) => (
  <a
    href={OUTSOLD_SITE_URL}
    target="_blank"
    rel="noopener noreferrer"
    className={`brand-mono group inline-flex items-center gap-2 rounded-sm bg-[var(--brand-yellow)] font-bold text-black shadow-sm ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:shadow-md hover:brightness-105 ${
      size === 'sm' ? 'px-3 py-1.5 text-[10px]' : 'px-4 py-2.5 text-xs'
    } ${className}`}
  >
    <span className="text-black/60">Ticketing by</span>
    <span className="tracking-widest">Outsold</span>
    <ArrowUpRight size={size === 'sm' ? 12 : 14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
  </a>
);

export default PoweredByOutsold;
