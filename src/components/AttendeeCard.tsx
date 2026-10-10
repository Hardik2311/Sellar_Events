import React, { useRef, useState } from 'react';
import { Phone, Mail, ChevronDown, Pencil, FileText, X, Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
//import { jsPDF } from 'jspdf';
import type { Attendee } from '../types/attendee.types';
import type { CustomField } from '../types/event.types';
import { buildAcknowledgementPdf, type AcknowledgementTicketData, type AcknowledgementEventData } from '../lib/ticketPdf';

interface AttendeeCardProps {
  attendee: Attendee;
  isExpanded: boolean;
  onToggle: () => void;
  onCheckIn?: (id: string) => void; // optional — hidden/disabled when the user lacks CHECK_IN_ATTENDEE permission
  onCancel?: (id: string) => void;  // optional — hidden/disabled when the user lacks CANCEL_ATTENDEE permission
  eventTitle?: string;
  eventDate?: string;
   eventTime?: string;
  eventVenue?: string;
  eventBannerDataUrl?: string | null; // pre-fetched cover image for the PDF acknowledgement banner
  eventConsentText?: string; // organizer's "Important information & consent" text, appended to the PDF
  eventGoodToKnowText?: string;   // NEW
  eventIsOnline?: boolean;        // NEW
  eventIsPrivate?: boolean;       // NEW
  eventArriveBy?: string | null;       // NEW — "Arrive by" time shown on the PDF
  eventAgeLimit?: string | null;       // NEW — age limit text shown on the PDF
  eventHelplineNumber?: string | null; // NEW — shown as "Need help?" on the PDF
  bookMoreTicketsUrl?: string | null;  // NEW — public event page link for the "Book more tickets" PDF button
  customFields?: CustomField[];
  onRevive?: (id: string) => void;
  onEdit?: (attendee: Attendee) => void;
  /** Set when this ticket is part of a group booking (one QR for the group). */
  groupInfo?: { size: number; arrived: number };
}

const STATUS_STYLES: Record<Attendee['status'], string> = {
  valid: 'bg-gray-100 text-gray-600',
  checked_in: 'bg-emerald-50 text-emerald-600',
  cancelled: 'bg-red-50 text-red-500',
};

// NEW — mirrors the colored payment-mode chip shown on invoice cards (e.g. "CASH" tag)
const PAYMENT_MODE_BADGE_STYLES: Record<NonNullable<Attendee['paymentMode']>, string> = {
  Cash: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPI: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Card: 'bg-blue-50 text-blue-700 border-blue-200',
  Netbanking: 'bg-purple-50 text-purple-700 border-purple-200',
  Other: 'bg-slate-100 text-slate-600 border-slate-200',
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
  eventTime,
  eventVenue,
  eventBannerDataUrl,
  eventConsentText,
  eventGoodToKnowText,
  eventIsOnline,
  eventIsPrivate,
  eventArriveBy,
  eventAgeLimit,
  eventHelplineNumber,
  bookMoreTicketsUrl,
  customFields = [],
  groupInfo,
}) => {
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [screenshotModalOpen, setScreenshotModalOpen] = useState(false);

  // Older manual-QR attendee records (created before paymentMode was stored)
  // have no paymentMode saved — but manual_qr always means UPI, so infer it
  // instead of showing a blank/incorrect payment mode.
  const displayPaymentMode: Attendee['paymentMode'] | undefined =
    attendee.paymentMode ?? (attendee.paymentMethod === 'manual_qr' ? 'UPI' : undefined);

  const [sharing, setSharing] = useState(false);

  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  const buildTicketDataForPdf = (): AcknowledgementTicketData => ({
    ticketId: attendee.ticketId,
    tierName: attendee.tierName,
    attendeeName: attendee.name,
    attendeeEmail: attendee.email,
    attendeePhone: attendee.phone,
    amountPaid: attendee.amountPaid,
    paymentMode: displayPaymentMode,
    purchasedAt: attendee.purchasedAt,
    createdAt: attendee.createdAt,
    isCancelled: attendee.status === 'cancelled',
  });

  const buildEventDataForPdf = (): AcknowledgementEventData => ({
    eventTitle,
    eventDate,
    eventTime,
    eventVenue,
    eventBannerDataUrl,
    eventConsentText,
    eventGoodToKnowText,
    eventIsOnline,
    eventIsPrivate,
    eventArriveBy,
    eventAgeLimit,
    eventHelplineNumber,
    bookMoreTicketsUrl,
  });

    const handleDownloadPdf = async () => {
    const doc = await buildAcknowledgementPdf(buildTicketDataForPdf(), buildEventDataForPdf(), qrCanvasRef.current);
    doc.save(`${attendee.ticketId}-receipt.pdf`);
  };

    const handleSharePdf = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const doc = await buildAcknowledgementPdf(buildTicketDataForPdf(), buildEventDataForPdf(), qrCanvasRef.current);
      const file = new File([doc.output('blob')], `${attendee.ticketId}-receipt.pdf`, { type: 'application/pdf' });
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') return; // user backed out of the share sheet themselves
          /* share failed for some other reason — fall through to download below */
        }
      }
      doc.save(file.name);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="bg-[#F9FAFB] dark:bg-[#1E293B] rounded-sm shadow-xs border border-slate-200 dark:border-slate-800 mb-2.5 overflow-hidden transition-all duration-200">
      <div style={{ display: 'none' }}>
        <QRCodeCanvas value={attendee.ticketId} size={200} includeMargin ref={qrCanvasRef} />
      </div>
      <div className="w-full flex items-center justify-between p-3.5">
        <button onClick={onToggle} className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer">
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
            {attendee.accessCode && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
                Access code: <span className="font-mono text-slate-500 dark:text-slate-400">{attendee.accessCode}</span>
              </p>
            )}
            {groupInfo && (
              <p className="mt-1 inline-flex items-center gap-1 rounded-sm bg-[#007A78]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#007A78] dark:bg-[#2DD4BF]/10 dark:text-[#2DD4BF]">
                Group of {groupInfo.size} · {groupInfo.arrived}/{groupInfo.size} arrived
              </p>
            )}
          </div>
        </button>
        <button onClick={onToggle} className="flex items-center gap-2 shrink-0 cursor-pointer">
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
                className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 px-2 py-1 -my-1 rounded-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
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

          {/* Payment mode + amount + QR indicator + screenshot link — merged into single row */}
          {(displayPaymentMode || typeof attendee.amountPaid === 'number' || attendee.screenshotUrl) && (
            <div className="flex items-center justify-between gap-2 rounded-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Paid via: {displayPaymentMode ?? '—'}
                {typeof attendee.amountPaid === 'number' && (
                  <span className="text-slate-800 dark:text-slate-100 font-extrabold">
                    {' '}₹{attendee.amountPaid.toLocaleString('en-IN')}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {attendee.paymentMethod === 'manual_qr' && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-amber-50 text-amber-700 border border-amber-200"
                    title="Paid via UPI QR — verify screenshot at check-in"
                  >
                    QR
                  </span>
                )}
                {displayPaymentMode && (
                  <span
                    className={`text-[9px] font-extrabold tracking-wide px-2 py-0.5 rounded-sm border ${PAYMENT_MODE_BADGE_STYLES[displayPaymentMode] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                  >
                    {displayPaymentMode.toUpperCase()}
                  </span>
                )}
                {attendee.paymentMethod === 'manual_qr' && attendee.screenshotUrl && (
                  <button
                    type="button"
                    onClick={() => setScreenshotModalOpen(true)}
                    className="text-[10px] font-bold text-amber-700 underline underline-offset-2 hover:text-amber-800 cursor-pointer"
                  >
                    View screenshot
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex rounded-sm overflow-hidden mt-3 gap-1.5">
            {attendee.status !== 'cancelled' && onCheckIn && (
              <button
                onClick={() => onCheckIn(attendee.id)}
                title={attendee.status === 'checked_in' ? 'Tap to undo check-in' : 'Check in this attendee'}
                className={`flex-1 min-w-0 flex items-center justify-center py-2.5 px-1 rounded-sm text-[11px] font-extrabold shadow-xs transition-colors truncate pointer ${attendee.status === 'checked_in'
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
              onClick={() => setShareMenuOpen(true)}
              disabled={sharing}
              className="flex-1 min-w-0 flex items-center justify-center py-2.5 px-1 rounded-sm bg-blue-50 text-blue-600 text-[11px] font-bold truncate disabled:opacity-50 cursor-pointer"
            >
              {sharing ? 'Sharing…' : 'Share'}
            </button>
            {attendee.status !== 'cancelled' && onCancel && (
              <button
                onClick={() => onCancel(attendee.id)}
                className="flex-1 min-w-0 flex items-center justify-center py-2.5 px-1 rounded-sm bg-[#FF3B30] text-white text-[11px] font-bold truncate cursor-pointer"
              >
                Cancel
              </button>
            )}
            {attendee.status === 'cancelled' && onRevive && (
              <button
                onClick={() => onRevive(attendee.id)}
                title="Restore this ticket to valid status"
                className="flex-1 min-w-0 flex items-center justify-center py-2.5 px-1 rounded-sm bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold truncate hover:bg-amber-100 cursor-pointer"
              >
                Revive
              </button>
            )}
          </div>
        </div>
      )}

      {shareMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShareMenuOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-sm bg-white dark:bg-slate-800 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-800 dark:text-white">Share</p>
              <button onClick={() => setShareMenuOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex w-full items-stretch gap-1.5">
                <button
                  onClick={() => { setShareMenuOpen(false); handleSharePdf(); }}
                  className="flex flex-1 min-w-0 items-start gap-3 rounded-sm border-2 border-slate-300 dark:border-slate-600 px-3 py-3 text-left hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <FileText size={18} className="mt-0.5 shrink-0 text-[#007A78] dark:text-[#2DD4BF]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">Share ticket</span>
                    <span className="block text-xs font-normal text-slate-400">Acknowledgement with ticket &amp; payment details</span>
                  </span>
                </button>
                <button
                  onClick={() => { setShareMenuOpen(false); handleDownloadPdf(); }}
                  className="flex shrink-0 items-center rounded-sm border-2 border-slate-300 dark:border-slate-600 px-3 text-slate-400 hover:bg-gray-50 hover:text-[#007A78] dark:hover:bg-slate-700 dark:hover:text-[#2DD4BF] cursor-pointer"
                  title="Download ticket"
                  aria-label="Download ticket"
                >
                  <Download size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {screenshotModalOpen && attendee.screenshotUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setScreenshotModalOpen(false)}
        >
          <div
            className="relative max-w-lg w-full max-h-[85vh] bg-white dark:bg-slate-900 rounded-sm shadow-xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Payment Screenshot</span>
              <button
                onClick={() => setScreenshotModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 text-lg leading-none px-1 cursor-pointer"
                title="Close"
              >
                &times;
              </button>
            </div>
            <div className="overflow-auto p-3 flex items-center justify-center bg-slate-50 dark:bg-slate-800/60">
              <img
                src={attendee.screenshotUrl}
                alt="Payment screenshot"
                className="max-w-full max-h-[70vh] object-contain rounded-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendeeCard;