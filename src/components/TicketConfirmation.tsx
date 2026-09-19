import React, { useRef, useState } from 'react';
import { CheckCircle2, Download, Share2, Ticket as TicketIcon, FileDown, MapPin } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { stripHtmlTags } from '../lib/utils';
import { shareTicketImage } from '../lib/shareTicket';
import { buildAcknowledgementPdf, type AcknowledgementTicketData, type AcknowledgementEventData } from '../lib/ticketPdf';

interface PurchasedTicket {
    ticketId: string;
    tierName: string;
    attendeeName: string;
    accessCode?: string;
    attendeeEmail?: string;   // NEW — "TICKET HOLDER" contact line in the PDF
    attendeePhone?: string;   // NEW
    amountPaid?: number;      // NEW — "PAID VIA ..." facts row
    paymentMode?: string;     // NEW
    purchasedAt?: number;     // NEW — ms epoch, "BOOKED" fact
    createdAt?: number;       // NEW — fallback when purchasedAt is missing
    status?: 'valid' | 'checked_in' | 'cancelled'; // NEW — Confirmed/Cancelled pill
}

interface TicketConfirmationProps {
    eventTitle: string;
    eventDate: string;
    eventTime?: string;
    eventVenue?: string;
    tickets: PurchasedTicket[];
    onDone: () => void;
    eventBannerDataUrl?: string | null;
    eventConsentText?: string;
    eventGoodToKnowText?: string;   // NEW
    eventIsOnline?: boolean;        // NEW
    eventIsPrivate?: boolean;       // NEW
    eventArriveBy?: string | null;
    eventAgeLimit?: string | null;
    eventHelplineNumber?: string | null;
    bookMoreTicketsUrl?: string | null;
}

const TicketConfirmation: React.FC<TicketConfirmationProps> = ({
    eventTitle,
    eventDate,
    eventTime,
    eventVenue,
    tickets,
    onDone,
    eventBannerDataUrl,
    eventConsentText,
    eventGoodToKnowText,
    eventIsOnline,
    eventIsPrivate,
    eventArriveBy,
    eventAgeLimit,
    eventHelplineNumber,
    bookMoreTicketsUrl,
}) => {
    const cleanEventTitle = stripHtmlTags(eventTitle);
    const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

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
    const buildTicketDataForPdf = (t: PurchasedTicket): AcknowledgementTicketData => ({
        ticketId: t.ticketId,
        tierName: t.tierName,
        attendeeName: t.attendeeName,
        attendeeEmail: t.attendeeEmail,
        attendeePhone: t.attendeePhone,
        amountPaid: t.amountPaid,
        paymentMode: t.paymentMode,
        purchasedAt: t.purchasedAt,
        createdAt: t.createdAt,
        isCancelled: t.status === 'cancelled',
    });

    const handleDownload = async (t: PurchasedTicket) => {
        const canvas = canvasRefs.current[t.ticketId] ?? null;
        const doc = await buildAcknowledgementPdf(buildTicketDataForPdf(t), buildEventDataForPdf(), canvas);
        doc.save(`${t.ticketId}-receipt.pdf`);
    };

    const [sharingId, setSharingId] = useState<string | null>(null);

    const handleShare = async (t: PurchasedTicket) => {
        if (sharingId === t.ticketId) return; // prevent double-tap re-entry
        setSharingId(t.ticketId);
        try {
            const canvas = canvasRefs.current[t.ticketId] ?? null;
            const doc = await buildAcknowledgementPdf(buildTicketDataForPdf(t), buildEventDataForPdf(), canvas);
            const file = new File([doc.output('blob')], `${t.ticketId}-receipt.pdf`, { type: 'application/pdf' });
            if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
                try {
                    await navigator.share({ files: [file] });
                    return;
                } catch (err) {
                    if ((err as Error)?.name === 'AbortError') return; // user backed out of the share sheet themselves
                }
            }
            doc.save(file.name);
        } finally {
            setSharingId(null);
        }
    };
    const handleDownloadAllPdf = async () => {
        await Promise.all(tickets.map((t) => handleDownload(t)));
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
                                        onClick={() => handleDownload(t)}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-sm bg-[#0B3B3A] py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#0B3B3A]/85"
                                    >
                                        <Download size={14} /> Download
                                    </button>
                                    <button
                                        onClick={() => handleShare(t)}
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