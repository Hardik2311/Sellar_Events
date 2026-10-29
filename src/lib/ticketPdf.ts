import { jsPDF, GState } from 'jspdf';
import QRCode from 'qrcode';
import { loadImageAsPosterHero } from './imageBanner';
import { PDF_FONT_METRICS, PdfFont, registerPdfFonts, type PdfFontName } from './pdfFonts';
import {
  MONTHS,
  WEEKDAYS,
  buildCalendarUrl,
  buildDirectionsUrl,
  formatAmount,
  formatClock,
  formatFullDate,
  htmlToPlainLines,
  maskEmail,
  maskPhone,
  parseIsoDate,
  type RGB,
} from './ticketFormat';

// Ticket PDF, built to the "PDF ticket, A4" artboard of the Outsold e-ticket
// design. Every layout number below is a design px (794 x 1123 = A4 at 96dpi);
// the Pen helper converts to PDF points (x 0.75) at draw time, so the numbers
// can be compared 1:1 with the design.

export interface AcknowledgementTicketData {
  ticketId: string;
  tierName: string;
  admits?: number;      // group pass: one QR admits this many people
  attendeeName: string;
  attendeeEmail?: string;
  attendeePhone?: string;
  amountPaid?: number;
  paymentMode?: string;
  purchasedAt?: number; // ms epoch
  createdAt?: number;   // ms epoch — fallback when purchasedAt is missing
  isCancelled?: boolean;
  isComplimentary?: boolean; // special-guest invite: show "Complimentary invite" instead of the amount
}

export interface AcknowledgementEventData {
  eventTitle?: string;
  eventCategory?: string;
  eventDate?: string;
  eventTime?: string;
  eventVenue?: string;
  eventBannerDataUrl?: string | null; // pre-composited hero from loadTicketPdfHero()
  eventConsentText?: string;
  eventGoodToKnowText?: string;     // organizer's "before the event" notes
  eventIsOnline?: boolean;          // hides "Directions"
  eventIsPrivate?: boolean;         // hides "Book more tickets"
  eventArriveBy?: string | null;
  eventAgeLimit?: string | null;
  eventHelplineNumber?: string | null;
  bookMoreTicketsUrl?: string | null;
}

// ── Design tokens (Outsold storefront) ──
const INK: RGB = [20, 18, 15];
const WHITE: RGB = [255, 255, 255];
const LINE: RGB = [214, 210, 200];
const MUTED: RGB = [98, 95, 90];
const TEAL: RGB = [0, 122, 120];
const YELLOW: RGB = [245, 197, 24];
const SOFT_YELLOW: RGB = [255, 247, 207];
const RED: RGB = [180, 35, 24];
const CUT_LINE: RGB = [138, 136, 130];

// ── Page geometry (design px) ──
const PAGE_W = 794;
const PAGE_H = 1123;
const PAD = 48;
const CONTENT_W = PAGE_W - PAD * 2;   // 698
const GAP = 20;
const FOOTER_H = 1 + 16 + 16;         // border + padding-top + one 16px line
const CONTENT_BOTTOM = PAGE_H - PAD - FOOTER_H - GAP;

const HERO_H = 210;
const POSTER_H = 186;
const DATE_BOX_W = 80;
const CUT_BAND_W = 60;     // ink "ADMIT ONE" band on the ticket's left edge
const CUT_QR_COL_W = 236;
const QR_SIZE = 184;

const PX = 0.75; // design px -> PDF pt

/**
 * Pre-fetches the event poster and composites the PDF hero (blurred backdrop +
 * centred poster). Call it ahead of time (e.g. on event load) and pass the
 * result as `eventBannerDataUrl`, so building the PDF needs no network.
 */
export const loadTicketPdfHero = (url: string) => loadImageAsPosterHero(url, CONTENT_W, HERO_H, POSTER_H);

// ── Drawing helper: all inputs in design px ──
const HELVETICA_METRICS = { ascent: 0.77, descent: 0.23 };

class Pen {
  private fontName: PdfFontName = PdfFont.Body;
  private sizePx = 14;
  readonly doc: jsPDF;
  private readonly branded: boolean;

  constructor(doc: jsPDF, branded: boolean) {
    this.doc = doc;
    this.branded = branded;
  }

  font(name: PdfFontName, sizePx: number) {
    this.fontName = name;
    this.sizePx = sizePx;
    if (this.branded) {
      this.doc.setFont(name, 'normal');
    } else if (name === PdfFont.Mono) {
      this.doc.setFont('courier', 'bold');
    } else {
      this.doc.setFont('helvetica', name === PdfFont.Body ? 'normal' : 'bold');
    }
    this.doc.setFontSize(sizePx * PX);
    return this;
  }

