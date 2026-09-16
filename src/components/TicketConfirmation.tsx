import React, { useRef, useState } from 'react';
import { CheckCircle2, Download, Share2, Ticket as TicketIcon, FileDown, MapPin } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import { stripHtmlTags } from '../lib/utils';
import { shareTicketImage } from '../lib/shareTicket';

const TICKET_CANVAS_SCALE = 2;      // was 3 inside buildTicketCanvas — still crisp, ~55% fewer pixels
const TICKET_IMAGE_QUALITY = 0.85;  // JPEG quality used everywhere a ticket image is produced

interface PurchasedTicket {
    ticketId: string;
    tierName: string;
    attendeeName: string;
    accessCode?: string;
}

interface TicketConfirmationProps {
    eventTitle: string;
    eventDate: string;
    eventVenue?: string;   // optional — powers the location row under the title
    tickets: PurchasedTicket[];
    onDone: () => void;
}

const TicketConfirmation: React.FC<TicketConfirmationProps> = ({
    eventTitle,
    eventDate,
    eventVenue,
    tickets,
    onDone,
}) => {
    const cleanEventTitle = stripHtmlTags(eventTitle);
    const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

        const buildTicketCanvas = (
        ticketId: string,
        tierName: string,
        attendeeName: string,
        eventTitle: string,
        eventDate: string,
        eventVenue?: string
    ): HTMLCanvasElement | null => {
        const qrCanvas = canvasRefs.current[ticketId];
        if (!qrCanvas) return null;

        const SCALE = TICKET_CANVAS_SCALE;
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

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 12;
        ctx.fillStyle = CARD_BG;
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, radius);
        ctx.fill();
        ctx.restore();

                ctx.save();
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, radius);
        ctx.clip();

        ctx.fillStyle = CARD_BG;
        ctx.fillRect(cardX, cardY, cardW, cardH);

        const grad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + headerH);
        grad.addColorStop(0, INK);
        grad.addColorStop(1, TEAL);
        ctx.fillStyle = grad;
        ctx.fillRect(cardX, cardY, cardW, headerH);

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
        const tierText = tierName.toUpperCase();
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
        const titleLines = wrapText(eventTitle, cardW - 40);
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
        const nameText = attendeeName.length > 18 ? `${attendeeName.slice(0, 16)}…` : attendeeName;
        ctx.fillText(nameText, cardX + 20, colY + 16);
        ctx.fillText(eventDate || '—', cardX + 20 + colGap, colY + 16);

        ctx.restore();

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

        y += boxSize + 26;
        ctx.textAlign = 'center';
        ctx.fillStyle = INK;
        ctx.font = '600 13px monospace';
        ctx.fillText(ticketId.split('').join('\u200a'), width / 2, y);

                y += 18;
        ctx.fillStyle = 'rgba(11,59,58,0.45)';
        ctx.font = '600 10px sans-serif';
        ctx.fillText('SCAN AT ENTRY · NON-TRANSFERABLE', width / 2, y);

        return out;
    };

        const handleDownload = (ticketId: string, tierName: string, attendeeName: string) => {
        const canvas = buildTicketCanvas(ticketId, tierName, attendeeName, cleanEventTitle, eventDate, eventVenue);
        if (!canvas) return;
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/jpeg', TICKET_IMAGE_QUALITY);
        link.download = `${ticketId}.jpg`;
        link.click();
    };
    const [sharingId, setSharingId] = useState<string | null>(null); // add near top of component

    const handleShare = async (ticketId: string, tierName: string, attendeeName: string) => {
        if (sharingId === ticketId) return; // prevent double-tap re-entry
        setSharingId(ticketId);

        try {
                        const text = `Ticket: ${ticketId}\nAttendee: ${attendeeName}`;
            const canvas = buildTicketCanvas(ticketId, tierName, attendeeName, cleanEventTitle, eventDate, eventVenue);
            if (canvas) {
                await shareTicketImage(
                    canvas.toDataURL('image/jpeg', TICKET_IMAGE_QUALITY),
                    `${ticketId}.jpg`,
                    'image/jpeg',
                    { title: cleanEventTitle, text }
                );
            }
        } finally {
            setSharingId(null);
        }
    };
    const handleDownloadAllPdf = () => {
        const pdf = new jsPDF({ unit: 'px', format: [360, 380], compress: true });

                tickets.forEach((t, index) => {
            const canvas = buildTicketCanvas(t.ticketId, t.tierName, t.attendeeName, cleanEventTitle, eventDate, eventVenue);
            if (!canvas) return;

            const logicalW = canvas.width / TICKET_CANVAS_SCALE;
            const logicalH = canvas.height / TICKET_CANVAS_SCALE;

            if (index > 0) pdf.addPage([logicalW, logicalH]);
            else pdf.internal.pageSize.width = logicalW;

            pdf.addImage(
                canvas.toDataURL('image/jpeg', TICKET_IMAGE_QUALITY),
                'JPEG',
                0,
                0,
                logicalW,
                logicalH,
                undefined,
                'FAST'
            );
        });

        pdf.save(`${cleanEventTitle.replace(/\s+/g, '_')}_tickets.pdf`);
    };

    return (
        <div className="flex w-full flex-col items-center p-4">
            <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 py-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0B3B3A] shadow-md">
                    <CheckCircle2 size={32} className="text-white" strokeWidth={2.5} />
                </div>

                <div className="flex w-full flex-col items-center gap-1 text-center">
                    <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#007A78]">
                        Booking Confirmed
                    </span>
                    <h1 className="text-2xl font-extrabold text-[#0B3B3A]">{cleanEventTitle}</h1>
                    <p className="text-sm text-slate-500">{eventDate}</p>
                </div>

                <div className="flex w-full items-center justify-between gap-3 rounded-sm bg-white px-4 py-3 shadow-sm">
                    <span className="text-xs font-semibold text-slate-600">
                        {tickets.length} ticket{tickets.length === 1 ? '' : 's'} in this order
                    </span>
                    <button
                        onClick={handleDownloadAllPdf}
                        className="flex shrink-0 items-center gap-1.5 rounded-sm bg-[#007A78] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2DD4BF]"
                    >
                        <FileDown size={14} /> Download all
                    </button>
                </div>

                <div className="flex w-full flex-col gap-6">
                    {tickets.map((t) => (
                        <div key={t.ticketId} className="w-full">
                                                        {/* Header band — gradient, eyebrow + tier pill, title, venue, attendee/date columns */}
                            <div
                                className="relative overflow-hidden rounded-sm px-5 py-5"
                                style={{ background: 'linear-gradient(135deg, #0B3B3A 0%, #00A896 100%)' }}
                            >
                                <div className="pointer-events-none absolute -right-3 -top-3 h-24 w-24 rounded-full bg-white/[0.08]" />
                                <div className="pointer-events-none absolute -left-3 bottom-[-24px] h-16 w-16 rounded-full bg-white/[0.08]" />

                                <div className="relative flex items-center justify-between">
                                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-white">
                                        <span className="rounded-full bg-white/16 px-2 py-0.5 tracking-wide">E-TICKET</span>
                                        <span className="text-white/70 tracking-[0.15em] uppercase">Live Pass</span>
                                    </span>
                                    <span className="inline-flex items-center rounded-full border border-white/35 bg-white/16 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                                        <TicketIcon size={11} className="mr-1" /> {t.tierName}
                                    </span>
                                </div>

                                <p className="relative mt-3 text-xl font-extrabold leading-tight text-white">{cleanEventTitle}</p>

                                {eventVenue && (
                                    <p className="relative mt-1 flex items-center gap-1 text-[11px] text-white/75">
                                        <MapPin size={12} /> {eventVenue}
                                    </p>
                                )}

                                <div className="relative mt-3 border-t border-white/15" />

                                <div className="relative mt-3 flex gap-8">
                                    <div>
                                        <p className="text-[9px] font-semibold uppercase tracking-wide text-white/55">Attendee</p>
                                        <p className="mt-1 text-sm font-bold text-white">{t.attendeeName}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-semibold uppercase tracking-wide text-white/55">Date</p>
                                        <p className="mt-1 text-sm font-bold text-white">{eventDate}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Perforated seam */}
                            <div className="relative h-0">
                                <div className="absolute left-0 right-0 top-0 border-t-2 border-dashed border-[#0B3B3A]/18" />
                                <div className="absolute -left-3 -top-3 h-6 w-6 rounded-sm bg-gray-100" />
                                <div className="absolute -right-3 -top-3 h-6 w-6 rounded-sm bg-gray-100" />
                            </div>

                            {/* Body */}
                            <div className="flex flex-col items-center gap-3 rounded-sm bg-white px-5 pb-5 pt-7 shadow-md">
                                <div className="relative rounded-sm border border-[#0B3B3A]/10 bg-white p-4 shadow-sm">
                                    {/* viewfinder-style corner brackets, matches canvas */}
                                    <span className="pointer-events-none absolute left-1.5 top-1.5 h-3.5 w-3.5 border-l-2 border-t-2 border-[#007A78]" />
                                    <span className="pointer-events-none absolute right-1.5 top-1.5 h-3.5 w-3.5 border-r-2 border-t-2 border-[#007A78]" />
                                    <span className="pointer-events-none absolute bottom-1.5 left-1.5 h-3.5 w-3.5 border-b-2 border-l-2 border-[#007A78]" />
                                    <span className="pointer-events-none absolute bottom-1.5 right-1.5 h-3.5 w-3.5 border-b-2 border-r-2 border-[#007A78]" />

                                    <QRCodeCanvas
                                        value={t.ticketId}
                                        size={340}
                                        includeMargin
                                        style={{ width: 170, height: 170 }}
                                        ref={(el) => {
                                            canvasRefs.current[t.ticketId] = el as unknown as HTMLCanvasElement;
                                        }}
                                    />
                                </div>

                                <p className="font-mono text-xs font-semibold tracking-[0.15em] text-[#0B3B3A]">
                                    {t.ticketId.split('').join('\u200a')}
                                </p>
                                <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#0B3B3A]/40">
                                    Scan at entry · Non-transferable
                                </p>

                                {t.accessCode && (
                                    <p className="text-[11px] font-medium text-[#0B3B3A]/60">
                                        Access code: <span className="font-mono font-bold tracking-wide text-[#0B3B3A]">{t.accessCode}</span>
                                    </p>
                                )}

                                <div className="flex w-full gap-2 pt-1">
                                    <button
                                        onClick={() => handleDownload(t.ticketId, t.tierName, t.attendeeName)}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-sm bg-[#0B3B3A] py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#0B3B3A]/85"
                                    >
                                        <Download size={14} /> Download
                                    </button>
                                    <button
                                        onClick={() => handleShare(t.ticketId, t.tierName, t.attendeeName)}
                                        disabled={sharingId === t.ticketId}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-[#0B3B3A]/15 py-2.5 text-xs font-semibold text-[#0B3B3A] transition-colors hover:bg-[#0B3B3A]/5"
                                    >
                                        <Share2 size={14} /> {sharingId === t.ticketId ? 'Sharing…' : 'Share'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <button onClick={onDone} className="mt-2 text-sm font-medium text-slate-500 underline">
                    Close
                </button>
            </div>
        </div>
    );
};

export default TicketConfirmation;