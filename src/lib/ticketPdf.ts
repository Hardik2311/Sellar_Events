import { jsPDF } from 'jspdf';

export interface BrandLogo {
  dataUrl: string;
  width: number;   // natural px width
  height: number;  // natural px height
}
export interface AcknowledgementTicketData {
  ticketId: string;
  tierName: string;
  tierTag?: string;
  attendeeName: string;
  attendeeEmail?: string;
  attendeePhone?: string;
  amountPaid?: number;
  paymentMode?: string;
  purchasedAt?: number; // ms epoch
  createdAt?: number;   // ms epoch — fallback when purchasedAt is missing
  isCancelled?: boolean;
}

export interface AcknowledgementEventData {
  eventTitle?: string;
  eventDate?: string;
  eventTime?: string;
  eventVenue?: string;
  eventBannerDataUrl?: string | null;
  eventConsentText?: string;
  eventGoodToKnowText?: string;     // NEW — organizer's "before the event" notes
  eventIsOnline?: boolean;          // NEW — hides "Get directions"
  eventIsPrivate?: boolean;         // NEW — hides "Book more tickets"
  eventArriveBy?: string | null;
  eventAgeLimit?: string | null;
  eventHelplineNumber?: string | null;
  bookMoreTicketsUrl?: string | null;
}

export const buildAcknowledgementPdf = async (
  ticket: AcknowledgementTicketData,
  event: AcknowledgementEventData,
  qrCanvas: HTMLCanvasElement | null
): Promise<jsPDF> => {
  const cleanEventTitle = event.eventTitle ? stripHtmlTagsLocal(event.eventTitle) : 'Event';
  const pageW = 360;
  const outerMargin = 20;
  const cardX = outerMargin;
  const cardW = pageW - outerMargin * 2;
  const bottomMargin = 30;
  const topMarginAfterBreak = 24;
  const hasBanner = !!event.eventBannerDataUrl;
  const hasQr = !!qrCanvas;
  const consentText = event.eventConsentText ? htmlToPlainLines(event.eventConsentText) : '';
  const goodToKnowText = event.eventGoodToKnowText ? stripHtmlTagsLocal(event.eventGoodToKnowText).trim() : '';

  const PAGE_BG: [number, number, number] = [222, 234, 232];   // tinted, isi se notch/cut dikhega
  const CARD_BG: [number, number, number] = [255, 255, 255];   // neeche wale white boxes
  const STUB_BG: [number, number, number] = [240, 247, 246];   // NEW: stub ka inner panel
  const CARD_BORDER: [number, number, number] = [226, 232, 240];
  const INK: [number, number, number] = [11, 59, 58];

  // Story-style theming: pull TEAL/DARK_GREEN from the banner itself when present,
  // otherwise keep the original fixed brand colors.
  const { primary: TEAL, dark: DARK_GREEN } = hasBanner
    ? await extractPaletteFromImage(event.eventBannerDataUrl!)
    : { primary: DEFAULT_TEAL, dark: DEFAULT_DARK_GREEN };
  const DATE_ACCENT = DARK_GREEN;
  const TEXT_DARK: [number, number, number] = [17, 24, 39];
  const MUTED: [number, number, number] = [107, 114, 128];
  const GREEN_BG: [number, number, number] = [209, 250, 229];
  const GREEN_TXT: [number, number, number] = [4, 120, 87];
  const RED_BG: [number, number, number] = [254, 226, 226];
  const RED_TXT: [number, number, number] = [185, 28, 28];

  const isCancelled = !!ticket.isCancelled;
  const statusLabel = isCancelled ? 'Cancelled' : 'Confirmed';
  const statusBg = isCancelled ? RED_BG : GREEN_BG;
  const statusTxt = isCancelled ? RED_TXT : GREEN_TXT;

  const measureDoc = new jsPDF({ unit: 'pt', format: [pageW, 100] });
  const wrap = (text: string, fontSize: number, bold: boolean, maxWidth: number): string[] => {
    measureDoc.setFont('helvetica', bold ? 'bold' : 'normal');
    measureDoc.setFontSize(fontSize);
    return measureDoc.splitTextToSize(text || '—', maxWidth) as string[];
  };

  const termFontSize = 8.5;
  const termLineHeight = termFontSize * 1.4;
  const termNumW = 16;

  // ── Box 1 data: "BEFORE THE EVENT" — logistics + organizer's checklist ──
  const ledeText = 'A few things to know before you head to the event.';
  const ledeLines = wrap(ledeText, 9, false, cardW - 28);

  const bulletFontSize = 8.5;
  const bulletLineHeight = bulletFontSize * 1.4;
  const bulletMarkW = 14;
  const goodToKnowLines = goodToKnowText
    ? goodToKnowText.split(/\r?\n+/).map((t) => t.trim()).filter(Boolean)
    : [];
  const wrappedGoodToKnow = goodToKnowLines.map((t) => wrap(t, bulletFontSize, false, cardW - 28));
  const hasGoodToKnow = wrappedGoodToKnow.length > 0;
  const goodToKnowBlockH = wrappedGoodToKnow.reduce((sum, lines) => sum + lines.length * bulletLineHeight + 6, 0);

  const hasArriveByForBox1 = !!event.eventArriveBy;
  const hasAgeLimitForBox1 = !!event.eventAgeLimit;
  const hasHelplineForBox1 = !!event.eventHelplineNumber;
  const infoBoxCountForBox1 = [hasArriveByForBox1, hasAgeLimitForBox1, hasHelplineForBox1].filter(Boolean).length;
  const infoBoxesHForBox1 = infoBoxCountForBox1 > 0 ? 46 : 0;

  const box1InnerPad = 14;
  const box1ContentH =
    (ledeLines.length ? ledeLines.length * 12 + 8 : 0) +
    (infoBoxCountForBox1 > 0 ? infoBoxesHForBox1 + 12 : 0) +
    (hasGoodToKnow ? goodToKnowBlockH : 0);
  const hasBox1 = box1ContentH > 0;
  const box1H = hasBox1 ? 24 + box1ContentH + box1InnerPad * 2 : 0;

  // ── Box 2 data: "TERMS & CONDITIONS" — organizer's consent text, its OWN block ──
  const termLines = consentText
    ? consentText.split(/\r?\n+/).map((t) => t.trim()).filter(Boolean)
    : [];
  const wrappedTerms = termLines.map((t) => wrap(t, termFontSize, false, cardW - 28));
  const hasTerms = wrappedTerms.length > 0;
  const box2InnerPad = 14;
  const termsBlockH = wrappedTerms.reduce((sum, lines) => sum + lines.length * termLineHeight + 6, 0);
  const box2H = hasTerms ? 24 + termsBlockH + box2InnerPad * 2 : 0;

  const titleLines = wrap(cleanEventTitle.toUpperCase(), 19, true, cardW - 40).slice(0, 2);
  const heroH = (hasBanner ? 148 : 108) + (titleLines.length - 1) * 22;

  const eventDateObj = event.eventDate
    ? new Date(`${event.eventDate.slice(0, 10)}T00:00:00`)
    : null;
  const dayNum = eventDateObj ? eventDateObj.getDate().toString() : '--';
  const monthAbbr = eventDateObj ? eventDateObj.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase() : '';
  const weekday = eventDateObj ? eventDateObj.toLocaleDateString('en-IN', { weekday: 'long' }) : '';
  const formatEventTime = (t?: string): string | null => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`; // 24-hour, e.g. 22:00
  };
  const timeStr = formatEventTime(event.eventTime);

  const dateBoxW = 92;
  const venueTextX = cardX + dateBoxW + 18;
  const venueTextW = cardX + cardW - 18 - venueTextX;
  const venueLines = event.eventVenue ? wrap(event.eventVenue, 12, true, venueTextW) : [];
  const dateVenueH = Math.max(60, 22 + venueLines.length * 15 + (timeStr ? 30 : 0));

  // Online events have no physical venue — never show directions for them.
  const directionsUrl = event.eventVenue && !event.eventIsOnline
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.eventVenue)}`
    : null;
  const calendarUrl = event.eventDate
    ? (() => {
      const dateStr = event.eventDate!.replace(/-/g, '');
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        cleanEventTitle
      )}&dates=${dateStr}/${dateStr}&location=${encodeURIComponent(event.eventVenue || '')}`;
    })()
    : null;
  const actionLinks: { label: string; url: string }[] = [];
  if (directionsUrl) actionLinks.push({ label: 'Get directions', url: directionsUrl });
  if (calendarUrl) actionLinks.push({ label: 'Add to calendar', url: calendarUrl });
  // Private events are single-session/invite-only — there's nothing more to book.
  if (event.bookMoreTicketsUrl && !event.eventIsPrivate) {
    actionLinks.push({ label: 'Book more tickets', url: event.bookMoreTicketsUrl });
  }
  // Buttons ab date box ke bagal (venue column) me aayenge; jagah kam pade to 2nd row me wrap
  const btnPad = 9, btnH = 22, btnGap = 6, btnRowGap = 6;
  measureDoc.setFont('helvetica', 'bold');
  measureDoc.setFontSize(8.5);
  let rowX = 0, rowNo = 0;
  const btnLayout = actionLinks.map((l) => {
    const w = measureDoc.getTextWidth(l.label) + btnPad * 2;
    if (rowX > 0 && rowX + w > venueTextW) { rowNo++; rowX = 0; }
    const item = { ...l, w, x: rowX, row: rowNo };
    rowX += w + btnGap;
    return item;
  });
  const btnRows = actionLinks.length ? rowNo + 1 : 0;
  const actionBandH = btnRows ? btnRows * btnH + (btnRows - 1) * btnRowGap + 16 : 0;

  const tearGap = 24;

  const stubInset = 10;                 // inner panel ka card edge se gap
  const stubPadX = 24;                  // stub content ka left/right padding
  const stubLeft = cardX + stubPadX;
  const qrBoxSize = 118;
  const qrLeft = cardX + cardW - stubPadX - qrBoxSize;
  const leftColW = qrLeft - stubLeft - 12;

  const nameLines = wrap(ticket.attendeeName, 18, true, leftColW).slice(0, 2);
  const tierLabel = (ticket.tierName || 'General').toUpperCase();
  const paidLabel = `PAID VIA ${(ticket.paymentMode || '—').toUpperCase()}`;
  const paidValue = `Rs. ${(ticket.amountPaid ?? 0).toLocaleString('en-IN')}`;
  const bookedMs = ticket.purchasedAt ?? ticket.createdAt;
  const bookedStr = bookedMs
    ? new Date(bookedMs).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const ticketIdLines = wrap(ticket.ticketId, 11, true, qrBoxSize);

  const nameLineH = 20;
  const contactLineH = 12;
  const tierStampH = 30;
  const factsRowH = 34;

  const leftColH =
    16 + nameLines.length * nameLineH + 8 + contactLineH * 2 + 6 + (tierStampH + 4) + 14 + factsRowH;
  const rightColH = hasQr ? 14 + qrBoxSize + 12 + ticketIdLines.length * 12 + 6 + 9 + 10 + 1 : 0;
  const stubH = 16 + Math.max(leftColH, rightColH) + 4 + stubInset;

  const cardH = heroH + dateVenueH + actionBandH + tearGap + stubH;

  const page1Height =
    outerMargin + cardH + 22 +
    (hasBox1 ? box1H + 16 : 0) +
    (hasTerms ? box2H + 16 : 0) +
    (14 + 11 + 11) +
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
    y = topMarginAfterBreak;
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

  const cardTop = outerMargin;

  doc.saveGraphicsState();
  // @ts-ignore
  doc.roundedRect(cardX, cardTop, cardW, cardH, 18, 18, null);
  doc.clip();
  doc.discardPath();

  // poora card solid teal (hero + date row + tear + stub sab isi ke upar)
  doc.setFillColor(...TEAL);
  doc.rect(cardX, cardTop, cardW, cardH, 'F');

  if (hasBanner && event.eventBannerDataUrl) {
    try {
      doc.addImage(event.eventBannerDataUrl, 'JPEG', cardX, cardTop, cardW, heroH);
    } catch {
      /* gradient underneath still shows if the image fails to decode */
    }
    const scrimBands = 12;
    const scrimBandH = heroH / scrimBands;
    for (let i = 0; i < scrimBands; i++) {
      const opacity = Math.pow(i / (scrimBands - 1), 1.4) * 0.95;
      doc.saveGraphicsState();
      // @ts-ignore
      doc.setGState(new (doc as any).GState({ opacity }));
      doc.setFillColor(...TEAL);
      doc.rect(cardX, cardTop + i * scrimBandH, cardW, scrimBandH + 1, 'F');
      doc.restoreGraphicsState();
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const eyebrowW = doc.getTextWidth('E-TICKET') + 16;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(cardX + 16, cardTop + 14, eyebrowW, 16, 8, 8, 'F');
  doc.setTextColor(...INK);
  doc.text('E-TICKET', cardX + 24, cardTop + 25);

  pill(statusLabel, cardX + cardW - 16 - 70, cardTop + 14, statusBg, statusTxt);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(255, 255, 255);
  const titleBaseY = cardTop + heroH - 20 - (titleLines.length - 1) * 22;
  titleLines.forEach((line, i) => doc.text(line, cardX + 16, titleBaseY + i * 22));

  const dvTop = cardTop + heroH;
  const dateRowH = dateVenueH + actionBandH;       // date box buttons tak lamba

  // hero aur date row ke beech patli line
  doc.setDrawColor(60, 160, 157);
  doc.setLineWidth(0.75);
  doc.line(cardX, dvTop, cardX + cardW, dvTop);

  doc.setFillColor(...DATE_ACCENT);
  doc.rect(cardX, dvTop, dateBoxW, dateRowH, 'F');

  doc.setTextColor(255, 255, 255);
  const dateContentH = 78;
  const dateOffsetY = Math.max(12, (dateRowH - dateContentH) / 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(32);
  doc.text(dayNum, cardX + 13, dvTop + dateOffsetY + 32);
  doc.setFontSize(12);
  doc.text(monthAbbr, cardX + 16, dvTop + dateOffsetY + 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(weekday, cardX + 16, dvTop + dateOffsetY + 65, { maxWidth: dateBoxW - 24 });

  let vy = dvTop + 20;
  if (timeStr) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(220, 240, 238);
    doc.text('SHOW STARTS', venueTextX, vy);
    vy += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(timeStr, venueTextX, vy);
    vy += 18;
  } else {
    vy += 6;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(255, 255, 255);
  venueLines.forEach((line) => {
    doc.text(line, venueTextX, vy);
    vy += 15;
  });

  if (btnLayout.length > 0) {
    const bandTop = dvTop + dateVenueH;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    btnLayout.forEach((b, i) => {
      const bx = venueTextX + b.x;
      const by = bandTop + 2 + b.row * (btnH + btnRowGap);
      if (i === 0) {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(bx, by, b.w, btnH, btnH / 2, btnH / 2, 'F');
        doc.setTextColor(...INK);
      } else {
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(1);
        doc.roundedRect(bx, by, b.w, btnH, btnH / 2, btnH / 2, 'S');
        doc.setTextColor(255, 255, 255);
      }
      doc.text(b.label, bx + btnPad, by + btnH / 2 + 3);
      doc.link(bx, by, b.w, btnH, { url: b.url });
    });
  }

  const tearY = dvTop + dateVenueH + actionBandH + tearGap / 2;
  doc.setFillColor(...PAGE_BG);                       // page ke color ke circle = "cut" wala look
  doc.circle(cardX, tearY, 11, 'F');
  doc.circle(cardX + cardW, tearY, 11, 'F');
  doc.setDrawColor(150, 210, 207);                    // light teal dotted line (white pe dikhti nahi thi)
  doc.setLineWidth(1.2);
  doc.setLineDashPattern([5, 4], 0);
  doc.line(cardX + 20, tearY, cardX + cardW - 20, tearY);
  doc.setLineDashPattern([], 0);

  const stubTop = dvTop + dateVenueH + actionBandH + tearGap;

  // Inner rounded panel (image jaisa)
  const panelX = cardX + stubInset;
  const panelW = cardW - stubInset * 2;
  const panelH = cardH - (stubTop - cardTop) - stubInset;
  doc.setFillColor(...STUB_BG);
  doc.roundedRect(panelX, stubTop, panelW, panelH, 14, 14, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text('TICKET HOLDER', stubLeft, stubTop + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...TEXT_DARK);
  let ny = stubTop + 36;
  nameLines.forEach((line) => {
    doc.text(line, stubLeft, ny, { maxWidth: leftColW });
    ny += nameLineH;
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(ticket.attendeeEmail || '—', stubLeft, ny);
  ny += contactLineH;
  doc.text(ticket.attendeePhone || '—', stubLeft, ny);
  ny += contactLineH + 6;

  // ── Tier stamp: rounded, thoda tilted, shadow ke saath (dark green) ──
  const TILT_DEG = 3;                       // 0 kar do to seedha ho jayega
  const tierTag = (ticket.tierTag || '').toUpperCase();
  const stampPadX = 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  const tagW = tierTag ? doc.getTextWidth(tierTag) + 10 : 0;
  const maxLabelW = leftColW - stampPadX * 2 - (tagW ? tagW + 6 : 0) - 4;
  let stampFs = 15;
  doc.setFontSize(stampFs);
  while (doc.getTextWidth(tierLabel) > maxLabelW && stampFs > 8) {
    stampFs -= 1;
    doc.setFontSize(stampFs);
  }
  const labelW = doc.getTextWidth(tierLabel);
  const stampW = stampPadX * 2 + labelW + (tagW ? tagW + 6 : 0);

  const rad = (TILT_DEG * Math.PI) / 180;
  const cosT = Math.cos(rad), sinT = Math.sin(rad);
  const pvX = stubLeft + stampW / 2;
  const pvY = doc.internal.pageSize.getHeight() - (ny + tierStampH / 2);

  doc.saveGraphicsState();
  doc.setCurrentTransformationMatrix(
    new (doc as any).Matrix(
      cosT, sinT, -sinT, cosT,
      pvX - pvX * cosT + pvY * sinT,
      pvY - pvX * sinT - pvY * cosT
    )
  );
  doc.setFillColor(...INK);                                            // shadow
  doc.roundedRect(stubLeft + 3, ny + 4, stampW, tierStampH, 9, 9, 'F');
  doc.setFillColor(...DARK_GREEN);                                     // stamp
  doc.roundedRect(stubLeft, ny, stampW, tierStampH, 9, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(stampFs);
  doc.setTextColor(255, 255, 255);
  doc.text(tierLabel, stubLeft + stampPadX, ny + tierStampH / 2 + stampFs * 0.35);
  if (tierTag) {
    const chipX = stubLeft + stampPadX + labelW + 6;
    doc.setFillColor(190, 225, 215);
    doc.roundedRect(chipX, ny + tierStampH / 2 - 6, tagW, 12, 6, 6, 'F');
    doc.setFontSize(6.5);
    doc.setTextColor(...DARK_GREEN);
    doc.text(tierTag, chipX + 5, ny + tierStampH / 2 + 2.3);
  }
  doc.restoreGraphicsState();
  ny += tierStampH + 4 + 14;

  // ── Facts row ──
  const factsGap = 8;
  const factsColX2 = stubLeft + (leftColW - factsGap) / 2 + factsGap;
  doc.setDrawColor(...CARD_BORDER);
  doc.setLineWidth(0.75);
  doc.line(stubLeft, ny, stubLeft + leftColW, ny);
  ny += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(paidLabel, stubLeft, ny);
  doc.text('BOOKED', factsColX2, ny);
  ny += 13;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...TEAL);
  doc.text(paidValue, stubLeft, ny);
  doc.setTextColor(...TEXT_DARK);
  doc.text(bookedStr, factsColX2, ny);

  // ── QR: rounded teal border ──
  if (hasQr && qrCanvas) {
    const qrTop = stubTop + 14;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(2);
    doc.roundedRect(qrLeft, qrTop, qrBoxSize, qrBoxSize, 12, 12, 'FD');
    const pad = 12;
    doc.addImage(
      qrCanvas.toDataURL('image/png'), 'PNG',
      qrLeft + pad, qrTop + pad, qrBoxSize - pad * 2, qrBoxSize - pad * 2
    );

    let qy = qrTop + qrBoxSize + 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...TEAL);
    ticketIdLines.forEach((line) => {
      doc.text(`#${line}`, qrLeft + qrBoxSize / 2, qy, { align: 'center' });
      qy += 12;
    });
    qy += 4;
    doc.setFontSize(7);
    doc.text('SCAN AT ENTRY', qrLeft + qrBoxSize / 2, qy, { align: 'center' });
    qy += 12;
    pill('Admits 1', qrLeft + qrBoxSize / 2 - 28, qy, GREEN_BG, GREEN_TXT);
  }

  doc.restoreGraphicsState();

  y = cardTop + cardH + 10;

  const hasArriveBy = !!event.eventArriveBy;
  const hasAgeLimit = !!event.eventAgeLimit;
  const hasHelpline = !!event.eventHelplineNumber;
  const infoBoxCount = [hasArriveBy, hasAgeLimit, hasHelpline].filter(Boolean).length;

  // ── Box 1: BEFORE THE EVENT ──
  if (hasBox1) {
    const innerPad = box1InnerPad;
    ensureSpace(box1H);

    doc.setFillColor(...CARD_BG);
    doc.setDrawColor(...CARD_BORDER);
    doc.setLineWidth(0.75);
    doc.rect(cardX, y, cardW, box1H, 'FD');

    let ty = y + innerPad + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...TEAL);
    doc.text('GOOD TO DO BEFORE THE EVENT', cardX + innerPad, ty);
    ty += 16;

    if (ledeLines.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      ledeLines.forEach((line) => {
        doc.text(line, cardX + innerPad, ty);
        ty += 12;
      });
      ty += 6;
    }

    if (infoBoxCount > 0) {
      const boxGap = 8;
      const boxW = (cardW - innerPad * 2 - boxGap * (infoBoxCount - 1)) / infoBoxCount;
      const boxH = 34;
      const boxItems: { label: string; value: string }[] = [];
      if (hasArriveBy) boxItems.push({
        label: 'ARRIVE BY',
        value: formatEventTime(event.eventArriveBy as string) ?? (event.eventArriveBy as string),
      });
      if (hasAgeLimit) boxItems.push({ label: 'AGE LIMIT', value: event.eventAgeLimit as string });
      if (hasHelpline) boxItems.push({ label: 'NEED HELP?', value: event.eventHelplineNumber as string });

      boxItems.forEach((item, i) => {
        const bx = cardX + innerPad + i * (boxW + boxGap);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(...CARD_BORDER);
        doc.setLineWidth(0.75);
        doc.rect(bx, ty, boxW, boxH, 'FD');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.text(item.label, bx + 8, ty + 13);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(...TEXT_DARK);
        doc.text(item.value, bx + 8, ty + 27, { maxWidth: boxW - 16 });
      });
      ty += boxH + 12;
    }

    if (hasGoodToKnow) {
      wrappedGoodToKnow.forEach((lines) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(bulletFontSize);
        doc.setTextColor(...MUTED);
        lines.forEach((line, i) => doc.text(line, cardX + innerPad, ty + i * bulletLineHeight));
        ty += lines.length * bulletLineHeight + 6;
      });
    }

    y += box1H + 16;
  }

  // ── Box 2: TERMS & CONDITIONS — completely separate block, consent text only ──
  if (hasTerms) {
    const innerPad = box2InnerPad;
    ensureSpace(box2H);

    doc.setFillColor(...CARD_BG);
    doc.setDrawColor(...CARD_BORDER);
    doc.setLineWidth(0.75);
    doc.rect(cardX, y, cardW, box2H, 'FD');

    let ty = y + innerPad + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...TEAL);
    doc.text('TERMS & CONDITIONS', cardX + innerPad, ty);
    ty += 16;

    wrappedTerms.forEach((lines) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(termFontSize);
      doc.setTextColor(...MUTED);
      lines.forEach((line, i) => doc.text(line, cardX + innerPad, ty + i * termLineHeight));
      ty += lines.length * termLineHeight + 6;
    });

    y += box2H + 16;
  }

  ensureSpace(40);
  doc.setDrawColor(...CARD_BORDER);
  doc.setLineWidth(0.5);
  doc.line(cardX, y, cardX + cardW, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.text(`TICKET #${ticket.ticketId}`, cardX, y);
  y += 11;
  doc.text(`GENERATED: ${new Date().toLocaleString('en-IN')}`, cardX, y);
  pill('Verified', cardX + cardW - 56, y - 20, GREEN_BG, GREEN_TXT);

  // ── Footer: Made by Outsold.in ───────────────────────────────
  // Keep footer fixed at the very bottom of the page
  const pageHeight = doc.internal.pageSize.getHeight();

  const footerY = pageHeight - 12;
  const footerX = cardX + cardW / 2;

  const footerPrefix = 'Made by ';
  const footerBrand = 'Outsold.in';

  // "Made by"
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);

  const prefixWidth = doc.getTextWidth(footerPrefix);

  // "Outsold.in"
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEAL);

  const brandWidth = doc.getTextWidth(footerBrand);

  const totalWidth = prefixWidth + brandWidth;
  const startX = footerX - totalWidth / 2;

  // Draw "Made by"
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(footerPrefix, startX, footerY);

  // Draw "Outsold.in"
  const brandX = startX + prefixWidth;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEAL);
  doc.text(footerBrand, brandX, footerY);

  // Make ONLY "Outsold.in" clickable
  doc.link(
    brandX,
    footerY - 7,
    brandWidth,
    9,
    { url: 'https://app.outsold.in' }
  );

  return doc;
};

function stripHtmlTagsLocal(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

// Multi-line rich-text (consent / good-to-know) ke liye:
// block tags aur <br> ko newline banata hai taaki har line alag rahe.
function htmlToPlainLines(html: string): string {
  return html
    .replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|ul|ol|tr)>/gi, '\n')
    .replace(/<(p|div|li|h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

// Instagram-story-style palette pick: samples the banner, buckets pixels by
// quantized color, skips near-white/near-black/low-saturation (gray) pixels
// so we land on a vibrant color instead of "average brownish gray", then
// derives a darker shade for the stamp/accent color from the same hue.
const DEFAULT_TEAL: [number, number, number] = [0, 122, 120];
const DEFAULT_DARK_GREEN: [number, number, number] = [4, 78, 60];

function extractPaletteFromImage(
  dataUrl: string
): Promise<{ primary: [number, number, number]; dark: [number, number, number] }> {
  return new Promise((resolve) => {
    const fallback = { primary: DEFAULT_TEAL, dark: DEFAULT_DARK_GREEN };
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const size = 60;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(fallback); return; }
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 200) continue;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const lightness = (max + min) / 2;
          const sat = max === min ? 0 : (max - min) / (255 - Math.abs(2 * lightness - 255));
          if (lightness > 235 || lightness < 20 || sat < 0.15) continue; // white/black/gray — skip
          const key = `${r >> 4}-${g >> 4}-${b >> 4}`; // quantize to 16 levels/channel
          const bucket = buckets.get(key);
          if (bucket) { bucket.count++; bucket.r += r; bucket.g += g; bucket.b += b; }
          else buckets.set(key, { count: 1, r, g, b });
        }

        let best: { count: number; r: number; g: number; b: number } | null = null;
        for (const v of buckets.values()) {
          if (!best || v.count > best.count) best = v;
        }
        if (!best) { resolve(fallback); return; }

        const pr = Math.round(best.r / best.count);
        const pg = Math.round(best.g / best.count);
        const pb = Math.round(best.b / best.count);
        const darken = (v: number) => Math.max(0, Math.round(v * 0.55));

        resolve({ primary: [pr, pg, pb], dark: [darken(pr), darken(pg), darken(pb)] });
      } catch {
        resolve(fallback);
      }
    };

    img.onerror = () => resolve(fallback);
    img.src = dataUrl;
  });
}