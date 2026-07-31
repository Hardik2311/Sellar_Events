import React, { useRef } from 'react';
import { CheckCircle2, Download, Share2, Ticket as TicketIcon } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

interface PurchasedTicket {
    ticketId: string;
    tierName: string;
}

interface TicketConfirmationProps {
    eventTitle: string;
    eventDate: string;
    attendeeName: string;
    tickets: PurchasedTicket[];
    onDone: () => void;
}

const TicketConfirmation: React.FC<TicketConfirmationProps> = ({
    eventTitle,
    eventDate,
    attendeeName,
    tickets,
    onDone,
}) => {
    const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

    const buildTicketCanvas = (ticketId: string, tierName: string): HTMLCanvasElement | null => {
        const qrCanvas = canvasRefs.current[ticketId];
        if (!qrCanvas) return null;

        const width = 360;
        const qrSize = 220;
        const padding = 24;
        const lineHeight = 22;

        // Rough height: padding + title + subtitle + tier + qr + ticketId + padding
        const height = padding + lineHeight * 3 + 12 + qrSize + 12 + lineHeight + padding;

        const out = document.createElement('canvas');
        out.width = width;
        out.height = height;
        const ctx = out.getContext('2d');
        if (!ctx) return null;

        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, width - 2, height - 2);

        let y = padding + lineHeight;

        // Event title
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(eventTitle, width / 2, y);
        y += lineHeight;

        // Event date
        ctx.fillStyle = '#64748b';
        ctx.font = '13px sans-serif';
        ctx.fillText(eventDate, width / 2, y);
        y += lineHeight;

        // Attendee + tier
        ctx.fillStyle = '#334155';
        ctx.font = '13px sans-serif';
        ctx.fillText(`${attendeeName} · ${tierName}`, width / 2, y);
        y += 12;

        // QR code
        const qrX = (width - qrSize) / 2;
        ctx.drawImage(qrCanvas, qrX, y, qrSize, qrSize);
        y += qrSize + lineHeight;

        // Ticket ID
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px monospace';
        ctx.fillText(ticketId, width / 2, y);

        return out;
    };

    const handleDownload = (ticketId: string, tierName: string) => {
        const canvas = buildTicketCanvas(ticketId, tierName);
        if (!canvas) return;
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `${ticketId}.png`;
        link.click();
    };

    const handleShare = (ticketId: string, tierName: string) => {
        const canvas = buildTicketCanvas(ticketId, tierName);
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

    return (
        <div className="flex min-h-screen w-full flex-col items-center bg-gray-100 p-4">
            <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 py-6">
                <CheckCircle2 size={48} className="text-emerald-500" />
                <h1 className="text-xl font-bold text-slate-800">You're all set!</h1>
                <p className="text-center text-sm text-slate-500">
                    {tickets.length} ticket{tickets.length === 1 ? '' : 's'} for{' '}
                    <span className="font-medium">{eventTitle}</span> — {eventDate}
                </p>

                <div className="flex w-full flex-col gap-4">
                    {tickets.map((t) => (
                        <div key={t.ticketId} className="flex flex-col items-center gap-3 rounded-md border border-gray-200 bg-white p-4">
                            <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                                <TicketIcon size={13} /> {t.tierName}
                            </span>
                            <QRCodeCanvas
                                value={t.ticketId}
                                size={180}
                                includeMargin
                                ref={(el) => {
                                    canvasRefs.current[t.ticketId] = el as unknown as HTMLCanvasElement;
                                }}
                            />
                            <p className="font-mono text-xs text-slate-400">{t.ticketId}</p>

                            <div className="flex w-full gap-2">
                                <button
                                    onClick={() => handleDownload(t.ticketId, t.tierName)}
                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#007A78] py-2 text-xs font-semibold text-white hover:bg-[#2DD4BF]"
                                >
                                    <Download size={14} /> Download
                                </button>
                                <button
                                    onClick={() => handleShare(t.ticketId, t.tierName)}
                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-300 py-2 text-xs font-semibold text-slate-600 hover:bg-gray-50"
                                >
                                    <Share2 size={14} /> Share
                                </button>
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