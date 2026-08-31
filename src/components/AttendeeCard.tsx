import React, { useRef } from 'react';
import { Phone, Mail, ChevronDown, Pencil } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import type { Attendee } from '../types/attendee.types';
import type { CustomField } from '../types/event.types';

interface AttendeeCardProps {
  attendee: Attendee;
  isExpanded: boolean;
  onToggle: () => void;
  onCheckIn?: (id: string) => void; // optional — hidden/disabled when the user lacks CHECK_IN_ATTENDEE permission
  onCancel?: (id: string) => void;  // optional — hidden/disabled when the user lacks CANCEL_ATTENDEE permission
  eventTitle?: string;
  eventDate?: string;
  customFields?: CustomField[];
  onRevive?: (id: string) => void;
  onEdit?: (attendee: Attendee) => void;
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
  onRevive,
  onEdit,
  eventTitle,
  eventDate,
  customFields = [],
}) => {
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const buildTicketCanvas = (): HTMLCanvasElement | null => {
    const qrCanvas = qrCanvasRef.current;
    if (!qrCanvas) return null;

    const SCALE = 3;
    const width = 360;
    const cardMargin = 14;
    const cardW = width - cardMargin * 2;
    const headerH = 112;
    const stubPadTop = 22;
    const qrSize = 160;
    const qrBoxPad = 14;
    const boxSize = qrSize + qrBoxPad * 2;
    const notchR = 10;
    const height = cardMargin + headerH + stubPadTop + boxSize + 26 + 18 + 24 + cardMargin;

    const out = document.createElement('canvas');
    out.width = width * SCALE;
    out.height = height * SCALE;
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    ctx.scale(SCALE, SCALE);

    const PAGE_BG = '#F1F1EF';
    const CARD_BG = '#FFFFFF';
    const INK = '#0B3B3A';
    const TEAL = '#007A78';

    ctx.fillStyle = PAGE_BG;
    ctx.fillRect(0, 0, width, height);

    const cardX = cardMargin;
    const cardY = cardMargin;
    const cardH = height - cardMargin * 2;
    const radius = 20;

    // soft drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(11,59,58,0.18)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = CARD_BG;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.fill();
    ctx.restore();

    // clip to card
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.clip();

    ctx.fillStyle = CARD_BG;
    ctx.fillRect(cardX, cardY, cardW, cardH);

    // gradient header
    const grad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + headerH);
    grad.addColorStop(0, INK);
    grad.addColorStop(1, TEAL);
    ctx.fillStyle = grad;
    ctx.fillRect(cardX, cardY, cardW, headerH);

    // texture circles
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cardX + cardW - 20, cardY + 18, 46, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cardX + 18, cardY + headerH - 6, 30, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // header text
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('E · T I C K E T', cardX + 20, cardY + 22);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    const titleText = eventTitle || 'Event Ticket';
    ctx.fillText(titleText.length > 26 ? titleText.slice(0, 24) + '…' : titleText, cardX + 20, cardY + 44);

    if (eventDate) {
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = '11px sans-serif';
      ctx.fillText(eventDate, cardX + 20, cardY + 60);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '600 12px sans-serif';
    ctx.fillText(attendee.name, cardX + 20, cardY + 80);

    // tier pill
    ctx.font = 'bold 10px sans-serif';
    const pillText = attendee.tierName.toUpperCase();
    const pillW = ctx.measureText(pillText).width + 18;
    const pillH = 20;
    const pillX = cardX + 20;
    const pillY = cardY + 88;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(pillText, pillX + 9, pillY + 14);

    ctx.restore();

    // perforation seam
    const seamY = cardY + headerH;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.clip();
    ctx.fillStyle = PAGE_BG;
    ctx.beginPath(); ctx.arc(cardX, seamY, notchR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cardX + cardW, seamY, notchR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(11,59,58,0.18)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(cardX + notchR + 6, seamY);
    ctx.lineTo(cardX + cardW - notchR - 6, seamY);
    ctx.stroke();
    ctx.setLineDash([]);

    // QR box with viewfinder corners
    let y = seamY + stubPadTop;
    const boxX = (width - boxSize) / 2;
    ctx.fillStyle = CARD_BG;
    ctx.strokeStyle = 'rgba(11,59,58,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(boxX, y, boxSize, boxSize, 14);
    ctx.fill();
    ctx.stroke();
    ctx.drawImage(qrCanvas, boxX + qrBoxPad, y + qrBoxPad, qrSize, qrSize);

    const bracket = 14;
    ctx.strokeStyle = TEAL;
    ctx.lineWidth = 2.5;
    const bx = boxX + 6, by = y + 6, bw = boxSize - 12, bh = boxSize - 12;
    const drawCorner = (cx: number, cy: number, dx: number, dy: number) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy + bracket * dy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + bracket * dx, cy);
      ctx.stroke();
    };
    drawCorner(bx, by, 1, 1);
    drawCorner(bx + bw, by, -1, 1);
    drawCorner(bx, by + bh, 1, -1);
    drawCorner(bx + bw, by + bh, -1, -1);

    // ticket id
    y += boxSize + 26;
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.font = '600 13px monospace';
    ctx.fillText(attendee.ticketId.split('').join('\u200a'), width / 2, y);

    y += 18;
    ctx.fillStyle = 'rgba(11,59,58,0.4)';
    ctx.font = '10px sans-serif';
    ctx.fillText('SCAN AT ENTRY · NON-TRANSFERABLE', width / 2, y);

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
            // sirf image jaayegi, koi caption text nahi — WhatsApp me duplicate text nahi aayega
            await navigator.share({ files: [file] });
          } else {
            // file-share support na ho tabhi ye fallback text chalega
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
    <div className="bg-[#F9FAFB] dark:bg-[#1E293B] rounded-sm shadow-xs border border-slate-200 dark:border-slate-800 mb-2.5 overflow-hidden transition-all duration-200">
      <div style={{ display: 'none' }}>
        <QRCodeCanvas value={attendee.ticketId} size={200} includeMargin ref={qrCanvasRef} />
      </div>
      <div className="w-full flex items-center justify-between p-3.5">
        <button onClick={onToggle} className="flex items-center gap-3 min-w-0 flex-1 text-left">
          <a
            href={`tel:${attendee.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="w-10 h-10 rounded-sm flex items-center justify-center shrink-0 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors shadow-xs"
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
          {attendee.paymentMethod === 'manual_qr' && (
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-sm bg-amber-50 text-amber-700 border border-amber-200"
              title="Paid via UPI QR — verify screenshot at check-in"
            >
              QR
            </span>
          )}
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-sm ${STATUS_STYLES[attendee.status]}`}>
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
            {onEdit && (
              <button
                onClick={() => onEdit(attendee)}
                title="Edit attendee details"
                className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 px-2 py-1 -my-1 rounded-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              >
                <Pencil size={13} /> Edit
              </button>
            )}
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

          {/* NEW — payment-proof link, only for tickets paid via manual UPI QR */}
          {attendee.paymentMethod === 'manual_qr' && attendee.screenshotUrl && (
            <a
              href={attendee.screenshotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-sm px-2.5 py-1.5 hover:bg-amber-100"
            >
              View payment screenshot
            </a>
          )}

          {attendee.customFieldAnswers && Object.keys(attendee.customFieldAnswers).length > 0 && (
            <div className="rounded-sm bg-slate-50 dark:bg-slate-800/60 p-2.5 space-y-1">
              {Object.entries(attendee.customFieldAnswers).map(([fieldId, value]) => {
                const field = customFields.find((f) => f.id === fieldId);
                const label = field?.label || fieldId;
                const display = field?.type === 'checkbox' ? (value === 'true' ? 'Yes' : 'No') : (value || '—');
                return (
                  <div key={fieldId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">{label}</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{display}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex rounded-sm overflow-hidden mt-3 gap-1.5">
            {attendee.status !== 'cancelled' && onCheckIn && (
              <button
                onClick={() => onCheckIn(attendee.id)}
                title={attendee.status === 'checked_in' ? 'Tap to undo check-in' : 'Check in this attendee'}
                className={`flex-1 min-w-0 flex items-center justify-center py-2.5 px-1 rounded-sm text-[11px] font-extrabold shadow-xs transition-colors truncate ${attendee.status === 'checked_in'
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                  : 'bg-[#007A78] hover:bg-[#006361] text-white dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5] dark:text-slate-950'
                  }`}
              >
                {attendee.status === 'checked_in' ? 'Checked In' : 'Check In'}
              </button>
            )}
            <a
              href={`tel:${attendee.phone}`}
              className="flex-1 min-w-0 flex items-center justify-center py-2.5 px-1 rounded-sm bg-emerald-50 text-emerald-600 text-[11px] font-bold truncate"
            >
              Call
            </a>
            <button
              onClick={handleShare}
              className="flex-1 min-w-0 flex items-center justify-center py-2.5 px-1 rounded-sm bg-blue-50 text-blue-600 text-[11px] font-bold truncate"
            >
              Share
            </button>
            {attendee.status !== 'cancelled' && onCancel && (
              <button
                onClick={() => onCancel(attendee.id)}
                className="flex-1 min-w-0 flex items-center justify-center py-2.5 px-1 rounded-sm bg-[#FF3B30] text-white text-[11px] font-bold truncate"
              >
                Cancel
              </button>
            )}
            {attendee.status === 'cancelled' && onRevive && (
              <button
                onClick={() => onRevive(attendee.id)}
                title="Restore this ticket to valid status"
                className="flex-1 min-w-0 flex items-center justify-center py-2.5 px-1 rounded-sm bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold truncate hover:bg-amber-100"
              >
                Revive
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendeeCard;