import React from 'react';
import { Calendar, Clock, MapPin, Wifi, Share2, Ticket } from 'lucide-react';
import TicketDivider from './TicketDivider';

interface EventTicketCardProps {
  title: string;
  imageUrl?: string;
  gradientClass: string;
  categoryLabel: string;
  isOnline: boolean;
  dateLabel: string;
  timeLabel: string;
  venueLabel: string;
  priceLabel: string;
  organizerName: string;
  statusBadge?: { label: string; tone: 'sold-out' | 'selling-fast' } | null;
  onOpen: () => void;
  onShare?: (e: React.MouseEvent) => void;
  /** Organizer-only controls (toggle live/featured, edit, delete, etc). */
  controlsSlot?: React.ReactNode;
  /** Bigger hero-style rendering for the "featured" pick. */
  featured?: boolean;
  className?: string;
}

// Presentational ticket-stub card shared by the customer discover grid and
// the organizer preview discover grid — data/state stay with the caller.
const EventTicketCard: React.FC<EventTicketCardProps> = ({
  title,
  imageUrl,
  gradientClass,
  categoryLabel,
  isOnline,
  dateLabel,
  timeLabel,
  venueLabel,
  priceLabel,
  organizerName,
  statusBadge,
  onOpen,
  onShare,
  controlsSlot,
  featured = false,
  className = '',
}) => (
  <div
    className={`group flex flex-col overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm transition-shadow hover:shadow-md cursor-pointer ${className}`}
    onClick={onOpen}
  >
    <div className={`relative w-full overflow-hidden bg-gradient-to-br ${gradientClass} ${featured ? 'h-56' : 'h-36'}`}>
      {imageUrl && <img src={imageUrl} alt={title} className="absolute inset-0 h-full w-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />

      <span className="brand-mono absolute left-2 top-2 rounded-sm bg-[var(--brand-yellow)] px-2 py-0.5 text-[10px] font-bold text-black">
        {categoryLabel}
      </span>
      {isOnline && (
        <span className="brand-mono absolute right-9 top-2 flex items-center gap-1 rounded-sm bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-800">
          <Wifi size={11} /> Online
        </span>
      )}
      {onShare && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onShare(e);
          }}
          title="Share event"
          className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-slate-600 hover:bg-[var(--brand-yellow)] hover:text-black transition-colors"
        >
          <Share2 size={13} />
        </button>
      )}
      {statusBadge && (
        <span
          className={`brand-mono absolute bottom-2 right-2 rounded-sm px-2 py-0.5 text-[10px] font-bold ${
            statusBadge.tone === 'sold-out' ? 'bg-black/80 text-white' : 'bg-[var(--brand-teal)] text-white'
          }`}
        >
          {statusBadge.label}
        </span>
      )}

      <h3
        className={`absolute inset-x-0 bottom-0 p-3 brand-display text-white drop-shadow-sm ${
          featured ? 'text-2xl' : 'text-base'
        } line-clamp-2`}
      >
        {title}
      </h3>
    </div>

    <div className="relative bg-white px-3 pt-3">
      <TicketDivider notchColor="#f4efe4" className="absolute inset-x-0 -top-0.5" />
    </div>

    <div className="flex flex-1 flex-col gap-2 p-3 pt-3">
      <div className="brand-mono flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <Calendar size={12} /> {dateLabel}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} /> {timeLabel}
        </span>
      </div>
      <div className="brand-mono flex items-center gap-1 text-[11px] text-slate-500">
        {isOnline ? (
          <>
            <Wifi size={12} /> Online event
          </>
        ) : (
          <>
            <MapPin size={12} /> <span className="truncate">{venueLabel}</span>
          </>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between">
        <span className="brand-display text-lg text-[var(--brand-black)]">{priceLabel}</span>
        <span className="brand-mono flex items-center gap-1 text-[10px] text-slate-400">
          <Ticket size={12} /> by {organizerName}
        </span>
      </div>

      {controlsSlot}
    </div>
  </div>
);

export default EventTicketCard;
