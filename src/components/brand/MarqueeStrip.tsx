import React from 'react';

interface MarqueeStripProps {
  items: string[];
  className?: string;
}

// Scrolling ticker banner under the discover hero. Pure CSS marquee — the
// item list is duplicated so the loop is seamless.
const MarqueeStrip: React.FC<MarqueeStripProps> = ({ items, className = '' }) => {
  if (items.length === 0) return null;
  const loop = [...items, ...items];

  return (
    <div className={`overflow-hidden bg-[var(--brand-yellow)] py-2 ${className}`}>
      <div className="brand-marquee-track flex w-max items-center gap-6 whitespace-nowrap">
        {loop.map((item, i) => (
          <span key={i} className="brand-mono flex items-center gap-6 text-xs font-bold text-black">
            {item}
            <span aria-hidden="true">&#9728;</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes brand-marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .brand-marquee-track {
          animation: brand-marquee-scroll 22s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default MarqueeStrip;
