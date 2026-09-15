import React, { useRef, useState } from 'react';
import { Phone, Mail, ChevronDown, Pencil, QrCode, FileText, X, Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import type { Attendee } from '../types/attendee.types';
import type { CustomField } from '../types/event.types';
import { stripHtmlTags } from '../lib/utils';
import { shareTicketImage } from '../lib/shareTicket';
import { useAuth } from '../context/AuthContext';

interface AttendeeCardProps {
  attendee: Attendee;
  isExpanded: boolean;
  onToggle: () => void;
  onCheckIn?: (id: string) => void; // optional — hidden/disabled when the user lacks CHECK_IN_ATTENDEE permission
  onCancel?: (id: string) => void;  // optional — hidden/disabled when the user lacks CANCEL_ATTENDEE permission
  eventTitle?: string;
  eventDate?: string;
  eventVenue?: string;
  eventBannerDataUrl?: string | null; // pre-fetched cover image for the PDF acknowledgement banner
  eventConsentText?: string; // organizer's "Important information & consent" text, appended to the PDF
  customFields?: CustomField[];
  onRevive?: (id: string) => void;
  onEdit?: (attendee: Attendee) => void;
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
  eventVenue,
  eventBannerDataUrl,
  eventConsentText,
  customFields = [],
}) => {
   const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [screenshotModalOpen, setScreenshotModalOpen] = useState(false);
  const { profile } = useAuth();

  // Older manual-QR attendee records (created before paymentMode was stored)
  // have no paymentMode saved — but manual_qr always means UPI, so infer it
  // instead of showing a blank/incorrect payment mode.
  const displayPaymentMode: Attendee['paymentMode'] | undefined =
    attendee.paymentMode ?? (attendee.paymentMethod === 'manual_qr' ? 'UPI' : undefined);

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
    const titleText = stripHtmlTags(eventTitle || '') || 'Event Ticket';
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

  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (sharing) return; // prevent double-tap re-entry
    setSharing(true);
    try {
      const cleanEventTitle = eventTitle ? stripHtmlTags(eventTitle) : '';
      const text = `${cleanEventTitle ? cleanEventTitle + '\n' : ''}${attendee.name} — ${attendee.tierName}\nTicket: ${attendee.ticketId}\nPhone: ${attendee.phone}`;
      const canvas = buildTicketCanvas();
      if (canvas) {
        // sirf image jaayegi, koi caption text nahi — WhatsApp me duplicate text nahi aayega
        await shareTicketImage(
          canvas.toDataURL('image/png'),
          `${attendee.ticketId}.png`,
          'image/png',
          { title: attendee.name, text }
        );
      }
    } finally {
      setSharing(false);
    }
  };

  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  const handleDownloadTicket = () => {
    const canvas = buildTicketCanvas();
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${attendee.ticketId}.png`;
    link.click();
  };

  // A small, compact single-page acknowledgement — event cover banner (if
  // pre-fetched), company header, attendee/ticket/payment details laid out
  // two-per-row to use the width, the same QR the ticket uses, and the
  // organizer's own consent/important-information text (nothing else).
  const buildAcknowledgementPdf = (): jsPDF => {
    const cleanEventTitle = eventTitle ? stripHtmlTags(eventTitle) : 'Event';
    const companyName = profile?.organizationName || 'Event Organizer';
    const pageW = 360;
    const marginX = 24;
    const topMargin = 28; // top inset used on any continuation page
    const bottomMargin = 30;
    const hasBanner = !!eventBannerDataUrl;
    const bannerH = hasBanner ? 104 : 0;
    const headerH = 58;
    const hasQr = !!qrCanvasRef.current;
    const consentText = eventConsentText ? stripHtmlTags(eventConsentText).trim() : '';

    // Wrapped line count depends on font metrics, so measure against a
    // throwaway doc first — needed up front since the first page's height
    // has to be fixed at construction.
    const consentFontSize = 8;
    const consentLineHeight = consentFontSize * 1.3;
    const measureDoc = new jsPDF({ unit: 'pt', format: [pageW, 100] });
    measureDoc.setFont('helvetica', 'normal');
    measureDoc.setFontSize(consentFontSize);
    const consentLines = consentText ? (measureDoc.splitTextToSize(consentText, pageW - marginX * 2) as string[]) : [];
    const consentHeadingHeight = consentLines.length > 0 ? 22 : 0;
    const hasConsent = consentLines.length > 0;

    // Page 1 is always just the ticket itself (banner/header/fields/QR) —
    // sized to fit that exactly. Consent/important-information, if any,
    // always starts fresh on page 2 (and overflows onto further pages if
    // it's long), rather than being appended to the bottom of page 1.
    const page1Height =
      bannerH + headerH +
      20 /* gap after header */ + 16 /* title */ + 18 /* meta */ +
      14 /* divider */ + 30 * 3 /* attendee/ticket/payment pairs */ +
      14 /* divider */ + 34 /* amount paid */ +
      14 /* divider */ + (hasQr ? 132 : 0) /* qr + caption */ +
      16 /* bottom padding */ +
      (hasConsent ? 0 : 14 + 10 /* generated-on line, only if it's staying on page 1 */);

    const STANDARD_PAGE_H = 700;
    const doc = new jsPDF({ unit: 'pt', format: [pageW, page1Height] });
    let pageH = page1Height;

    // Adds a new page (same width, standard height) if the next block won't
    // fit in the remaining space on the current page.
    const ensureSpace = (neededHeight: number) => {
      if (y + neededHeight <= pageH - bottomMargin) return;
      doc.addPage([pageW, STANDARD_PAGE_H]);
      pageH = STANDARD_PAGE_H;
      y = topMargin;
    };

    let y = 0;
    if (hasBanner && eventBannerDataUrl) {
      try {
        doc.addImage(eventBannerDataUrl, 'JPEG', 0, 0, pageW, bannerH);
        y = bannerH;
      } catch {
        /* skip the banner if it somehow fails to embed */
      }
    }

    doc.setFillColor(11, 59, 58);
    doc.rect(0, y, pageW, headerH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(companyName, pageW / 2, y + 24, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('PAYMENT ACKNOWLEDGEMENT & E-TICKET', pageW / 2, y + 40, { align: 'center' });
    y += headerH + 20;

    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(cleanEventTitle, marginX, y, { maxWidth: pageW - marginX * 2 });
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(107, 114, 128);
    const eventMeta = [eventDate ? new Date(eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null, eventVenue]
      .filter(Boolean)
      .join('  ·  ');
    if (eventMeta) doc.text(eventMeta, marginX, y, { maxWidth: pageW - marginX * 2 });
    y += 18;

    const divider = () => {
      doc.setDrawColor(229, 231, 235);
      doc.line(marginX, y, pageW - marginX, y);
      y += 14;
    };

    // Two-column field grid — makes better use of the width than one field per row.
    const colGap = 12;
    const colW = (pageW - marginX * 2 - colGap) / 2;
    const rightX = marginX + colW + colGap;
    const cell = (x: number, label: string, value: string) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(107, 114, 128);
      doc.text(label.toUpperCase(), x, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(17, 24, 39);
      doc.text(value || '—', x, y + 13, { maxWidth: colW });
    };
    const pairRow = (labelL: string, valueL: string, labelR: string, valueR: string) => {
      cell(marginX, labelL, valueL);
      cell(rightX, labelR, valueR);
      y += 30;
    };

    divider();
    pairRow('Attendee', attendee.name, 'Ticket tier', attendee.tierName);
    pairRow('Email', attendee.email || '—', 'Ticket ID', attendee.ticketId);
    pairRow('Phone', attendee.phone || '—', 'Payment mode', displayPaymentMode || '—');
    divider();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('AMOUNT PAID', marginX, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(0, 122, 120);
    doc.text(`Rs. ${(attendee.amountPaid ?? 0).toLocaleString('en-IN')}`, marginX, y + 18);
    y += 34;
    divider();

    const qrCanvas = qrCanvasRef.current;
    if (qrCanvas) {
      const qrSize = 100;
      const qrX = (pageW - qrSize) / 2;
      doc.addImage(qrCanvas.toDataURL('image/png'), 'PNG', qrX, y, qrSize, qrSize);
      y += qrSize + 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(156, 163, 175);
      doc.text('SCAN AT ENTRY · NON-TRANSFERABLE', pageW / 2, y, { align: 'center' });
      y += 20;
    }

    // Organizer's consent/important-information text — the only free-text
    // block on this PDF. Always starts on a fresh page after the ticket,
    // and overflows onto further pages of its own if it's long.
    if (hasConsent) {
      doc.addPage([pageW, STANDARD_PAGE_H]);
      pageH = STANDARD_PAGE_H;
      y = topMargin;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(17, 24, 39);
      doc.text('CONSENT & IMPORTANT INFORMATION', marginX, y);
      y += consentHeadingHeight;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(consentFontSize);
      doc.setTextColor(75, 85, 99);
      for (const line of consentLines) {
        ensureSpace(consentLineHeight);
        doc.text(line, marginX, y);
        y += consentLineHeight;
      }
      y += 14;
    }

    ensureSpace(10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(156, 163, 175);
    doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, pageW / 2, y, { align: 'center' });

    return doc;
  };

  const handleDownloadPdf = () => {
    const doc = buildAcknowledgementPdf();
    doc.save(`${attendee.ticketId}-receipt.pdf`);
  };

  const handleSharePdf = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const doc = buildAcknowledgementPdf();
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
            {attendee.accessCode && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
                Access code: <span className="font-mono text-slate-500 dark:text-slate-400">{attendee.accessCode}</span>
              </p>
            )}
          </div>
        </button>
        <button onClick={onToggle} className="flex items-center gap-2 shrink-0">
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
                    className="text-[10px] font-bold text-amber-700 underline underline-offset-2 hover:text-amber-800"
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
              onClick={() => setShareMenuOpen(true)}
              disabled={sharing}
              className="flex-1 min-w-0 flex items-center justify-center py-2.5 px-1 rounded-sm bg-blue-50 text-blue-600 text-[11px] font-bold truncate disabled:opacity-50"
            >
              {sharing ? 'Sharing…' : 'Share'}
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
              <button onClick={() => setShareMenuOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex w-full items-stretch gap-1.5">
                <button
                  onClick={() => { setShareMenuOpen(false); handleShare(); }}
                  className="flex flex-1 min-w-0 items-start gap-3 rounded-sm border-2 border-slate-300 dark:border-slate-600 px-3 py-3 text-left hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  <QrCode size={18} className="mt-0.5 shrink-0 text-[#007A78] dark:text-[#2DD4BF]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">Share ticket</span>
                    <span className="block text-xs font-normal text-slate-400">The QR ticket image</span>
                  </span>
                </button>
                <button
                  onClick={() => { setShareMenuOpen(false); handleDownloadTicket(); }}
                  className="flex shrink-0 items-center rounded-sm border-2 border-slate-300 dark:border-slate-600 px-3 text-slate-400 hover:bg-gray-50 hover:text-[#007A78] dark:hover:bg-slate-700 dark:hover:text-[#2DD4BF]"
                  title="Download ticket"
                  aria-label="Download ticket"
                >
                  <Download size={18} />
                </button>
              </div>
              <div className="flex w-full items-stretch gap-1.5">
                <button
                  onClick={() => { setShareMenuOpen(false); handleSharePdf(); }}
                  className="flex flex-1 min-w-0 items-start gap-3 rounded-sm border-2 border-slate-300 dark:border-slate-600 px-3 py-3 text-left hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  <FileText size={18} className="mt-0.5 shrink-0 text-[#007A78] dark:text-[#2DD4BF]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">Share PDF</span>
                    <span className="block text-xs font-normal text-slate-400">Acknowledgement with ticket &amp; payment details</span>
                  </span>
                </button>
                <button
                  onClick={() => { setShareMenuOpen(false); handleDownloadPdf(); }}
                  className="flex shrink-0 items-center rounded-sm border-2 border-slate-300 dark:border-slate-600 px-3 text-slate-400 hover:bg-gray-50 hover:text-[#007A78] dark:hover:bg-slate-700 dark:hover:text-[#2DD4BF]"
                  title="Download PDF"
                  aria-label="Download PDF"
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
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 text-lg leading-none px-1"
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