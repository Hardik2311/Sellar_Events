import { jsPDF } from 'jspdf';
import { registerPdfFonts, PdfFont } from './pdfFonts';
import { round2 } from './platformFee';

export interface SettlementStatementInput {
  refNo: string;
  issuedDate: string;     // yyyy-mm-dd
  payableTo: string;
  eventTitle: string;
  eventDate: string;      // yyyy-mm-dd
  venue: string;
  soldOnOutsold: number;
  priceEach: number;      // ₹ per ticket sold on Outsold
  walkIns: number;
  gatewayFeePercent: number;
  gstOnFeePercent: number;
  payoutDueDate: string;  // yyyy-mm-dd
  contactInfo: string;
}

export interface SettlementCalculation {
  grossTicketSales: number;
  gatewayFee: number;
  gstOnGatewayFee: number;
  totalDeductions: number;
  netPayableBeforeRounding: number;
  amountDue: number;
  totalEntries: number;
}

export const calculateSettlement = (input: SettlementStatementInput): SettlementCalculation => {
  const grossTicketSales = round2(input.soldOnOutsold * input.priceEach);
  const gatewayFee = round2(grossTicketSales * (input.gatewayFeePercent / 100));
  const gstOnGatewayFee = round2(gatewayFee * (input.gstOnFeePercent / 100));
  const totalDeductions = round2(gatewayFee + gstOnGatewayFee);
  const netPayableBeforeRounding = round2(grossTicketSales - totalDeductions);
  return {
    grossTicketSales,
    gatewayFee,
    gstOnGatewayFee,
    totalDeductions,
    netPayableBeforeRounding,
    amountDue: Math.round(netPayableBeforeRounding),
    totalEntries: input.soldOnOutsold + input.walkIns,
  };
};

const fmtDateLong = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};
const fmtDateShort = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

interface LoadedImage {
  dataUrl: string;
  width: number;
  height: number;
}

// Same two brand assets the ticket PDF uses (see loadLogo() in ticketPdf.ts) —
// fetched once and reused for every statement download this session.
const imageCache = new Map<string, Promise<LoadedImage | null>>();
const loadImage = (url: string): Promise<LoadedImage | null> => {
  if (!imageCache.has(url)) {
    imageCache.set(
      url,
      fetch(encodeURI(url))
        .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`${url} ${res.status}`))))
        .then(
          (blob) =>
            new Promise<LoadedImage | null>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result as string;
                const img = new Image();
                img.onload = () => resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight });
                img.onerror = () => resolve(null);
                img.src = dataUrl;
              };
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(blob);
            })
        )
        .catch((err) => {
          console.error('Failed to load settlement PDF logo:', err);
          return null;
        })
    );
  }
  return imageCache.get(url)!;
};

// Recreation of the brand's "Settlement statement" design — a cream page
// with a white card, the Outsold ticket logo, stat boxes, a calculation
// list, and a black "amount due" bar with a yellow pill. Built with raw
// jsPDF primitives (not autoTable) since the layout isn't row/column data.
export const downloadPayoutSettlementPdf = async (input: SettlementStatementInput): Promise<void> => {
  const calc = calculateSettlement(input);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const [branded, outsoldLogo, ticketsBadge] = await Promise.all([
    registerPdfFonts(doc),
    loadImage('/Outsold.png'),
    loadImage('/OUTSOLD Logo PNG.png'),
  ]);
  const rupee = branded ? '₹' : 'Rs. ';

  const INK: [number, number, number] = [17, 17, 17];
  const MUTED: [number, number, number] = [107, 114, 128];
  const TEAL: [number, number, number] = [0, 122, 120];
  const YELLOW: [number, number, number] = [245, 196, 36];
  const BORDER: [number, number, number] = [226, 221, 209];
  const CARD_TINT: [number, number, number] = [253, 247, 231];
  const PAGE_BG: [number, number, number] = [243, 239, 231];

  const money = (n: number) => `${rupee}${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const moneyWhole = (n: number) => `${rupee}${Math.round(n).toLocaleString('en-IN')}`;

  const FONT = {
    display: branded ? PdfFont.Display : 'helvetica',
    body: branded ? PdfFont.Body : 'helvetica',
    semibold: branded ? PdfFont.BodySemiBold : 'helvetica',
    bold: branded ? PdfFont.BodyBold : 'helvetica',
  };
  const setFont = (weight: keyof typeof FONT, size: number, color: [number, number, number] = INK) => {
    doc.setFont(FONT[weight], branded ? 'normal' : (weight === 'body' ? 'normal' : 'bold'));
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const dashedLine = (x1: number, y1: number, x2: number, y2: number) => {
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(x1, y1, x2, y2);
    doc.setLineDashPattern([], 0);
  };
  const addImageFit = (img: LoadedImage, x: number, y: number, maxW: number, maxH: number, align: 'left' | 'right' = 'left') => {
    const aspect = img.width / img.height;
    let w = maxW;
    let h = w / aspect;
    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }
    const drawX = align === 'right' ? x - w : x;
    doc.addImage(img.dataUrl, 'PNG', drawX, y, w, h);
    return { w, h };
  };

  // ── Page: cream background + white card with ticket-stub notches ──────
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  doc.setFillColor(...PAGE_BG);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  const CARD_X = 8;
  const CARD_Y = 8;
  const CARD_W = PAGE_W - CARD_X * 2;
  const CARD_H = PAGE_H - CARD_Y * 2;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 4, 4, 'F');
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 4, 4, 'S');
  // Ticket-stub notches at the card's vertical middle
  doc.setFillColor(...PAGE_BG);
  doc.circle(CARD_X, CARD_Y + CARD_H / 2, 3, 'F');
  doc.circle(CARD_X + CARD_W, CARD_Y + CARD_H / 2, 3, 'F');

  const MARGIN = CARD_X + 12;
  const RIGHT = CARD_X + CARD_W - 12;
  const CONTENT_W = RIGHT - MARGIN;

  // ── Header: logo + title block ─────────────────────────────────────────
  let logoBottom = 30;
  if (outsoldLogo) {
    const { h } = addImageFit(outsoldLogo, MARGIN, 16, 26, 18);
    logoBottom = 16 + h;
  } else {
    doc.setFillColor(...YELLOW);
    doc.roundedRect(MARGIN, 16, 24, 16, 2, 2, 'F');
    setFont('bold', 11, INK);
    doc.text('OUT', MARGIN + 12, 23.5, { align: 'center' });
    setFont('bold', 11, TEAL);
    doc.text('SOLD', MARGIN + 12, 29, { align: 'center' });
    logoBottom = 32;
  }

  setFont('bold', 9, TEAL);
  doc.text('ORGANISER PAYOUT', RIGHT, 20, { align: 'right', charSpace: 0.5 });
  setFont('display', 20, INK);
  doc.text('SETTLEMENT STATEMENT', RIGHT, 27.5, { align: 'right' });
  setFont('body', 9, MUTED);
  doc.text(`Ref. no. ${input.refNo || '—'}    Issued ${fmtDateShort(input.issuedDate)}`, RIGHT, 33.5, { align: 'right' });

  let y = Math.max(logoBottom, 38) + 4;
  dashedLine(MARGIN, y, RIGHT, y);
  y += 10;

  // ── Payable to / event / date / venue ─────────────────────────────────
  const infoCols = [
    { label: 'PAYABLE TO', value: input.payableTo || '—' },
    { label: 'EVENT', value: input.eventTitle || '—' },
    { label: 'EVENT DATE', value: fmtDateLong(input.eventDate) },
    { label: 'VENUE', value: input.venue || '—' },
  ];
  const colW = CONTENT_W / infoCols.length;
  let maxInfoLines = 1;
  infoCols.forEach((c, i) => {
    const x = MARGIN + i * colW;
    setFont('semibold', 7, MUTED);
    doc.text(c.label, x, y, { charSpace: 0.4 });
    setFont('bold', 10, INK);
    const lines = doc.splitTextToSize(c.value, colW - 4);
    doc.text(lines, x, y + 5.5);
    maxInfoLines = Math.max(maxInfoLines, lines.length);
  });
  y += 16 + (maxInfoLines - 1) * 4.5;

  // ── Stat boxes: sold / walk-ins / total ───────────────────────────────
  const boxGap = 4;
  const boxW = (CONTENT_W - boxGap * 2) / 3;
  const boxH = 24;
  const stats = [
    { label: 'SOLD ON OUTSOLD', value: input.soldOnOutsold, caption: `Paid online at ${money(input.priceEach)} each`, tint: false },
    { label: 'WALK-INS', value: input.walkIns, caption: 'Collected at the venue', tint: false },
    { label: 'TOTAL ENTRIES', value: calc.totalEntries, caption: 'Online plus walk-ins', tint: true },
  ];
  stats.forEach((s, i) => {
    const x = MARGIN + i * (boxW + boxGap);
    if (s.tint) {
      doc.setFillColor(...CARD_TINT);
      doc.roundedRect(x, y, boxW, boxH, 1.5, 1.5, 'F');
    }
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, boxW, boxH, 1.5, 1.5, 'S');
    setFont('semibold', 6.5, MUTED);
    doc.text(s.label, x + 4, y + 6, { charSpace: 0.3 });
    setFont('display', 17, INK);
    doc.text(String(s.value), x + 4, y + 15);
    setFont('body', 7, MUTED);
    doc.text(doc.splitTextToSize(s.caption, boxW - 8), x + 4, y + 20);
  });
  y += boxH + 12;

  // ── Payout calculation ─────────────────────────────────────────────────
  setFont('display', 15, INK);
  doc.text('PAYOUT CALCULATION', MARGIN, y);
  y += 7;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, RIGHT, y);
  y += 2;

  const calcRow = (label: string, sub: string, amount: string, opts?: { bold?: boolean; thickRule?: boolean }) => {
    y += 7;
    setFont(opts?.bold ? 'bold' : 'semibold', 10, INK);
    doc.text(label, MARGIN, y);
    setFont(opts?.bold ? 'bold' : 'semibold', 10, INK);
    doc.text(amount, RIGHT, y, { align: 'right' });
    if (sub) {
      y += 4.5;
      setFont('body', 7.5, MUTED);
      doc.text(sub, MARGIN, y);
    }
    y += 3;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(opts?.thickRule ? 0.5 : 0.25);
    doc.line(MARGIN, y, RIGHT, y);
  };

  calcRow('Gross ticket sales', `${input.soldOnOutsold} × ${money(input.priceEach)} (tickets paid on Outsold)`, money(calc.grossTicketSales));
  calcRow('Payment gateway fee', `${input.gatewayFeePercent}% of ${money(calc.grossTicketSales)}`, `− ${money(calc.gatewayFee)}`);
  calcRow('GST on gateway fee', `${input.gstOnFeePercent}% of ${money(calc.gatewayFee)}`, `− ${money(calc.gstOnGatewayFee)}`);
  calcRow('Total deductions', '', `− ${money(calc.totalDeductions)}`, { bold: true, thickRule: true });
  y += 7;
  setFont('bold', 11, INK);
  doc.text('Net payable (before rounding)', MARGIN, y);
  doc.text(money(calc.netPayableBeforeRounding), RIGHT, y, { align: 'right' });
  y += 10;

  // ── Amount due bar ──────────────────────────────────────────────────────
  const barH = 20;
  doc.setFillColor(...INK);
  doc.roundedRect(MARGIN, y, CONTENT_W, barH, 2, 2, 'F');
  setFont('bold', 8.5, TEAL);
  doc.text('AMOUNT DUE TO ORGANISER', MARGIN + 6, y + 8, { charSpace: 0.3 });
  setFont('body', 8, [229, 231, 235]);
  doc.text('Rounded to the nearest rupee', MARGIN + 6, y + 14);

  const pillW = 52;
  const pillH = 12;
  const pillX = RIGHT - pillW - 6;
  const pillY = y + (barH - pillH) / 2;
  doc.setFillColor(...YELLOW);
  doc.roundedRect(pillX, pillY, pillW, pillH, 2, 2, 'F');
  setFont('display', 16, INK);
  doc.text(moneyWhole(calc.amountDue), pillX + pillW / 2, pillY + pillH / 2 + 3, { align: 'center' });

  y += barH + 10;

  // ── Footer notes ────────────────────────────────────────────────────────
  setFont('body', 8.5, MUTED);
  if (input.walkIns > 0) {
    doc.text(
      `The ${input.walkIns} walk-in ${input.walkIns === 1 ? 'entry was' : 'entries were'} handled at the venue and ${input.walkIns === 1 ? 'is' : 'are'} not part of this settlement.`,
      MARGIN,
      y
    );
    y += 6;
  }
  doc.text(`Payout by SELLAR Solutions before ${fmtDateLong(input.payoutDueDate)}.`, MARGIN, y);
  y += 8;

  dashedLine(MARGIN, y, RIGHT, y);
  y += 8;

  setFont('bold', 9, INK);
  doc.text('Outsold, a product by sellar.in', MARGIN, y - 2);
  setFont('body', 8, MUTED);
  doc.text(`Questions about this statement: ${input.contactInfo || '—'}`, MARGIN, y + 3);

  if (ticketsBadge) {
    addImageFit(ticketsBadge, RIGHT, y - 8, 42, 14, 'right');
  } else {
    const badgeW = 40;
    const badgeH = 12;
    doc.setFillColor(...YELLOW);
    doc.roundedRect(RIGHT - badgeW, y - 7, badgeW, badgeH, 2, 2, 'F');
    setFont('bold', 7, INK);
    doc.text('Tickets Available on', RIGHT - badgeW / 2, y - 2.5, { align: 'center' });
    setFont('bold', 9, INK);
    doc.text('OUTSOLD', RIGHT - badgeW / 2, y + 2, { align: 'center' });
  }

  const safeRef = (input.refNo || 'Statement').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Settlement_${safeRef}.pdf`);
};