  color(c: RGB) {
    this.doc.setTextColor(...c);
    return this;
  }

  /** Rendered width in px, including letter-spacing between characters. */
  width(text: string, letterSpacing = 0) {
    return this.doc.getTextWidth(text) / PX + letterSpacing * Math.max(0, text.length - 1);
  }

  /**
   * Draws one line whose CSS line box starts at `top` with height `lineHeight`
   * — the baseline is placed exactly where a browser would put it.
   */
  text(
    str: string,
    x: number,
    top: number,
    lineHeight: number,
    opts: { align?: 'left' | 'center' | 'right'; letterSpacing?: number; link?: string } = {}
  ) {
    const m = this.branded ? PDF_FONT_METRICS[this.fontName] : HELVETICA_METRICS;
    const fs = this.sizePx;
    const baseline = top + (lineHeight - (m.ascent + m.descent) * fs) / 2 + m.ascent * fs;
    const ls = opts.letterSpacing ?? 0;
    const w = this.width(str, ls);
    const left = opts.align === 'right' ? x - w : opts.align === 'center' ? x - w / 2 : x;
    this.doc.text(str, left * PX, baseline * PX, ls ? { charSpace: ls * PX } : undefined);
    if (opts.link) this.doc.link(left * PX, top * PX, w * PX, lineHeight * PX, { url: opts.link });
    return w;
  }

  /** Word-wraps to `maxWidth`; with `maxLines`, the last kept line ends in an ellipsis. */
  wrap(str: string, maxWidth: number, maxLines = Infinity, letterSpacing = 0): string[] {
    const lines: string[] = [];
    // splitTextToSize ignores letter-spacing, so reserve room for it up front.
    const approxChars = maxWidth / (this.sizePx * 0.45);
    const wrapWidth = maxWidth - letterSpacing * approxChars;
    str.split('\n').forEach((para) => {
      const wrapped = this.doc.splitTextToSize(para || ' ', wrapWidth * PX) as string[];
      lines.push(...wrapped);
    });
    if (lines.length <= maxLines) return lines;
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && this.width(`${last}…`, letterSpacing) > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }

  /** Shrinks the font from `maxSize` down to `minSize` until `str` fits in `maxLines`. */
  fit(name: PdfFontName, str: string, maxWidth: number, maxLines: number, maxSize: number, minSize: number, letterSpacing = 0) {
    for (let size = maxSize; size >= minSize; size -= 2) {
      this.font(name, size);
      const lines = this.wrap(str, maxWidth, Infinity, letterSpacing);
      if (lines.length <= maxLines) return { size, lines };
    }
    this.font(name, minSize);
    return { size: minSize, lines: this.wrap(str, maxWidth, maxLines, letterSpacing) };
  }

  rect(x: number, y: number, w: number, h: number, fill: RGB) {
    this.doc.setFillColor(...fill);
    this.doc.rect(x * PX, y * PX, w * PX, h * PX, 'F');
  }

  roundRect(x: number, y: number, w: number, h: number, r: number, fill?: RGB, stroke?: RGB, strokeW = 1) {
    if (fill) this.doc.setFillColor(...fill);
    if (stroke) {
      this.doc.setDrawColor(...stroke);
      this.doc.setLineWidth(strokeW * PX);
    }
    const style = fill && stroke ? 'FD' : fill ? 'F' : 'S';
    this.doc.roundedRect(x * PX, y * PX, w * PX, h * PX, r * PX, r * PX, style);
  }

  line(x1: number, y1: number, x2: number, y2: number, color: RGB, w = 1, dash?: number[]) {
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(w * PX);
    if (dash) this.doc.setLineDashPattern(dash.map((d) => d * PX), 0);
    this.doc.line(x1 * PX, y1 * PX, x2 * PX, y2 * PX);
    if (dash) this.doc.setLineDashPattern([], 0);
  }

  /** Horizontal rule drawn as a filled box so 1px lines stay crisp and exact. */
  hr(x: number, y: number, w: number, color: RGB = LINE) {
    this.rect(x, y, w, 1, color);
  }

  circle(cx: number, cy: number, r: number, fill?: RGB, stroke?: RGB, strokeW = 1) {
    if (fill) this.doc.setFillColor(...fill);
    if (stroke) {
      this.doc.setDrawColor(...stroke);
      this.doc.setLineWidth(strokeW * PX);
    }
    this.doc.circle(cx * PX, cy * PX, r * PX, fill && stroke ? 'FD' : fill ? 'F' : 'S');
  }

