import React from 'react';

interface FeaturedPosterProps {
  title: string;
  imageUrl?: string;
  gradientClass: string;
  categoryLabel: string;
  dateLabel: string;
  priceLabel: string;
  onOpen: () => void;
  className?: string;
}

// The tilted "featured event" poster with a round price sticker shown in the
// discover hero's right column.
const FeaturedPoster: React.FC<FeaturedPosterProps> = ({
  title,
  imageUrl,
  gradientClass,
  categoryLabel,
  dateLabel,
  priceLabel,
  onOpen,
  className = '',
}) => (
  <div className={`relative ${className}`}>
    {/* Shadow card behind, for the stacked/tilted effect */}
    <div className="absolute inset-0 translate-x-3 translate-y-3 rotate-3 rounded-lg bg-black/80" aria-hidden="true" />

    <button
      type="button"
      onClick={onOpen}
      className="relative block w-full -rotate-1 overflow-hidden rounded-lg border border-black/10 bg-white text-left shadow-xl transition-transform hover:rotate-0"
    >
      <div className={`relative h-56 w-full bg-gradient-to-br sm:h-64 ${gradientClass}`}>
        {imageUrl && <img src={imageUrl} alt={title} className="absolute inset-0 h-full w-full object-cover" />}
      </div>
      <div className="p-4">
        <p className="brand-mono text-[10px] text-black/40">Featured &middot; {categoryLabel}</p>
        <h3 className="brand-display mt-1 text-2xl leading-tight text-[var(--brand-black)]">{title}</h3>
        <p className="brand-mono mt-1 text-[10px] text-black/50">{dateLabel}</p>
      </div>
    </button>

    <div className="absolute -right-3 -top-3 flex h-20 w-20 rotate-6 flex-col items-center justify-center rounded-full bg-[var(--brand-yellow)] text-center shadow-lg">
      <span className="brand-mono text-[8px] font-bold text-black/60">from</span>
      <span className="brand-display text-sm leading-none text-black">{priceLabel}</span>
    </div>
  </div>
);

export default FeaturedPoster;
