import React, { useRef, useState } from 'react';
import { CheckCircle2, Download, Share2, Ticket as TicketIcon, FileDown } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import { stripHtmlTags } from '../lib/utils';

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
    tickets: PurchasedTicket[];
    onDone: () => void;
}

const TicketConfirmation: React.FC<TicketConfirmationProps> = ({
    eventTitle,
    eventDate,
    tickets,
    onDone,
}) => {
    const cleanEventTitle = stripHtmlTags(eventTitle);
    const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

    const buildTicketCanvas = (ticketId: string, tierName: string, attendeeName: string): HTMLCanvasElement | null => {
        const qrCanvas = canvasRefs.current[ticketId];
        if (!qrCanvas) return null;

        const SCALE = TICKET_CANVAS_SCALE;
        const width = 380;
        const cardMargin = 14;
        const cardW = width - cardMargin * 2;
        const headerH = 96;
        const stubPadTop = 22;
        const qrSize = 168;
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

        ctx.save();
        ctx.shadowColor = 'rgba(11,59,58,0.18)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 10;
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
        ctx.beginPath(); ctx.arc(cardX + cardW - 20, cardY + 18, 46, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cardX + 18, cardY + headerH - 6, 30, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('E · T I C K E T', cardX + 20, cardY + 24);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(attendeeName, cardX + 20, cardY + 50);

        ctx.font = 'bold 11px sans-serif';
        const pillText = tierName.toUpperCase();
        const pillW = ctx.measureText(pillText).width + 20;
        const pillH = 22;
        const pillX = cardX + 20;
        const pillY = cardY + 62;
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(pillText, pillX + 10, pillY + 15);

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

        y += boxSize + 26;
        ctx.textAlign = 'center';
        ctx.fillStyle = INK;
        ctx.font = '600 13px monospace';
        ctx.fillText(ticketId.split('').join('\u200a'), width / 2, y);

        y += 18;
        ctx.fillStyle = 'rgba(11,59,58,0.4)';
        ctx.font = '10px sans-serif';
        ctx.fillText('SCAN AT ENTRY · NON-TRANSFERABLE', width / 2, y);

        return out;
    };

    const handleDownload = (ticketId: string, tierName: string, attendeeName: string) => {
        const canvas = buildTicketCanvas(ticketId, tierName, attendeeName);
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
            const canvas = buildTicketCanvas(ticketId, tierName, attendeeName);
            // title ab text me repeat nahi hota — sirf ek jagah info jaayegi
            const text = `Ticket: ${ticketId}\nAttendee: ${attendeeName}`;

            if (canvas && navigator.share) {
                canvas.toBlob(async (blob) => {
                    if (!blob) return;
                    const file = new File([blob], `${ticketId}.jpg`, { type: 'image/jpeg' });
                    try {
                        if (navigator.canShare?.({ files: [file] })) {
                            await navigator.share({ files: [file] });
                        } else {
                            await navigator.share({ title: cleanEventTitle, text });
                        }
                    } catch {
                        /* user cancelled share — ignore */
                    }
                }, 'image/jpeg', TICKET_IMAGE_QUALITY);
            } else {
                navigator.clipboard?.writeText(text);
            }
        } finally {
            setSharingId(null);
        }
    };
    const handleDownloadAllPdf = () => {
        const pdf = new jsPDF({ unit: 'px', format: [360, 380], compress: true });

        tickets.forEach((t, index) => {
            const canvas = buildTicketCanvas(t.ticketId, t.tierName, t.attendeeName);
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
                            {/* Header band — gradient, name + tier pill inside (matches canvas) */}
                            <div
                                className="relative overflow-hidden rounded-sm px-5 py-4"
                                style={{ background: 'linear-gradient(135deg, #0B3B3A 0%, #007A78 100%)' }}
                            >
                                <div className="pointer-events-none absolute -right-3 -top-3 h-24 w-24 rounded-full bg-white/[0.08]" />
                                <div className="pointer-events-none absolute -left-3 bottom-[-24px] h-16 w-16 rounded-full bg-white/[0.08]" />

                                <span className="relative block text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                                    E · T I C K E T
                                </span>
                                <p className="relative mt-1 text-lg font-bold text-white">{t.attendeeName}</p>
                                <span className="relative mt-2 inline-flex items-center gap-1 rounded-sm border border-white/35 bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                                    <TicketIcon size={11} /> {t.tierName}
                                </span>
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