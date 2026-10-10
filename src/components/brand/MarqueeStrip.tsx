import React from 'react';
import { Sparkle } from 'lucide-react';

interface MarqueeStripProps {
  items: string[];
  className?: string;
}

// Each half of the loop must be wider than the widest screen, otherwise a
// short list (1–2 events) scrolls off and leaves an empty yellow gap.
const MIN_ITEMS_PER_GROUP = 12;
// Seconds per item, so the scroll speed stays the same however many items repeat.
const SECONDS_PER_ITEM = 3.5;

// Scrolling ticker banner under the discover hero. Pure CSS marquee: one
// group of items (repeated until it's wide enough) is rendered twice and the
// track slides by exactly one group width (-50%), so the loop is seamless.
const MarqueeStrip: React.FC<MarqueeStripProps> = ({ items, className = '' }) => {
  if (items.length === 0) return null;

  const repeats = Math.ceil(MIN_ITEMS_PER_GROUP / items.length);
  const group = Array.from({ length: repeats }, () => items).flat();

  // Each group carries its own trailing padding (instead of a gap between the
  // two groups) so both halves are identical and -50% lands exactly.
  const renderGroup = (copy: number) => (
    <div className="flex shrink-0 items-center gap-6 pr-6" aria-hidden={copy > 0}>
      {group.map((item, i) => (
        <span key={`${copy}-${i}`} className="brand-mono flex items-center gap-6 text-xs font-bold text-[var(--brand-black)]">
          {item}
          <Sparkle size={14} strokeWidth={2} aria-hidden="true" />
        </span>
      ))}
    </div>
  );

  return (
    <div className={`overflow-hidden bg-[var(--brand-yellow)] py-2 ${className}`}>
      <div
        className="brand-marquee-track flex w-max whitespace-nowrap"
        style={{ animationDuration: `${group.length * SECONDS_PER_ITEM}s` }}
      >
        {renderGroup(0)}
        {renderGroup(1)}
      </div>
      <style>{`
        @keyframes brand-marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .brand-marquee-track {
          animation: brand-marquee-scroll 40s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .brand-marquee-track { animation-play-state: paused; }
        }
      `}</style>
    </div>
  );
};

export default MarqueeStrip;
