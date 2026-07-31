import React, { useRef } from 'react';
import { Phone, Mail, ChevronDown, Share2, Ban, CheckCircle2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import type { Attendee } from '../types/attendee.types';

interface AttendeeCardProps {
  attendee: Attendee;
  isExpanded: boolean;
  onToggle: () => void;
  onCheckIn: (id: string) => void;
  onCancel?: (id: string) => void;
  eventTitle?: string;
  eventDate?: string;
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

export const AttendeeCard: React.FC<AttendeeCardProps> = ({
  attendee,
  isExpanded,
  onToggle,
  onCheckIn,
  onCancel,
  eventTitle,
  eventDate,
}) => {
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const buildTicketCanvas = (): HTMLCanvasElement | null => {
    const qrCanvas = qrCanvasRef.current;
    if (!qrCanvas) return null;

    const width = 360;
    const qrSize = 200;
    const padding = 24;
    const lineHeight = 22;
    const height = padding + lineHeight * 3 + 12 + qrSize + 12 + lineHeight + padding;

    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const ctx = out.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    let y = padding + lineHeight;

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(eventTitle || 'Event Ticket', width / 2, y);
    y += lineHeight;

    if (eventDate) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px sans-serif';
      ctx.fillText(eventDate, width / 2, y);
      y += lineHeight;
    }

    ctx.fillStyle = '#334155';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${attendee.name} · ${attendee.tierName}`, width / 2, y);
    y += 12;

    const qrX = (width - qrSize) / 2;
    ctx.drawImage(qrCanvas, qrX, y, qrSize, qrSize);
    y += qrSize + lineHeight;

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px monospace';
    ctx.fillText(attendee.ticketId, width / 2, y);

    return out;
  };

  const handleShare = () => {
    const text = `${eventTitle ? eventTitle + '\n' : ''}${attendee.name} — ${attendee.tierName}\nTicket: ${attendee.ticketId}\nPhone: ${attendee.phone}`;
    const canvas = buildTicketCanvas();

    if (canvas && navigator.share) {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `${attendee.ticketId}.png`, { type: 'image/png' });
        try {
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: attendee.name, text });
          } else {
            await navigator.share({ title: attendee.name, text });
          }
        } catch {
          /* user cancelled share — ignore */
        }
      });
    } else {
      navigator.clipboard?.writeText(text);
    }
  };

  return (
    <div className="bg-[#F9FAFB] dark:bg-[#1E293B] rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 mb-2.5 overflow-hidden transition-all duration-200">
      <div style={{ display: 'none' }}>
        <QRCodeCanvas value={attendee.ticketId} size={200} includeMargin ref={qrCanvasRef} />
      </div>
      <div className="w-full flex items-center justify-between p-3.5">
        <button onClick={onToggle} className="flex items-center gap-3 min-w-0 flex-1 text-left">
          <a
            href={`tel:${attendee.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors shadow-xs"
            title="Call Attendee"
          >
            <Phone size={18} />
          </a>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{attendee.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              {attendee.tierName} · <span className="font-mono text-slate-600 dark:text-slate-300">{attendee.ticketId}</span>
            </p>
          </div>
        </button>
        <button onClick={onToggle} className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${STATUS_STYLES[attendee.status]}`}>
            {STATUS_LABEL[attendee.status]}
          </span>
          <ChevronDown size={18} className={`text-slate-400 dark:text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-200/80 dark:border-slate-800 p-3.5 space-y-2.5 bg-white dark:bg-slate-900/60">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
            <span className="flex items-center gap-2">
              <Mail size={14} className="text-slate-400" /> {attendee.email}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
            <span className="flex items-center gap-2">
              <Phone size={14} className="text-slate-400" /> {attendee.phone}
            </span>
            {attendee.checkedInAt && (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                Checked in at {new Date(attendee.checkedInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="flex rounded-xl overflow-hidden mt-3 gap-2">
            {attendee.status === 'valid' && (
              <button
                onClick={() => onCheckIn(attendee.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#007A78] hover:bg-[#006361] text-white dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5] dark:text-slate-950 text-xs font-extrabold shadow-xs"
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
              onClick={handleShare}
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