  /** One line rotated to read bottom-to-top, centred on (cx, cy) — like CSS vertical-rl + rotate(180deg). */
  textUp(str: string, cx: number, cy: number, letterSpacing = 0) {
    // Anton's cap height is 1760/2048 em; Helvetica's about 0.72.
    const cap = (this.branded && this.fontName === PdfFont.Display ? 1760 / 2048 : 0.72) * this.sizePx;
    const w = this.width(str, letterSpacing);
    this.doc.text(str, (cx + cap / 2) * PX, (cy + w / 2) * PX, {
      angle: 90,
      ...(letterSpacing ? { charSpace: letterSpacing * PX } : {}),
    });
  }

  /** Lucide "scissors" icon, `size` px square with its top-left at (x, y). */
  scissors(x: number, y: number, size: number, color: RGB) {
    const s = size / 24;
    const p = (v: number) => v * s * PX;
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(1.75 * s * PX);
    this.doc.setLineCap('round');
    this.doc.circle(x * PX + p(6), y * PX + p(6), p(3), 'S');
    this.doc.circle(x * PX + p(6), y * PX + p(18), p(3), 'S');
    const seg = (x1: number, y1: number, x2: number, y2: number) =>
      this.doc.line(x * PX + p(x1), y * PX + p(y1), x * PX + p(x2), y * PX + p(y2));
    seg(8.12, 8.12, 12, 12);
    seg(20, 4, 8.12, 15.88);
    seg(14.8, 14.8, 20, 20);
    this.doc.setLineCap('butt');
  }

  /** Stroke icon from a 24-unit grid (lucide-style polyline points). */
  icon(points: [number, number][][], x: number, y: number, size: number, color: RGB, strokeW: number) {
    const s = size / 24;
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(strokeW * s * PX);
    this.doc.setLineCap('round');
    this.doc.setLineJoin('round');
    points.forEach((poly) => {
      const [start, ...rest] = poly;
      let [px, py] = start;
      const deltas = rest.map(([nx, ny]) => {
        const d = [(nx - px) * s * PX, (ny - py) * s * PX];
        px = nx;
        py = ny;
        return d;
      });
      this.doc.lines(deltas, (x + start[0] * s) * PX, (y + start[1] * s) * PX, [1, 1], 'S', false);
    });
    this.doc.setLineCap('butt');
    this.doc.setLineJoin('miter');
  }
}

const CHECK_ICON: [number, number][][] = [[[20, 6], [9, 17], [4, 12]]];
const X_ICON: [number, number][][] = [[[18, 6], [6, 18]], [[6, 6], [18, 18]]];

// ── Outsold logo: fetched once, trimmed of its padding, downscaled ──
let logoPromise: Promise<{ dataUrl: string; aspect: number } | null> | null = null;
const loadLogo = () => {
  if (!logoPromise) {
    logoPromise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const sw = 600;
          const sh = Math.round((img.height / img.width) * sw);
          const scan = document.createElement('canvas');
          scan.width = sw;
          scan.height = sh;
          const sctx = scan.getContext('2d');
          if (!sctx) { resolve(null); return; }
          sctx.drawImage(img, 0, 0, sw, sh);
          const { data } = sctx.getImageData(0, 0, sw, sh);
          let minX = sw, minY = sh, maxX = -1, maxY = -1;
          for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
              const i = (y * sw + x) * 4;
              const blank = data[i + 3] < 16 || (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240);
              if (blank) continue;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
          if (maxX < 0) { resolve(null); return; }
          const cw = maxX - minX + 1;
          const ch = maxY - minY + 1;
          const outW = 720; // ~300dpi at the 180px print width
          const outH = Math.round((ch / cw) * outW);
          const out = document.createElement('canvas');
          out.width = outW;
          out.height = outH;
          const octx = out.getContext('2d');
          if (!octx) { resolve(null); return; }
          // Flattened onto the page's white and saved as JPEG: the logo's grain
          // texture makes a PNG ~4x bigger with no visible difference.
          octx.fillStyle = '#ffffff';
          octx.fillRect(0, 0, outW, outH);
          octx.imageSmoothingQuality = 'high';
          octx.drawImage(img, (minX / sw) * img.width, (minY / sh) * img.height, (cw / sw) * img.width, (ch / sh) * img.height, 0, 0, outW, outH);
          resolve({ dataUrl: out.toDataURL('image/jpeg', 0.9), aspect: outH / outW });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => { logoPromise = null; resolve(null); };
      img.src = encodeURI('/OUTSOLD Logo PNG.png'); // "Tickets Available on OUTSOLD" ticket
    });
  }
  return logoPromise;
};

