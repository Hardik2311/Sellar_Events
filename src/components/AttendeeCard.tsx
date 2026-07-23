import React from 'react';
import { Phone, Mail, ChevronDown, Share2, Ban, CheckCircle2 } from 'lucide-react';
import type { Attendee } from '../types/attendee.types';

interface AttendeeCardProps {
  attendee: Attendee;
  isExpanded: boolean;
  onToggle: () => void;
  onCheckIn: (id: string) => void;
  onCancel?: (id: string) => void;
  // TODO — backend wiring: parent (Attendees.tsx) needs to pass a real
  // cancel handler that updates ticket status to 'cancelled' server-side.
}

const STATUS_STYLES: Record<Attendee['status'], string> = {
  valid: 'bg-gray-100 text-gray-600',
  checked_in: 'bg-emerald-50 text-emerald-600',
  cancelled: 'bg-red-50 text-red-500',
};

const STATUS_LABEL: Record<Attendee['status'], string> = {
  valid: 'Not arrived',
  checked_in: 'Checked in',
  cancelled: 'Cancelled',
};

const handleShare = (attendee: Attendee) => {
  const text = `${attendee.name} — ${attendee.tierName}\nTicket: ${attendee.ticketId}\nPhone: ${attendee.phone}`;
  if (navigator.share) {
    navigator.share({ title: attendee.name, text }).catch(() => { });
  } else {
    navigator.clipboard?.writeText(text);
  }
};

export const AttendeeCard: React.FC<AttendeeCardProps> = ({ attendee, isExpanded, onToggle, onCheckIn, onCancel }) => {
  return (
    <div className="bg-white rounded-sm shadow-sm border border-gray-100 mb-2 overflow-hidden">
      <div className="w-full flex items-center justify-between p-3">
        <button onClick={onToggle} className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
          <a
            href={`tel:${attendee.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
            title="Call"
          >
            <Phone size={16} />
          </a>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{attendee.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {attendee.tierName} · {attendee.ticketId}
            </p>
          </div>
        </button>
        <button onClick={onToggle} className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[attendee.status]}`}>
            {STATUS_LABEL[attendee.status]}
          </span>
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-100 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs text-gray-600">
            <span className="flex items-center gap-2">
              <Mail size={13} className="text-gray-400" /> {attendee.email}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-gray-600">
            <span className="flex items-center gap-2">
              <Phone size={13} className="text-gray-400" /> {attendee.phone}
            </span>
            {attendee.checkedInAt && (
              <span className="text-[11px] font-medium text-emerald-600 shrink-0">
                Checked in at {new Date(attendee.checkedInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="flex rounded-sm overflow-hidden mt-2">
            {attendee.status === 'valid' && (
              <button
                onClick={() => onCheckIn(attendee.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#F97316] text-white text-xs font-bold"
              >
                <CheckCircle2 size={14} /> Check In
              </button>
            )}
            <a
              href={`tel:${attendee.phone}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-50 text-emerald-600 text-xs font-bold"
            >
              <Phone size={14} /> Call
            </a>
            <button
              onClick={() => handleShare(attendee)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 text-blue-600 text-xs font-bold"
            >
              <Share2 size={14} /> Share
            </button>
            {attendee.status !== 'cancelled' && (
              <button
                onClick={() => onCancel?.(attendee.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#FF3B30] text-white text-xs font-bold"
              >
                <Ban size={14} /> Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendeeCard;