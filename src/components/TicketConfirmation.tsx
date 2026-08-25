import React, { useRef } from 'react';
import { CheckCircle2, Download, Share2, Ticket as TicketIcon, FileDown } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';

interface PurchasedTicket {
    ticketId: string;
    tierName: string;
    attendeeName: string;
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
    const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

    const buildTicketCanvas = (ticketId: string, tierName: string, attendeeName: string): HTMLCanvasElement | null => {
        const qrCanvas = canvasRefs.current[ticketId];
        if (!qrCanvas) return null;

        const width = 380;
        const qrSize = 190;
        const cardMargin = 14;
        const cardW = width - cardMargin * 2;
        const headerH = 60;
        const notchR = 9;
        const bodyPadTop = 26;
        const qrBoxPad = 14;
        const boxSize = qrSize + qrBoxPad * 2;
        const height = cardMargin + headerH + bodyPadTop + boxSize + 28 + 20 + cardMargin;

        const out = document.createElement('canvas');
        out.width = width;
        out.height = height;
        const ctx = out.getContext('2d');
        if (!ctx) return null;

        const PAGE_BG = '#F7F7F5';
        const CARD_BG = '#FBF8F3';
        const INK = '#0B3B3A';

        // Page backdrop
        ctx.fillStyle = PAGE_BG;
        ctx.fillRect(0, 0, width, height);

        const cardX = cardMargin;
        const cardY = cardMargin;
        const cardH = height - cardMargin * 2;
        const radius = 18;

        // Card base, clipped so the header respects rounded corners
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, radius);
        ctx.clip();
        ctx.fillStyle = CARD_BG;
        ctx.fillRect(cardX, cardY, cardW, cardH);

        ctx.fillStyle = INK;
        ctx.fillRect(cardX, cardY, cardW, headerH);
        ctx.restore();

        // Header text
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('E - T I C K E T', cardX + 20, cardY + 24);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(tierName, cardX + 20, cardY + 44);

        // Perforation notches + dashed seam
        const seamY = cardY + headerH;
        ctx.fillStyle = PAGE_BG;
        ctx.beginPath();
        ctx.arc(cardX, seamY, notchR, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cardX + cardW, seamY, notchR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(11,59,58,0.18)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(cardX + notchR + 6, seamY);
        ctx.lineTo(cardX + cardW - notchR - 6, seamY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Attendee name
        let y = seamY + bodyPadTop;
        ctx.textAlign = 'center';
        ctx.fillStyle = INK;
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(attendeeName, width / 2, y);

        // QR box with plain border
        y += 18;
        const boxX = (width - boxSize) / 2;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(11,59,58,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(boxX, y, boxSize, boxSize, 12);
        ctx.fill();
        ctx.stroke();
        ctx.drawImage(qrCanvas, boxX + qrBoxPad, y + qrBoxPad, qrSize, qrSize);

        // Ticket ID
        y += boxSize + 28;
        ctx.fillStyle = 'rgba(11,59,58,0.5)';
        ctx.font = '12px monospace';
        ctx.fillText(ticketId.split('').join('\u200a'), width / 2, y);

        return out;
    };

    const handleDownload = (ticketId: string, tierName: string, attendeeName: string) => {
        const canvas = buildTicketCanvas(ticketId, tierName, attendeeName);
        if (!canvas) return;
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `${ticketId}.png`;
        link.click();
    };

    const handleShare = (ticketId: string, tierName: string, attendeeName: string) => {
        const canvas = buildTicketCanvas(ticketId, tierName, attendeeName);
        const text = `${eventTitle}\nTicket: ${ticketId}\nAttendee: ${attendeeName}`;

        if (canvas && navigator.share) {
            canvas.toBlob(async (blob) => {
                if (!blob) return;
                const file = new File([blob], `${ticketId}.png`, { type: 'image/png' });
                try {
                    if (navigator.canShare?.({ files: [file] })) {
                        await navigator.share({ files: [file], title: eventTitle, text });
                    } else {
                        await navigator.share({ title: eventTitle, text });
                    }
                } catch {
                    /* user cancelled share — ignore */
                }
            });
        } else {
            navigator.clipboard?.writeText(text);
        }
    };
    const handleDownloadAllPdf = () => {
        const pdf = new jsPDF({ unit: 'px', format: [360, 380] });

        tickets.forEach((t, index) => {
            const canvas = buildTicketCanvas(t.ticketId, t.tierName, t.attendeeName);
            if (!canvas) return;
            if (index > 0) pdf.addPage([canvas.width, canvas.height]);
            else pdf.internal.pageSize.width = canvas.width; // pehla page bhi canvas size ka
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
        });

        pdf.save(`${eventTitle.replace(/\s+/g, '_')}_tickets.pdf`);
    };

    return (
        <div className="flex min-h-screen w-full flex-col items-center bg-[#F7F7F5] p-4">
            <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 py-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0B3B3A] shadow-md">
                    <CheckCircle2 size={32} className="text-white" strokeWidth={2.5} />
                </div>

                <div className="flex w-full flex-col items-center gap-1 text-center">
                    <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#007A78]">
                        Booking Confirmed
                    </span>
                    <h1 className="text-2xl font-extrabold text-[#0B3B3A]">{eventTitle}</h1>
                    <p className="text-sm text-slate-500">{eventDate}</p>
                </div>

                <div className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
                    <span className="text-xs font-semibold text-slate-600">
                        {tickets.length} ticket{tickets.length === 1 ? '' : 's'} in this order
                    </span>
                    <button
                        onClick={handleDownloadAllPdf}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#007A78] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2DD4BF]"
                    >
                        <FileDown size={14} /> Download all
                    </button>
                </div>

                <div className="flex w-full flex-col gap-6">
                    {tickets.map((t) => (
                        <div key={t.ticketId} className="w-full">
                            {/* Header band */}
                            <div className="flex items-center justify-between rounded-t-2xl bg-[#0B3B3A] px-5 py-3">
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                                    E-Ticket
                                </span>
                                <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white">
                                    <TicketIcon size={11} /> {t.tierName}
                                </span>
                            </div>

                            {/* Perforated seam */}
                            <div className="relative h-0">
                                <div className="absolute left-0 right-0 top-0 border-t-2 border-dashed border-[#0B3B3A]/15" />
                                <div className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-gray-100" />
                                <div className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-gray-100" />
                            </div>

                            {/* Body */}
                            <div className="flex flex-col items-center gap-3 rounded-b-2xl bg-[#FBF8F3] px-5 pb-5 pt-6 shadow-md">
                                <p className="text-base font-bold text-[#0B3B3A]">{t.attendeeName}</p>

                                <div className="rounded-xl border border-[#0B3B3A]/10 bg-white p-4 shadow-sm">
                                    <QRCodeCanvas
                                        value={t.ticketId}
                                        size={170}
                                        includeMargin
                                        ref={(el) => {
                                            canvasRefs.current[t.ticketId] = el as unknown as HTMLCanvasElement;
                                        }}
                                    />
                                </div>

                                <p className="font-mono text-xs tracking-[0.15em] text-[#0B3B3A]/50">{t.ticketId}</p>

                                <div className="flex w-full gap-2 pt-1">
                                    <button
                                        onClick={() => handleDownload(t.ticketId, t.tierName, t.attendeeName)}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0B3B3A] py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#0B3B3A]/85"
                                    >
                                        <Download size={14} /> Download
                                    </button>
                                    <button
                                        onClick={() => handleShare(t.ticketId, t.tierName, t.attendeeName)}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#0B3B3A]/15 py-2.5 text-xs font-semibold text-[#0B3B3A] transition-colors hover:bg-[#0B3B3A]/5"
                                    >
                                        <Share2 size={14} /> Share
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <button onClick={onDone} className="mt-2 text-sm font-medium text-slate-500 underline">
                    Back to events
                </button>
            </div>
        </div>
    );
};

export default TicketConfirmation;