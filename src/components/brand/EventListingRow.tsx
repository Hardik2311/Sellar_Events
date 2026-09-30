import React from 'react';
import { Calendar, MapPin, Wifi, User } from 'lucide-react';

interface EventListingRowProps {
  index: number;
  title: string;
  imageUrl?: string;
  gradientClass: string;
  categoryLabel: string;
  isOnline: boolean;
  dateLabel: string;
  timeLabel: string;
  venueLabel: string;
  organizerName: string;
  dateDay: string;
  dateMonth: string;
  priceLabel: string;
  onOpen: () => void;
  className?: string;
}

// Horizontal ticket-row card used on the discover "What's on" list — artwork
// left, details middle, a yellow date/price stub right, split by the
// perforated divider (the mockup's row-per-event listing).
const EventListingRow: React.FC<EventListingRowProps> = ({
  index,
  title,
  imageUrl,
  gradientClass,
  categoryLabel,
  isOnline,
  dateLabel,
  timeLabel,
  venueLabel,
  organizerName,
  dateDay,
  dateMonth,
  priceLabel,
  onOpen,
  className = '',
}) => (
  <div
    className={`group flex cursor-pointer flex-col overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm transition-shadow hover:shadow-md sm:flex-row ${className}`}
    onClick={onOpen}
  >
    {/* Artwork */}
    <div className={`relative h-36 w-full shrink-0 overflow-hidden bg-gradient-to-br sm:h-auto sm:w-56 ${gradientClass}`}>
      {imageUrl && <img src={imageUrl} alt={title} className="absolute inset-0 h-full w-full object-cover" />}
    </div>

    {/* Details */}
    <div className="flex flex-1 flex-col justify-center gap-1.5 p-4">
      <span className="brand-mono text-[10px] text-black/40">
        No. {String(index).padStart(2, '0')} &middot; {categoryLabel} &middot; {isOnline ? 'Online' : 'In person'}
      </span>
      <h3 className="brand-display text-xl leading-tight text-[var(--brand-black)]">{title}</h3>

      <div className="mt-1 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-slate-600 sm:grid-cols-3">
        <span className="flex items-center gap-1.5">
          <Calendar size={12} className="text-black/40" /> {dateLabel}, {timeLabel}
        </span>
        <span className="flex items-center gap-1.5">
          {isOnline ? <Wifi size={12} className="text-black/40" /> : <MapPin size={12} className="text-black/40" />}
          <span className="truncate">{isOnline ? 'Online' : venueLabel}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <User size={12} className="text-black/40" /> {organizerName}
        </span>
      </div>
    </div>

    {/* Perforated divider + yellow date/price stub */}
    <div className="relative flex shrink-0 items-stretch">
      <div className="flex w-full items-center justify-between gap-4 border-t-2 border-dashed border-black/15 bg-[var(--brand-yellow)] px-5 py-4 sm:w-52 sm:flex-col sm:items-center sm:justify-center sm:border-t-0 sm:border-l-2">
        <div className="text-center">
          <p className="brand-mono text-[10px] font-bold text-black/60">{dateMonth}</p>
          <p className="brand-display text-3xl leading-none text-black">{dateDay}</p>
        </div>
        <div className="text-center">
          <p className="brand-mono text-[10px] text-black/60">from</p>
          <p className="brand-display text-lg text-black">{priceLabel}</p>
        </div>
        <span className="brand-mono rounded-sm bg-black px-3 py-1.5 text-[10px] font-bold text-white">
          Get tickets &rarr;
        </span>
      </div>
    </div>
  </div>
);

export default EventListingRow;
