import React from 'react';

interface EventCardProps {
  title: string;
  /** Prefer the 4:5 mobile cover; any other cover is cropped to fit. */
  imageUrl?: string;
  gradientClass: string;
  dateLabel: string;
  venueLabel: string;
  priceLabel: string;
  onOpen: () => void;
  className?: string;
  soldOut?: boolean;
}

// District-style poster card for the Discover grid: 4:5 poster, then the date
// line, title, venue and price. The whole card opens the event.
const EventCard: React.FC<EventCardProps> = ({
  title,
  imageUrl,
  gradientClass,
  dateLabel,
  venueLabel,
  priceLabel,
  onOpen,
  className = '',
  soldOut = false,
}) => (
  <button
    type="button"
    onClick={onOpen}
    className={`group flex min-w-0 flex-col gap-3 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-teal)] ${className}`}
  >
    <div
      className={`relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-gradient-to-br ${gradientClass} transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_1px_2px_rgb(20_18_15/0.06),0_6px_16px_rgb(20_18_15/0.06)] motion-reduce:transform-none`}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="brand-display absolute inset-x-4 bottom-4 line-clamp-3 text-2xl leading-[0.95] text-[var(--brand-black)]">
          {title}
        </span>
      )}
      {soldOut && (
        <div className="absolute -right-10 top-6 w-40 rotate-45 shadow-md" aria-hidden="true">
          <div
            className="h-1 w-full"
            style={{ background: 'repeating-linear-gradient(135deg, #facc15 0 7px, #111827 7px 14px)' }}
          />
          <div className="bg-yellow-400 py-1 text-center text-[11px] font-extrabold uppercase tracking-wider text-black">
            Sold Out
          </div>
          <div
            className="h-1 w-full"
            style={{ background: 'repeating-linear-gradient(135deg, #facc15 0 7px, #111827 7px 14px)' }}
          />
        </div>
      )}
    </div>

    <div className="flex min-w-0 flex-col gap-1">
      <span className="brand-label text-[var(--brand-teal)]">{dateLabel}</span>
      <h3 className="brand-display line-clamp-2 text-[17px] leading-[1.1] text-[var(--brand-black)] sm:text-xl">{title}</h3>
      <span className="truncate text-[13px] font-medium leading-[18px] text-[var(--brand-muted)]">{venueLabel}</span>
      <span className="text-[15px] font-bold leading-[22px] tabular-nums text-[var(--brand-black)]">{priceLabel}</span>
    </div>
  </button>
);

export default EventCard;
