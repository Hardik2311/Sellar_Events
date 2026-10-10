import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Download, Share2, FileDown, MapPin } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { stripHtmlTags } from '../lib/utils';
import { buildAcknowledgementPdf, type AcknowledgementTicketData, type AcknowledgementEventData } from '../lib/ticketPdf';
import { formatTime } from '../data/events';
import { formatShortDate } from '../lib/storefrontFormat';
import TicketDivider from './brand/TicketDivider';
import PoweredByOutsold from './brand/PoweredByOutsold';
import BrandButton from './brand/BrandButton';
import BrandTag from './brand/BrandTag';

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
    bookingGroupId?: string | null; // NEW — same-name tickets in one order share one pass
}

// One QR "pass" per holder: a group booking (same name, same order) collapses
// into a single pass whose QR is the lead ticket's ID and admits everyone.
interface TicketPass extends PurchasedTicket {
    admits: number;
    memberIds: string[];
}

const toPasses = (tickets: PurchasedTicket[]): TicketPass[] => {
    const groups = new Map<string, PurchasedTicket[]>();
    tickets.forEach((t) => {
        const key = t.bookingGroupId || t.ticketId;
        groups.set(key, [...(groups.get(key) ?? []), t]);
    });
    return Array.from(groups.values()).map((members) => {
        const lead = members[0];
        if (members.length === 1) return { ...lead, admits: 1, memberIds: [lead.ticketId] };
        const tierCounts = new Map<string, number>();
        members.forEach((m) => tierCounts.set(m.tierName, (tierCounts.get(m.tierName) ?? 0) + 1));
        return {
            ...lead,
            tierName: Array.from(tierCounts.entries()).map(([name, n]) => `${name} × ${n}`).join(' + '),
            amountPaid: members.reduce((sum, m) => sum + (m.amountPaid ?? 0), 0),
            admits: members.length,
            memberIds: members.map((m) => m.ticketId),
        };
    });
};

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
    const passes = useMemo(() => toPasses(tickets), [tickets]);
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
    const buildTicketDataForPdf = (t: TicketPass): AcknowledgementTicketData => ({
        ticketId: t.ticketId,
        tierName: t.tierName,
        tierTag: t.admits > 1 ? `Admits ${t.admits}` : undefined,
        attendeeName: t.attendeeName,
        attendeeEmail: t.attendeeEmail,
        attendeePhone: t.attendeePhone,
        amountPaid: t.amountPaid,
        paymentMode: t.paymentMode,
        purchasedAt: t.purchasedAt,
        createdAt: t.createdAt,
        isCancelled: t.status === 'cancelled',
    });

    const handleDownload = async (t: TicketPass) => {
        const canvas = canvasRefs.current[t.ticketId] ?? null;
        const doc = await buildAcknowledgementPdf(buildTicketDataForPdf(t), buildEventDataForPdf(), canvas);
        doc.save(`${t.ticketId}-receipt.pdf`);
    };

    const [sharingId, setSharingId] = useState<string | null>(null);

    const handleShare = async (t: TicketPass) => {
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
        await Promise.all(passes.map((t) => handleDownload(t)));
    };

    const dateLabel = formatShortDate(eventDate);
    const timeLabel = eventTime ? formatTime(eventTime) : '';
    const ticketCount = `${tickets.length} ticket${tickets.length === 1 ? '' : 's'}`;

    return (
        <div className="brand-theme flex w-full flex-col items-center bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-black)] sm:py-10">
            <div className={`mx-auto flex w-full flex-col gap-6 ${passes.length > 1 ? 'max-w-4xl' : 'max-w-xl'}`}>
                {/* Hero */}
                <div className="flex w-full flex-col items-center gap-2.5 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-teal)] text-[var(--brand-cream)]">
                        <Check size={28} strokeWidth={2.5} aria-hidden="true" />
                    </span>
                    <h1 className="brand-display text-[32px] leading-none sm:text-[44px]">
                        You&rsquo;re <span className="text-[var(--brand-teal)]">in.</span>
                    </h1>
                    <p className="max-w-[44ch] text-[15px] leading-[22px] text-[var(--brand-muted)]">
                        {ticketCount} for <span className="font-semibold text-[var(--brand-black)]">{cleanEventTitle}</span>
                        {[dateLabel, timeLabel].filter(Boolean).length > 0 && `, ${[dateLabel, timeLabel].filter(Boolean).join(', ')}`}.
                    </p>
                </div>

                {/* Order bar */}
                <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--brand-line)] bg-[var(--brand-surface)] px-4 py-3">
                    <div className="min-w-0">
                        <p className="text-[13px] text-[var(--brand-muted)]">This order</p>
                        <p className="text-[15px] font-semibold">
                            {ticketCount}
                            {passes.length < tickets.length && ` · ${passes.length} pass${passes.length === 1 ? '' : 'es'}`}
                        </p>
                    </div>
                    <BrandButton variant="secondary" size="sm" onClick={handleDownloadAllPdf}>
                        <FileDown size={18} /> Download all
                    </BrandButton>
                </div>

                {/* Ticket stubs, one per pass */}
                <div className={`grid w-full grid-cols-1 gap-5 ${passes.length > 1 ? 'md:grid-cols-2' : ''}`}>
                    {passes.map((t) => (
                        <div key={t.ticketId} className="w-full overflow-hidden rounded-xl border border-[var(--brand-line)] bg-[var(--brand-surface)]">
                            {/* Head */}
                            <div className="bg-[var(--brand-black)] px-5 pt-5 pb-5 text-[var(--brand-cream)]">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="brand-label text-[#c9c4b8]">E-ticket</span>
                                    <BrandTag variant="featured" className="max-w-[65%] truncate">{t.tierName}</BrandTag>
                                </div>

                                <p className="brand-display mt-3 text-[26px] leading-[1.05]">{cleanEventTitle}</p>

                                {(eventIsOnline || eventVenue) && (
                                    <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-[#c9c4b8]">
                                        <MapPin size={14} className="shrink-0" aria-hidden="true" /> {eventIsOnline ? 'Online' : eventVenue}
                                    </p>
                                )}

                                <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-3">
                                    <div className="min-w-0">
                                        <dt className="brand-label text-[#c9c4b8]">Attendee</dt>
                                        <dd className="mt-1 truncate text-sm font-semibold">{t.attendeeName || 'TBA'}</dd>
                                    </div>
                                    <div className="min-w-0">
                                        <dt className="brand-label text-[#c9c4b8]">Date</dt>
                                        <dd className="mt-1 truncate text-sm font-semibold">{dateLabel || 'TBA'}</dd>
                                    </div>
                                    <div className="min-w-0">
                                        <dt className="brand-label text-[#c9c4b8]">Time</dt>
                                        <dd className="mt-1 truncate text-sm font-semibold">{timeLabel || 'TBA'}</dd>
                                    </div>
                                </dl>
                            </div>

                            {/* Perforation */}
                            <div className="relative h-6 bg-[var(--brand-surface)]">
                                <TicketDivider notchColor="var(--brand-cream)" className="absolute inset-x-0 top-1/2" />
                            </div>

                            {/* Body */}
                            <div className="flex flex-col items-center gap-3 px-5 pb-5">
                                <div className="rounded-lg border border-[var(--brand-line)] bg-white p-2.5">
                                    <QRCodeCanvas
                                        value={t.ticketId}
                                        size={340}
                                        includeMargin
                                        style={{ width: 168, height: 168 }}
                                        ref={(el) => {
                                            canvasRefs.current[t.ticketId] = el as unknown as HTMLCanvasElement;
                                        }}
                                    />
                                </div>

                                <p className="brand-label text-[var(--brand-black)]">{t.ticketId}</p>
                                <p className="text-[13px] text-[var(--brand-muted)]">Scan at entry. Non-transferable.</p>

                                {t.admits > 1 && (
                                    <div className="w-full rounded-lg bg-[var(--brand-discover-bg)] px-3 py-2.5 text-center ring-1 ring-inset ring-[var(--brand-yellow)]">
                                        <p className="text-sm font-semibold">Group pass, admits {t.admits}</p>
                                        <p className="mt-0.5 text-[13px] text-[var(--brand-muted)]">
                                            One QR for all {t.admits} tickets. Show it once at the entrance.
                                        </p>
                                        <p className="brand-label mt-1.5 break-words text-[var(--brand-muted)]">{t.memberIds.join(', ')}</p>
                                    </div>
                                )}

                                {t.accessCode && (
                                    <p className="text-[13px] text-[var(--brand-muted)]">
                                        Access code: <span className="brand-label text-[var(--brand-black)]">{t.accessCode}</span>
                                    </p>
                                )}

                                <div className="flex w-full gap-3 pt-1">
                                    <BrandButton variant="primary" className="flex-1" onClick={() => handleDownload(t)}>
                                        <Download size={18} /> Download
                                    </BrandButton>
                                    <BrandButton
                                        variant="secondary"
                                        className="flex-1"
                                        onClick={() => handleShare(t)}
                                        disabled={sharingId === t.ticketId}
                                    >
                                        <Share2 size={18} /> {sharingId === t.ticketId ? 'Sharing…' : 'Share'}
                                    </BrandButton>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col items-center gap-4 pt-2">
                    <BrandButton variant="link" onClick={onDone} className="!text-[var(--brand-black)]">
                        <ArrowLeft size={18} /> All events
                    </BrandButton>
                    <PoweredByOutsold />
                </div>
            </div>
        </div>
    );
};

export default TicketConfirmation;
