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
    const width = 380;
    const cardMargin = 14;
    const cardW = width - cardMargin * 2;
    const headerH = 172;          // taller — room for title + location + divider + columns
    const stubPadTop = 24;
    const qrSize = 176;
    const qrBoxPad = 16;
    const boxSize = qrSize + qrBoxPad * 2;
    const notchR = 11;
    const height = cardMargin + headerH + stubPadTop + boxSize + 30 + 20 + 26 + cardMargin;

    const out = document.createElement('canvas');
    out.width = width * SCALE;
    out.height = height * SCALE;
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    ctx.scale(SCALE, SCALE);

    const PAGE_BG = '#0A1614';    // dark outer background — only affects the downloaded/shared image
    const CARD_BG = '#FFFFFF';
    const INK = '#0B3B3A';
    const TEAL = '#00A896';
    const WHITE_16 = 'rgba(255,255,255,0.16)';
    const WHITE_35 = 'rgba(255,255,255,0.35)';
    const WHITE_55 = 'rgba(255,255,255,0.55)';
    const WHITE_70 = 'rgba(255,255,255,0.7)';

    ctx.fillStyle = PAGE_BG;
    ctx.fillRect(0, 0, width, height);

    const cardX = cardMargin;
    const cardY = cardMargin;
    const cardH = height - cardMargin * 2;
    const radius = 22;

    // soft drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
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
    ctx.beginPath(); ctx.arc(cardX + cardW - 24, cardY + 20, 50, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cardX + 20, cardY + headerH - 8, 34, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.textAlign = 'left';

    // "E-TICKET" pill + "LIVE PASS" label
    const eyebrowY = cardY + 24;
    ctx.font = 'bold 9px sans-serif';
    const eyebrowText = 'E-TICKET';
    const eyebrowW = ctx.measureText(eyebrowText).width + 16;
    ctx.fillStyle = WHITE_16;
    ctx.beginPath();
    ctx.roundRect(cardX + 20, eyebrowY - 12, eyebrowW, 18, 9);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(eyebrowText, cardX + 28, eyebrowY);
    ctx.fillStyle = WHITE_70;
    ctx.font = '9px sans-serif';
    ctx.fillText('LIVE PASS', cardX + 28 + eyebrowW + 6, eyebrowY);

    // tier pill, top-right (stands in for "GENERAL")
    ctx.font = 'bold 9px sans-serif';
    const tierText = attendee.tierName.toUpperCase();
    const tierW = ctx.measureText(tierText).width + 18;
    const tierX = cardX + cardW - 20 - tierW;
    ctx.fillStyle = WHITE_16;
    ctx.strokeStyle = WHITE_35;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(tierX, eyebrowY - 12, tierW, 18, 9);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(tierText, tierX + 9, eyebrowY);

    // event title, wraps to 2 lines max
    const wrapText = (text: string, maxWidth: number): string[] => {
      const words = text.split(' ');
      const lines: string[] = [];
      let line = '';
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (line && ctx.measureText(test).width > maxWidth) {
          lines.push(line);
          line = w;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      return lines.slice(0, 2);
    };

    ctx.font = 'bold 20px sans-serif';
    const titleText = stripHtmlTags(eventTitle || '') || 'Event Ticket';
    const titleLines = wrapText(titleText, cardW - 40);
    let ty = cardY + 58;
    ctx.fillStyle = '#ffffff';
    titleLines.forEach((line, i) => ctx.fillText(line, cardX + 20, ty + i * 24));
    ty += (titleLines.length - 1) * 24;

    // location row with a small pin glyph (only if venue is known)
    if (eventVenue) {
      const pinCx = cardX + 24;
      const pinCy = ty + 20;
      ctx.fillStyle = WHITE_70;
      ctx.beginPath();
      ctx.arc(pinCx, pinCy - 2, 4, 0, Math.PI * 2);
      ctx.moveTo(pinCx - 3.4, pinCy + 1);
      ctx.lineTo(pinCx, pinCy + 7);
      ctx.lineTo(pinCx + 3.4, pinCy + 1);
      ctx.closePath();
      ctx.fill();
      ctx.font = '11px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(eventVenue, cardX + 34, ty + 24);
      ty += 20;
    }

    // divider
    ty += 14;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + 20, ty);
    ctx.lineTo(cardX + cardW - 20, ty);
    ctx.stroke();

    // two-column info: Attendee / Date
    const colY = ty + 22;
    const colGap = (cardW - 40) / 2;
    ctx.font = '9px sans-serif';
    ctx.fillStyle = WHITE_55;
    ctx.fillText('ATTENDEE', cardX + 20, colY);
    ctx.fillText('DATE', cardX + 20 + colGap, colY);

    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#ffffff';
    const nameText = attendee.name.length > 18 ? `${attendee.name.slice(0, 16)}…` : attendee.name;
    ctx.fillText(nameText, cardX + 20, colY + 16);
    ctx.fillText(eventDate || '—', cardX + 20 + colGap, colY + 16);

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
    ctx.roundRect(boxX, y, boxSize, boxSize, 16);
    ctx.fill();
    ctx.stroke();
    ctx.drawImage(qrCanvas, boxX + qrBoxPad, y + qrBoxPad, qrSize, qrSize);

    const bracket = 16;
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
    ctx.fillStyle = 'rgba(11,59,58,0.45)';
    ctx.font = '600 10px sans-serif';
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

  const buildAcknowledgementPdf = (): jsPDF => {
    const cleanEventTitle = eventTitle ? stripHtmlTags(eventTitle) : 'Event';
    const pageW = 360;
    const marginX = 20;
    const topMargin = 24;
    const bottomMargin = 30;
    const hasBanner = !!eventBannerDataUrl;
    const hasQr = !!qrCanvasRef.current;
    const consentText = eventConsentText ? stripHtmlTags(eventConsentText).trim() : '';

    // ---------- palette (brand teal-green — unchanged) ----------
    const PAGE_BG: [number, number, number] = [255, 255, 255];
    const CARD_BG: [number, number, number] = [236, 253, 245]; // emerald-50
    const CARD_BORDER: [number, number, number] = [167, 243, 208]; // emerald-200
    const INK: [number, number, number] = [11, 59, 58]; // brand ink
    const TEAL: [number, number, number] = [0, 122, 120]; // brand teal
    const TEXT_DARK: [number, number, number] = [17, 24, 39];
    const MUTED: [number, number, number] = [107, 114, 128];
    const GREEN_BG: [number, number, number] = [209, 250, 229];
    const GREEN_TXT: [number, number, number] = [4, 120, 87];
    const RED_BG: [number, number, number] = [254, 226, 226];
    const RED_TXT: [number, number, number] = [185, 28, 28];
    const BLUE_BG: [number, number, number] = [219, 234, 254];
    const BLUE_TXT: [number, number, number] = [29, 78, 216];

    const isCancelled = attendee.status === 'cancelled';
    const statusLabel = isCancelled ? 'Cancelled' : 'Confirmed';
    const statusBg = isCancelled ? RED_BG : GREEN_BG;
    const statusTxt = isCancelled ? RED_TXT : GREEN_TXT;

    // shared measuring doc (used for word-wrap line counts before drawing)
    const measureDoc = new jsPDF({ unit: 'pt', format: [pageW, 100] });
    const wrap = (text: string, fontSize: number, bold: boolean, maxWidth: number): string[] => {
      measureDoc.setFont('helvetica', bold ? 'bold' : 'normal');
      measureDoc.setFontSize(fontSize);
      return measureDoc.splitTextToSize(text || '—', maxWidth) as string[];
    };

    // ---------- "Before you head out" — one numbered item per line the organizer wrote ----------
    const termFontSize = 8.5;
    const termLineHeight = termFontSize * 1.4;
    const termNumW = 16;
    const termLines = consentText
      ? consentText.split(/\r?\n+/).map((t) => t.trim()).filter(Boolean)
      : [];
    const wrappedTerms = termLines.map((t) => wrap(t, termFontSize, false, pageW - marginX * 2 - termNumW));
    const hasTerms = wrappedTerms.length > 0;
    const termsBlockH = wrappedTerms.reduce((sum, lines) => sum + lines.length * termLineHeight + 6, 0);

    // ---- NEW: title now overlays the banner itself, so banner + title = one header block ----
    const titleLines = wrap(cleanEventTitle.toUpperCase(), 15, true, pageW - marginX * 2 - 70);
    const headerBlockH = (hasBanner ? 132 : 96) + (titleLines.length - 1) * 18;

    const eventDateObj = eventDate ? new Date(eventDate) : null;
    const dayNum = eventDateObj ? eventDateObj.getDate().toString() : '--';
    const monthAbbr = eventDateObj ? eventDateObj.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase() : '';
    const weekday = eventDateObj ? eventDateObj.toLocaleDateString('en-IN', { weekday: 'long' }) : '';
    const timeStr = eventDateObj
      ? eventDateObj.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
      : null;

    const dateBoxW = 92;
    const venueBoxW = pageW - marginX * 2 - dateBoxW - 8;
    const venueLines = eventVenue ? wrap(eventVenue, 11, true, venueBoxW - 24) : [];
    const dateVenueRowH = Math.max(80, 34 + venueLines.length * 14 + (timeStr ? 14 : 0));

    // ---- NEW: attendee details + QR now share a single card (text left, QR right) ----
    const qrBoxSize = 108;
    const nameLines = wrap(attendee.name, 13, true, pageW - marginX * 2 - qrBoxSize - 48);
    const tierLabel = attendee.tierName || '—';
    const paymentPillText = `Rs. ${(attendee.amountPaid ?? 0).toLocaleString('en-IN')} · ${(displayPaymentMode || '—').toUpperCase()}`;
    const bookedMs = attendee.purchasedAt ?? attendee.createdAt;
    const bookedStr = bookedMs
      ? new Date(bookedMs).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : null;
    const ticketIdLines = wrap(attendee.ticketId, 9, true, qrBoxSize);

    const leftColH = 16 + 18 + nameLines.length * 16 + 8 + 12 + 12 + (bookedStr ? 12 : 0) + 8 + 10;
    const rightColH = hasQr
      ? 14 + qrBoxSize + 10 + ticketIdLines.length * 11 + 6 + 9 + 8 + 8
      : 0;
    const attendeeCardH = 14 + Math.max(leftColH, rightColH) + 4;

    // ---------- page height ----------
    const page1Height =
      headerBlockH +
      16 +
      dateVenueRowH + 14 +
      18 /* perforation gap */ +
      attendeeCardH + 16 +
      (hasTerms ? 30 + termsBlockH : 0) +
      40 /* footer */ +
      bottomMargin;

    const STANDARD_PAGE_H = 780;
    const doc = new jsPDF({ unit: 'pt', format: [pageW, page1Height] });
    let pageH = page1Height;
    let y = 0;

    const fillPageBg = () => {
      doc.setFillColor(...PAGE_BG);
      doc.rect(0, 0, pageW, pageH, 'F');
    };
    fillPageBg();

    const ensureSpace = (needed: number) => {
      if (y + needed <= pageH - bottomMargin) return;
      doc.addPage([pageW, STANDARD_PAGE_H]);
      pageH = STANDARD_PAGE_H;
      fillPageBg();
      y = topMargin;
    };

    const card = (x: number, yPos: number, w: number, h: number, r = 4) => {
      doc.setFillColor(...CARD_BG);
      doc.setDrawColor(...CARD_BORDER);
      doc.setLineWidth(0.75);
      doc.roundedRect(x, yPos, w, h, r, r, 'FD');
    };

    const pill = (
      text: string,
      x: number,
      yPos: number,
      bg: [number, number, number],
      textColor: [number, number, number]
    ) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      const w = doc.getTextWidth(text.toUpperCase()) + 12;
      doc.setFillColor(...bg);
      doc.roundedRect(x, yPos, w, 14, 7, 7, 'F');
      doc.setTextColor(...textColor);
      doc.text(text.toUpperCase(), x + 6, yPos + 10);
      return w;
    };

    // ---- NEW: header block — banner image (or ink/teal fallback) with eyebrow, status pill
    // and title overlaid directly on top, like the app's ticket card ----
    if (hasBanner && eventBannerDataUrl) {
      try {
        doc.addImage(eventBannerDataUrl, 'JPEG', 0, 0, pageW, headerBlockH);
      } catch {
        doc.setFillColor(...INK);
        doc.rect(0, 0, pageW, headerBlockH, 'F');
      }
      // dark scrim, banded from transparent (top) to translucent (bottom),
      // so the overlaid white text stays readable over any image
      const bands = 8;
      const bandH = headerBlockH / bands;
      for (let i = 0; i < bands; i++) {
        const opacity = (i / (bands - 1)) * 0.6;
        doc.saveGraphicsState();
        doc.setGState(new (doc as any).GState({ opacity }));
        doc.setFillColor(...INK);
        doc.rect(0, i * bandH, pageW, bandH + 1, 'F');
        doc.restoreGraphicsState();
      }
    } else {
      doc.setFillColor(...INK);
      doc.rect(0, 0, pageW, headerBlockH, 'F');
    }

    pill(statusLabel, pageW - marginX - 66, 14, statusBg, statusTxt);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text('E-TICKET', marginX, 22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    const titleBaseY = headerBlockH - 20 - (titleLines.length - 1) * 18;
    titleLines.forEach((line, i) => doc.text(line, marginX, titleBaseY + i * 18));
    y = headerBlockH + 16;

    // ---------- date box + venue, side by side (unchanged) ----------
    doc.setFillColor(...TEAL);
    doc.roundedRect(marginX, y, dateBoxW, dateVenueRowH, 10, 10, 'F');
    doc.setTextColor(255, 255, 255);
    const dateContentH = 60;
    const dateOffsetY = Math.max(12, (dateVenueRowH - dateContentH) / 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.text(dayNum, marginX + 14, y + dateOffsetY + 26);
    doc.setFontSize(11);
    doc.text(monthAbbr, marginX + 14, y + dateOffsetY + 44);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(weekday, marginX + 14, y + dateOffsetY + 60, { maxWidth: dateBoxW - 20 });

    card(marginX + dateBoxW + 8, y, venueBoxW, dateVenueRowH);
    let vy = y + 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text('VENUE', marginX + dateBoxW + 20, vy);
    vy += 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...TEXT_DARK);
    venueLines.forEach((line) => {
      doc.text(line, marginX + dateBoxW + 20, vy);
      vy += 13;
    });
    if (timeStr) {
      vy += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text('SHOW STARTS', marginX + dateBoxW + 20, vy);
      vy += 12;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...TEAL);
      doc.text(timeStr, marginX + dateBoxW + 20, vy);
    }
    y += dateVenueRowH + 8;

    // ---------- perforation (dashed line + notch cutouts) ----------
    doc.setFillColor(...PAGE_BG);
    doc.circle(marginX - 6, y, 8, 'F');
    doc.circle(pageW - marginX + 6, y, 8, 'F');
    doc.setDrawColor(...CARD_BORDER);
    doc.setLineWidth(1);
    doc.setLineDashPattern([4, 4], 0);
    doc.line(marginX + 6, y, pageW - marginX - 6, y);
    doc.setLineDashPattern([], 0);
    y += 18;

    // ---- NEW: single ticket-holder card — attendee details (left) + QR (right) together ----
    card(marginX, y, pageW - marginX * 2, attendeeCardH);
    const cardTop = y;
    const qrRight = pageW - marginX - 14;
    const qrLeft = qrRight - qrBoxSize;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text('TICKET HOLDER', marginX + 14, cardTop + 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...TEXT_DARK);
    let ny = cardTop + 34;
    nameLines.forEach((line) => {
      doc.text(line, marginX + 14, ny, { maxWidth: qrLeft - marginX - 28 });
      ny += 16;
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(attendee.email || '—', marginX + 14, ny);
    ny += 12;
    doc.text(attendee.phone || '—', marginX + 14, ny);
    if (bookedStr) {
      ny += 12;
      doc.text(`Booked ${bookedStr}`, marginX + 14, ny);
    }
    ny += 10;
    const tierPillW = pill(tierLabel, marginX + 14, ny, GREEN_BG, GREEN_TXT);
    pill(paymentPillText, marginX + 14 + tierPillW + 6, ny, BLUE_BG, BLUE_TXT);

    if (hasQr && qrCanvasRef.current) {
      const qrTop = cardTop + 14;
      doc.setFillColor(...PAGE_BG);
      doc.setDrawColor(...CARD_BORDER);
      doc.roundedRect(qrLeft, qrTop, qrBoxSize, qrBoxSize, 4, 4, 'FD');
      const pad = 10;
      doc.addImage(
        qrCanvasRef.current.toDataURL('image/png'),
        'PNG',
        qrLeft + pad,
        qrTop + pad,
        qrBoxSize - pad * 2,
        qrBoxSize - pad * 2
      );

      let qy = qrTop + qrBoxSize + 12;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      ticketIdLines.forEach((line) => {
        doc.text(`#${line}`, qrLeft + qrBoxSize / 2, qy, { align: 'center' });
        qy += 11;
      });
      qy += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...TEAL);
      doc.text('SCAN AT ENTRY', qrLeft + qrBoxSize / 2, qy, { align: 'center' });
      qy += 10;
      pill('Admits 1', qrLeft + qrBoxSize / 2 - 24, qy, GREEN_BG, GREEN_TXT);
    }

    y = cardTop + attendeeCardH + 24;

    // ---------- "Before you head out" — numbered terms (unchanged) ----------
    if (hasTerms) {
      ensureSpace(30 + termsBlockH);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      doc.text('BEFORE YOU HEAD OUT', marginX, y);
      y += 18;

      wrappedTerms.forEach((lines, idx) => {
        ensureSpace(lines.length * termLineHeight + 6);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(termFontSize);
        doc.setTextColor(...TEAL);
        doc.text(`${idx + 1}.`, marginX, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...MUTED);
        lines.forEach((line, i) => doc.text(line, marginX + termNumW, y + i * termLineHeight));
        y += lines.length * termLineHeight + 6;
      });
      y += 6;
    }

    // ---------- footer (unchanged) ----------
    ensureSpace(40);
    doc.setDrawColor(...CARD_BORDER);
    doc.setLineWidth(0.5);
    doc.line(marginX, y, pageW - marginX, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text(`TICKET #${attendee.ticketId}`, marginX, y);
    y += 11;
    doc.text(`GENERATED: ${new Date().toLocaleString('en-IN')}`, marginX, y);
    pill('Verified', pageW - marginX - 56, y - 20, GREEN_BG, GREEN_TXT);

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