// ── QR as vector modules (crisp in print, independent of any canvas) ──
const drawQr = (pen: Pen, value: string, x: number, y: number, size: number, fallback: HTMLCanvasElement | null) => {
  try {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const quiet = 2;
    const n = modules.size;
    const cell = size / (n + quiet * 2);
    // Every dark run joins one path and is filled once — filling rects one by
    // one leaves anti-aliased hairline seams between touching modules.
    pen.doc.setFillColor(...INK);
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        if (!modules.get(r, c)) { c++; continue; }
        const start = c;
        while (c < n && modules.get(r, c)) c++;
        pen.doc.rect(
          (x + (quiet + start) * cell) * PX,
          (y + (quiet + r) * cell) * PX,
          (c - start) * cell * PX,
          cell * PX,
          null
        );
      }
    }
    pen.doc.fill();
  } catch {
    if (fallback) pen.doc.addImage(fallback.toDataURL('image/png'), 'PNG', x * PX, y * PX, size * PX, size * PX);
  }
};

export const buildAcknowledgementPdf = async (
  ticket: AcknowledgementTicketData,
  event: AcknowledgementEventData,
  qrCanvas: HTMLCanvasElement | null
): Promise<jsPDF> => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const [branded, logo] = await Promise.all([registerPdfFonts(doc), loadLogo()]);
  const pen = new Pen(doc, branded);
  // Helvetica can't draw ₹; the brand fonts can.
  const txt = (v?: string | null) => (v ? toPdfText(v, branded) : '');
  const rupee = branded ? '₹' : 'Rs. ';

  const hasPoster = !!event.eventBannerDataUrl;

  // ── Data ──
  const title = (event.eventTitle ? txt(htmlToPlainLines(event.eventTitle).replace(/\n/g, ' ')) : '') || 'Event';
  const category = txt(event.eventCategory);
  const showCategory = !!category && category.toLowerCase() !== 'other';
  const subtitle = [showCategory ? category : '', event.eventIsOnline ? 'Online' : ''].filter(Boolean).join(' · ');
  const venue = event.eventIsOnline ? 'Online' : txt(event.eventVenue) || 'TBA';
  const dateObj = parseIsoDate(event.eventDate);
  const startTime = formatClock(txt(event.eventTime));
  const gatesTime = formatClock(txt(event.eventArriveBy));
  const timeFact = gatesTime ? { label: 'Gates open', value: gatesTime } : startTime ? { label: 'Starts', value: startTime } : null;
  const admits = Math.max(1, ticket.admits ?? 1);
  const isCancelled = !!ticket.isCancelled;
  const ticketId = txt(ticket.ticketId);
  const holder = txt(ticket.attendeeName) || 'Guest';
  const tierName = txt(ticket.tierName) || 'General';
  const email = txt(ticket.attendeeEmail);
  const phone = txt(ticket.attendeePhone);
  const contact = email ? maskEmail(email) : phone ? maskPhone(phone) : '—';
  const bookedMs = ticket.purchasedAt ?? ticket.createdAt;
  const bookedOn = bookedMs ? formatFullDate(new Date(bookedMs)) : '—';
  const paymentMode = txt(ticket.paymentMode);
  const goodToKnow = event.eventGoodToKnowText ? txt(htmlToPlainLines(event.eventGoodToKnowText)) : '';
  const consent = event.eventConsentText ? txt(htmlToPlainLines(event.eventConsentText)) : '';
  const helpline = txt(event.eventHelplineNumber);
  const ageLimit = txt(event.eventAgeLimit);

  const directionsUrl = event.eventVenue && !event.eventIsOnline
    ? buildDirectionsUrl(event.eventVenue)
    : null;
  const calendarUrl = dateObj ? buildCalendarUrl(title, dateObj, event.eventTime, event.eventIsOnline ? 'Online' : event.eventVenue || '') : null;
  const bookMoreUrl = event.bookMoreTicketsUrl && !event.eventIsPrivate ? event.bookMoreTicketsUrl : null;

  let y = PAD;

  // ── Pagination ──
  const ensureSpace = (needed: number) => {
    if (y + needed <= CONTENT_BOTTOM) return;
    doc.addPage('a4');
    y = PAD;
    pen.font(PdfFont.Mono, 11).color(MUTED).text(`E-TICKET · ${ticketId} · CONTINUED`, PAD, y, 14, { letterSpacing: 0.88 });
    y += 14 + GAP;
  };

  const heading = (text: string, x: number, top: number, size = 22, lineHeight = 26) =>
    pen.font(PdfFont.Display, size).color(INK).text(text.toUpperCase(), x, top, lineHeight, { letterSpacing: size * 0.01 });

  // ── Hero: poster on its blurred backdrop, or the yellow pattern ──
  {
    doc.saveGraphicsState();
    doc.roundedRect(PAD * PX, y * PX, CONTENT_W * PX, HERO_H * PX, 12 * PX, 12 * PX, null);
    doc.clip();
    doc.discardPath();
    if (hasPoster) {
      try {
        doc.addImage(event.eventBannerDataUrl!, 'JPEG', PAD * PX, y * PX, CONTENT_W * PX, HERO_H * PX);
      } catch {
        pen.rect(PAD, y, CONTENT_W, HERO_H, INK);
      }
    } else {
      pen.rect(PAD, y, CONTENT_W, HERO_H, YELLOW);
      pen.circle(PAD + 40 + 75, y + 30 + 75, 73.5, undefined, INK, 3);
      pen.circle(PAD + 150 + 48, y + 86 + 48, 48, TEAL);
      pen.circle(PAD + CONTENT_W + 60 - 110, y + HERO_H + 60 - 110, 110, INK);
    }
    doc.restoreGraphicsState();
    y += HERO_H + GAP;
  }

  // ── Title row: date block, title + subtitle, Outsold logo ──
  {
    const logoW = 180; // wide ticket logo; narrower and its tagline is unreadable
    const logoH = logo ? logoW * logo.aspect : 28;
    const titleX = PAD + DATE_BOX_W + 16;
    const titleW = CONTENT_W - DATE_BOX_W - 16 - 24 - logoW;
    const titleFit = pen.fit(PdfFont.Display, title.toUpperCase(), titleW, 2, 52, 34, 0.52);
    const subtitleLines = subtitle ? pen.font(PdfFont.BodyBold, 17).wrap(subtitle, titleW, 1) : [];
    const titleBlockH = titleFit.lines.length * titleFit.size + (subtitleLines.length ? 4 + 22 : 0);
    const dateH = Math.max(84, titleBlockH);
    const rowH = Math.max(dateH, logoH);
    const bottom = y + rowH;

    // Date block
    const dTop = bottom - dateH;
    pen.roundRect(PAD, dTop, DATE_BOX_W, dateH, 8, YELLOW);
    const dcx = PAD + DATE_BOX_W / 2;
    const dContent = dTop + (dateH - 74) / 2;
    pen.font(PdfFont.Mono, 11).color(INK).text(dateObj ? WEEKDAYS[dateObj.getDay()].toUpperCase() : 'DATE', dcx, dContent, 14, { align: 'center', letterSpacing: 0.88 });
    pen.font(PdfFont.Display, 40).text(dateObj ? String(dateObj.getDate()) : '--', dcx, dContent + 14, 42, { align: 'center' });
    pen.font(PdfFont.Display, 16).text(dateObj ? MONTHS[dateObj.getMonth()].toUpperCase() : 'TBA', dcx, dContent + 56, 18, { align: 'center', letterSpacing: 0.64 });

    // Title + subtitle, bottom-aligned with the date block
    let ty = bottom - titleBlockH;
    pen.font(PdfFont.Display, titleFit.size).color(INK);
    titleFit.lines.forEach((l) => {
      pen.text(l, titleX, ty, titleFit.size, { letterSpacing: 0.52 });
      ty += titleFit.size;
    });
    if (subtitleLines.length) pen.font(PdfFont.BodyBold, 17).color(TEAL).text(subtitleLines[0], titleX, ty + 4, 22);

    // Logo
    if (logo) {
      doc.addImage(logo.dataUrl, 'JPEG', (PAD + CONTENT_W - logoW) * PX, (bottom - logoH) * PX, logoW * PX, logoH * PX);
    } else {
      pen.font(PdfFont.Display, 24).color(INK).text('OUTSOLD', PAD + CONTENT_W, bottom - 28, 28, { align: 'right' });
    }
    y = bottom + GAP;
  }

  // ── Print-and-cut ticket ──
  {
    const outerX = PAD;
    const outerW = CONTENT_W;
    const innerX = outerX + 2 + 10;          // dashed border + padding
    const innerW = outerW - 24;
    const midX = innerX + 2 + CUT_BAND_W;
    const qrColX = innerX + innerW - 2 - CUT_QR_COL_W;
    const divX = qrColX - 1;                 // centre of the 2px dashed divider
    const midW = divX - 1 - midX;
    const cX = midX + 24;
    const cW = midW - 48;
    const factColW = (cW - 20) / 2;

    const facts = [
      { label: 'Date', value: dateObj ? formatFullDate(dateObj) : 'TBA' },
      ...(timeFact ? [timeFact] : []),
      { label: 'Venue', value: venue },
      { label: 'Ticket holder', value: holder },
    ];
    pen.font(PdfFont.BodyBold, 18);
    const factLines = facts.map((f) => pen.wrap(f.value, factColW, 2));
    const factRows: number[] = [];
    for (let i = 0; i < facts.length; i += 2) {
      factRows.push(14 + 4 + Math.max(factLines[i].length, factLines[i + 1]?.length ?? 0) * 22);
    }
    const factsH = factRows.reduce((s, h) => s + h, 0) + 16 * (factRows.length - 1);
    const midH = 22 + 30 + 16 + factsH + 22;

    const idLines = pen.font(PdfFont.Mono, 11).wrap(ticketId, CUT_QR_COL_W - 40, 2, 0.88);
    const qrColH = 18 + QR_SIZE + 8 + idLines.length * 14 + 18;

    const contentH = Math.max(midH, qrColH);
    const innerH = contentH + 4;
    const outerH = innerH + 24;
    ensureSpace(outerH + 8 + 16);
    const oy = y;
    const iy = oy + 12;

    // Outer cut line + scissors
    doc.setLineDashPattern([6 * PX, 4 * PX], 0);
    pen.roundRect(outerX + 1, oy + 1, outerW - 2, outerH - 2, 15, undefined, CUT_LINE, 2);
    doc.setLineDashPattern([], 0);
    pen.rect(outerX + 28, oy - 11, 28, 22, WHITE);
    pen.scissors(outerX + 32, oy - 9, 20, MUTED);

    // Ticket card with the ink "ADMIT" band
    pen.roundRect(innerX + 1, iy + 1, innerW - 2, innerH - 2, 9, WHITE, INK, 2);
    doc.saveGraphicsState();
    doc.roundedRect((innerX + 2) * PX, (iy + 2) * PX, (innerW - 4) * PX, (innerH - 4) * PX, 8 * PX, 8 * PX, null);
    doc.clip();
    doc.discardPath();
    pen.rect(innerX + 2, iy + 2, CUT_BAND_W, innerH - 4, INK);
    doc.restoreGraphicsState();
    const admitLabel = admits > 1 ? `ADMITS ${admits}` : 'ADMIT ONE';
    pen.font(PdfFont.Display, 22).color(YELLOW).textUp(admitLabel, innerX + 2 + CUT_BAND_W / 2, iy + innerH / 2, 2.64);

    // Middle: tier + status, then the facts grid
    let my = iy + 2 + (contentH - midH) / 2 + 22;
    const tierFit = pen.fit(PdfFont.Display, tierName.toUpperCase(), cW - 28 - 120, 1, 15, 11, 0.75);
    pen.font(PdfFont.Display, tierFit.size);
    const pillW = pen.width(tierFit.lines[0], 0.75) + 28;
    pen.roundRect(cX, my, pillW, 30, 15, YELLOW);
    pen.color(INK).text(tierFit.lines[0], cX + 14, my, 30, { letterSpacing: 0.75 });
    const statusColor = isCancelled ? RED : TEAL;
    const sx = cX + pillW + 12;
    pen.icon(isCancelled ? X_ICON : CHECK_ICON, sx, my + 7, 16, statusColor, 2.25);
    pen.font(PdfFont.BodyBold, 14).color(statusColor).text(isCancelled ? 'Cancelled' : 'Confirmed', sx + 22, my + 5, 20);
    my += 30 + 16;
    for (let r = 0; r < factRows.length; r++) {
      [0, 1].forEach((c) => {
        const i = r * 2 + c;
        if (!facts[i]) return;
        const fx = cX + c * (factColW + 20);
        pen.font(PdfFont.Mono, 11).color(MUTED).text(facts[i].label.toUpperCase(), fx, my, 14, { letterSpacing: 0.88 });
        pen.font(PdfFont.BodyBold, 18).color(INK);
        factLines[i].forEach((l, j) => pen.text(l, fx, my + 18 + j * 22, 22));
      });
      my += factRows[r] + 16;
    }

    // Dashed divider
    pen.line(divX, iy + 2 + 16, divX, iy + innerH - 2 - 16, CUT_LINE, 2, [6, 4]);

    // QR column
    const qrCx = qrColX + CUT_QR_COL_W / 2;
    let qy = iy + 2 + (contentH - qrColH) / 2 + 18;
    drawQr(pen, ticketId, qrCx - QR_SIZE / 2, qy, QR_SIZE, qrCanvas);
    if (isCancelled) {
      doc.saveGraphicsState();
      doc.setGState(new GState({ opacity: 0.8 }));
      pen.rect(qrCx - QR_SIZE / 2, qy, QR_SIZE, QR_SIZE, WHITE);
      doc.restoreGraphicsState();
      pen.font(PdfFont.Display, 20);
      const stampW = pen.width('CANCELLED', 0.8) + 24;
      pen.roundRect(qrCx - stampW / 2, qy + QR_SIZE / 2 - 18, stampW, 36, 6, RED);
      pen.color(WHITE).text('CANCELLED', qrCx, qy + QR_SIZE / 2 - 18, 36, { align: 'center', letterSpacing: 0.8 });
    }
    qy += QR_SIZE + 8;
    pen.font(PdfFont.Mono, 11).color(INK);
    idLines.forEach((l) => {
      pen.text(l, qrCx, qy, 14, { align: 'center', letterSpacing: 0.88 });
      qy += 14;
    });

    y = oy + outerH + 8;
    pen.font(PdfFont.Body, 12).color(MUTED).text(
      'Print and cut along the dashed line, or show this page on your phone. Each QR code scans once.',
      PAD, y, 16
    );
    y += 16 + GAP;
  }

  // ── Booking / Getting there ──
  {
    // A fact shows plain text or a set of links ("Map · Calendar"); wide ones span both sub-columns.
    type Fact = { label: string; value: string; links?: { text: string; url: string }[]; wide?: boolean };
    const LINK_SEP = '  ·  ';
    const colW = (CONTENT_W - 24) / 2;
    const subW = (colW - 16) / 2;
    const quickLinks = [
      ...(directionsUrl ? [{ text: 'Map', url: directionsUrl }] : []),
      ...(calendarUrl ? [{ text: 'Calendar', url: calendarUrl }] : []),
      ...(bookMoreUrl ? [{ text: 'Book more', url: bookMoreUrl }] : []),
    ];
    const booking: Fact[] = [
      { label: 'Tickets', value: tierName.includes('×') ? tierName : `${admits} × ${tierName}` },
      {
        label: paymentMode ? `Paid via ${paymentMode}` : 'Amount paid',
        value: ticket.isComplimentary ? 'Complimentary invite' : formatAmount(ticket.amountPaid, rupee),
      },
      { label: 'Booked on', value: bookedOn },
      { label: 'Contact', value: contact },
    ];
    const gettingThere: Fact[] = [
      { label: 'Venue', value: venue, wide: !ageLimit },
      ...(ageLimit ? [{ label: 'Age limit', value: ageLimit }] : []),
      ...(quickLinks.length
        ? [{ label: 'Quick links', value: quickLinks.map((l) => l.text).join(LINK_SEP), links: quickLinks, wide: true }]
        : []),
    ];

    // Greedy 2-column layout: a wide fact (or a lone last one) takes the whole row.
    const layout = (facts: Fact[]) => {
      const rows: { items: (Fact & { lines: string[] })[]; h: number }[] = [];
      let i = 0;
      while (i < facts.length) {
        const pair = facts[i].wide || !facts[i + 1] || facts[i + 1].wide ? [facts[i]] : [facts[i], facts[i + 1]];
        const w = pair.length === 1 ? colW : subW;
        pen.font(PdfFont.BodySemiBold, 14);
        const items = pair.map((f) => ({ ...f, lines: f.links ? [f.value] : pen.wrap(f.value, w, 3) }));
        rows.push({ items, h: 14 + 2 + Math.max(...items.map((it) => it.lines.length)) * 20 });
        i += pair.length;
      }
      return rows;
    };
    const bookingRows = layout(booking);
    const gettingRows = layout(gettingThere);
    const colH = (rows: { h: number }[]) => 3 + 14 + 24 + 10 + rows.reduce((s, r) => s + r.h, 0) + 8 * (rows.length - 1);
    ensureSpace(Math.max(colH(bookingRows), colH(gettingRows)));

    const drawColumn = (title: string, rule: RGB, rows: ReturnType<typeof layout>, x: number) => {
      pen.rect(x, y, colW, 3, rule);
      heading(title, x, y + 3 + 14, 20, 24);
      let ry = y + 3 + 14 + 24 + 10;
      rows.forEach((row) => {
        row.items.forEach((it, c) => {
          const fx = x + c * (subW + 16);
          pen.font(PdfFont.Mono, 11).color(MUTED).text(it.label.toUpperCase(), fx, ry, 14, { letterSpacing: 0.88 });
          pen.font(PdfFont.BodySemiBold, 14);
          if (it.links) {
            let lx = fx;
            it.links.forEach((l, li) => {
              if (li > 0) lx += pen.color(MUTED).text(LINK_SEP, lx, ry + 16, 20);
              lx += pen.color(TEAL).text(l.text, lx, ry + 16, 20, { link: l.url });
            });
          } else {
            pen.color(INK);
            it.lines.forEach((l, j) => pen.text(l, fx, ry + 16 + j * 20, 20));
          }
        });
        ry += row.h + 8;
      });
      return ry - 8;
    };
    const end1 = drawColumn('Booking', INK, bookingRows, PAD);
    const end2 = drawColumn('Getting there', TEAL, gettingRows, PAD + colW + 24);
    y = Math.max(end1, end2) + GAP;
  }

  // Flowing paragraphs (used when text may run past a page)
  const flow = (title: string, text: string, size: number, lh: number, color: RGB) => {
    pen.font(PdfFont.Body, size);
    const paras = text.split(/\n+/).map((p) => p.trim()).filter(Boolean).map((p) => pen.wrap(p, CONTENT_W));
    if (!paras.length) return;
    ensureSpace(26 + 8 + lh * Math.min(2, paras[0].length));
    heading(title, PAD, y);
    y += 26 + 8;
    paras.forEach((lines, pi) => {
      lines.forEach((l) => {
        ensureSpace(lh);
        pen.font(PdfFont.Body, size).color(color).text(l, PAD, y, lh);
        y += lh;
      });
      if (pi < paras.length - 1) y += 6;
    });
    y += GAP;
  };

  // ── Before you go ──
  {
    const atGate = admits > 1
      ? `Show the QR code on this ticket, on your phone or printed. It admits all ${admits} people in your group, so arrive together. Each code scans once.`
      : "Show the QR code on this ticket, on your phone or printed. Each code scans once, so don't share it.";
    const innerW = CONTENT_W - 48;
    const colW = (innerW - 24) / 2;
    pen.font(PdfFont.Body, 15);
    let gateLines = pen.wrap(atGate, goodToKnow ? colW : innerW);
    let orgLines = goodToKnow ? pen.wrap(goodToKnow, colW) : [];
    // Long organiser notes get their own flowing section instead of a panel
    // that could outgrow the page.
    const orgInPanel = orgLines.length > 0 && orgLines.length <= 10;
    if (!orgInPanel) {
      gateLines = pen.wrap(atGate, innerW);
      orgLines = [];
    }
    const colBlock = (lines: string[]) => 14 + 6 + lines.length * 22;
    const panelH = 20 + 26 + 12 + Math.max(colBlock(gateLines), orgLines.length ? colBlock(orgLines) : 0) + 20;
    ensureSpace(panelH);
    pen.roundRect(PAD, y, CONTENT_W, panelH, 12, SOFT_YELLOW);
    heading('Before you go', PAD + 24, y + 20);
    const drawCol = (label: string, lines: string[], x: number) => {
      const top = y + 20 + 26 + 12;
      pen.font(PdfFont.Mono, 11).color(MUTED).text(label.toUpperCase(), x, top, 14, { letterSpacing: 0.88 });
      pen.font(PdfFont.Body, 15).color(INK);
      lines.forEach((l, i) => pen.text(l, x, top + 20 + i * 22, 22));
    };
    drawCol('At the gate', gateLines, PAD + 24);
    if (orgLines.length) drawCol('From the organiser', orgLines, PAD + 24 + colW + 24);
    y += panelH + GAP;
    if (goodToKnow && !orgInPanel) flow('From the organiser', goodToKnow, 15, 22, INK);
  }

  // ── Terms & conditions ──
  if (consent) flow('Terms & conditions', consent, 12, 18, MUTED);

  // ── Footer on every page ──
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const fTop = PAGE_H - PAD - FOOTER_H;
    pen.hr(PAD, fTop, CONTENT_W);
    const textTop = fTop + 1 + 16;
    pen.font(PdfFont.Body, 12).color(MUTED);
    const left = [helpline ? `Event questions: ${helpline}` : '', pages > 1 ? `Page ${p} of ${pages}` : '']
      .filter(Boolean)
      .join('  ·  ');
    if (left) pen.text(left, PAD, textTop, 16);
    pen.text('Ticketing by Outsold · A product by Sellar.in', PAD + CONTENT_W, textTop, 16, {
      align: 'right',
      link: 'https://app.outsold.in',
    });
  }
  doc.setPage(1);

  return doc;
};

// jsPDF's built-in Helvetica only covers WinAnsi (Windows-1252); the brand
// TTFs add ₹ on top of that. Anything else — emoji especially — would print
// as garbage ("👌" came out as "Ø=ÜL"), so keep what the font can draw and
// drop the rest. NFKC first so styled Unicode letters ("𝐇𝐞𝐲", full-width
// "ＡＢ") fold to plain ASCII instead of being dropped.
const WIN_ANSI_EXTRAS = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
function toPdfText(value: string, allowRupee: boolean): string {
  let s = value.normalize('NFKC');
  if (!allowRupee) s = s.replace(/₹\s*/g, 'Rs. ');
  return Array.from(s)
    .filter((ch) => {
      const cp = ch.codePointAt(0)!;
      return (
        ch === '\n' ||
        (cp >= 0x20 && cp <= 0x7e) ||
        (cp >= 0xa0 && cp <= 0xff) ||
        WIN_ANSI_EXTRAS.includes(ch) ||
        (allowRupee && ch === '₹')
      );
    })
    .join('')
    .replace(/[^\S\n]+/g, ' ') // any whitespace except newlines (incl. tab, nbsp)
    .replace(/ *\n */g, '\n')
    .trim();
}
