import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    CalendarPlus,
    Check,
    ChevronRight,
    Download,
    FileDown,
    Mail,
    MapPin,
    Phone,
    Share2,
    Ticket,
    X,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { stripHtmlTags } from '../lib/utils';
import { buildAcknowledgementPdf, type AcknowledgementTicketData, type AcknowledgementEventData } from '../lib/ticketPdf';
import {
    DEFAULT_ACCENT,
    MONTHS,
    WEEKDAYS,
    buildCalendarUrl,
    buildDirectionsUrl,
    extractAccentColor,
    formatAmount,
    formatClock,
    formatDayMonth,
    formatFullDate,
    htmlToPlainLines,
    maskEmail,
    maskPhone,
    parseIsoDate,
    rgbToCss,
} from '../lib/ticketFormat';
import { OUTSOLD_SITE_URL } from './brand/PoweredByOutsold';
import { toPasses, type TicketPass as Pass } from '../lib/ticketPasses';

interface PurchasedTicket {
    ticketId: string;
    tierName: string;
    attendeeName: string;
    accessCode?: string;
    attendeeEmail?: string;   // "Ticket holder" contact line
    attendeePhone?: string;
    amountPaid?: number;      // "Paid via ..." fact
    paymentMode?: string;
    purchasedAt?: number;     // ms epoch, "Booked on" fact
    createdAt?: number;       // fallback when purchasedAt is missing
    status?: 'valid' | 'checked_in' | 'cancelled'; // Confirmed/Cancelled pill
    bookingGroupId?: string | null; // same-name tickets in one order share one pass
}

// One QR "pass" per holder (see lib/ticketPasses).
type TicketPass = Pass<PurchasedTicket>;

interface TicketConfirmationProps {
    eventTitle: string;
    eventCategory?: string;
    eventDate: string;
    eventTime?: string;
    eventVenue?: string;
    tickets: PurchasedTicket[];
    onDone: () => void;
    eventPosterUrl?: string | null;       // organiser poster for the ticket hero
    eventBannerDataUrl?: string | null;   // pre-composited PDF hero (also used for the accent colour)
    eventConsentText?: string;
    eventGoodToKnowText?: string;
    eventIsOnline?: boolean;
    eventIsPrivate?: boolean;
    eventArriveBy?: string | null;
    eventAgeLimit?: string | null;
    eventHelplineNumber?: string | null;
    bookMoreTicketsUrl?: string | null;
    emailedTo?: string[];                 // buyer addresses the tickets are being emailed to (checkout only)
    autoDownload?: boolean;               // save the ticket PDF(s) once, right after purchase (checkout only)
}

// How long auto-download waits for the PDF hero image before saving without it.
const AUTO_DOWNLOAD_BANNER_WAIT_MS = 3000;
// sharingId while the whole order is being shared (ticketIds never collide with it).
const SHARE_ALL_KEY = '__all__';

const LABEL_ON_INK = 'brand-label text-[#b9b2a6]';
const LABEL = 'brand-label text-[var(--brand-muted)]';

const TicketConfirmation: React.FC<TicketConfirmationProps> = ({
    eventTitle,
    eventCategory,
    eventDate,
    eventTime,
    eventVenue,
    tickets,
    onDone,
    eventPosterUrl,
    eventBannerDataUrl,
    eventConsentText,
    eventGoodToKnowText,
    eventIsOnline,
    eventIsPrivate,
    eventArriveBy,
    eventAgeLimit,
    eventHelplineNumber,
    bookMoreTicketsUrl,
    emailedTo,
    autoDownload,
}) => {
    const cleanEventTitle = stripHtmlTags(eventTitle) || 'Event';
    const passes = useMemo(() => toPasses(tickets), [tickets]);
    const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

    // Strip under the poster takes the poster's own dominant colour.
    const [accent, setAccent] = useState(rgbToCss(DEFAULT_ACCENT));
    useEffect(() => {
        if (!eventBannerDataUrl) return;
        let cancelled = false;
        extractAccentColor(eventBannerDataUrl).then((rgb) => {
            if (!cancelled) setAccent(rgbToCss(rgb));
        });
        return () => { cancelled = true; };
    }, [eventBannerDataUrl]);

    const buildEventDataForPdf = (): AcknowledgementEventData => ({
        eventTitle,
        eventCategory,
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
        admits: t.admits,
        ticketIds: t.memberIds,
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

    // Opens the share sheet with the passes' PDFs; saves them instead where the
    // browser can't share files. `key` is the ticketId, or SHARE_ALL_KEY.
    const sharePasses = async (list: TicketPass[], key: string) => {
        if (sharingId === key) return; // prevent double-tap re-entry
        setSharingId(key);
        try {
            const docs = await Promise.all(list.map((t) =>
                buildAcknowledgementPdf(buildTicketDataForPdf(t), buildEventDataForPdf(), canvasRefs.current[t.ticketId] ?? null)
            ));
            const files = docs.map((doc, i) =>
                new File([doc.output('blob')], `${list[i].ticketId}-receipt.pdf`, { type: 'application/pdf' })
            );
            if (typeof navigator.share === 'function' && navigator.canShare?.({ files })) {
                try {
                    await navigator.share({ files });
                    return;
                } catch (err) {
                    if ((err as Error)?.name === 'AbortError') return; // user backed out of the share sheet themselves
                }
            }
            docs.forEach((doc, i) => doc.save(files[i].name));
        } finally {
            setSharingId(null);
        }
    };
    const handleShare = (t: TicketPass) => sharePasses([t], t.ticketId);
    const handleDownloadAllPdf = async () => {
        await Promise.all(passes.map((t) => handleDownload(t)));
    };

    // Save the PDF(s) once, as soon as the page shows. Runs after render so the
    // QR canvases exist; waits briefly for the hero image so the PDF isn't
    // missing it, then saves anyway.
    const autoDownloadedRef = useRef(false);
    useEffect(() => {
        if (!autoDownload || autoDownloadedRef.current || passes.length === 0) return;
        const run = () => {
            if (autoDownloadedRef.current) return;
            autoDownloadedRef.current = true;
            handleDownloadAllPdf().catch((err) => console.warn('Ticket auto-download failed:', err));
        };
        if (eventBannerDataUrl) {
            run();
            return;
        }
        const timer = setTimeout(run, AUTO_DOWNLOAD_BANNER_WAIT_MS);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoDownload, eventBannerDataUrl, passes]);

    // ── Event facts shared by every pass ──
    const dateObj = parseIsoDate(eventDate);
    const category = eventCategory && eventCategory.toLowerCase() !== 'other' ? eventCategory : '';
    const subtitle = [category, eventIsOnline ? 'Online' : ''].filter(Boolean).join(' · ');
    const venueLabel = eventIsOnline ? 'Online' : eventVenue || 'TBA';
    const gatesTime = formatClock(eventArriveBy);
    const startTime = formatClock(eventTime);
    const timeFact = gatesTime
        ? { label: 'Gates open', value: gatesTime }
        : startTime
            ? { label: 'Starts', value: startTime }
            : null;
    const whenLabel = [dateObj ? formatDayMonth(dateObj) : '', startTime].filter(Boolean).join(' · ');
    const directionsUrl = eventVenue && !eventIsOnline ? buildDirectionsUrl(eventVenue) : null;
    const calendarUrl = dateObj
        ? buildCalendarUrl(cleanEventTitle, dateObj, eventTime, eventIsOnline ? 'Online' : eventVenue || '')
        : null;
    const bookMoreUrl = bookMoreTicketsUrl && !eventIsPrivate ? bookMoreTicketsUrl : null;
    const goodToKnow = eventGoodToKnowText ? htmlToPlainLines(eventGoodToKnowText) : '';
    const ticketCount = `${tickets.length} ticket${tickets.length === 1 ? '' : 's'}`;
    const multi = passes.length > 1;
    const pageWidth = 'max-w-[440px] @2xl:max-w-4xl @4xl:max-w-6xl';

    const hero = eventPosterUrl ? (
        <>
            <div className="relative flex h-[196px] items-center justify-center overflow-hidden bg-[var(--brand-black)] @2xl/tickets:h-[232px]">
                <img
                    src={eventPosterUrl}
                    alt=""
                    aria-hidden="true"
                    className="absolute -left-5 -top-5 h-[calc(100%+40px)] w-[calc(100%+40px)] max-w-none object-cover opacity-55 blur-2xl"
                />
                <img
                    src={eventPosterUrl}
                    alt={`${cleanEventTitle} poster`}
                    className="relative h-[172px] w-auto max-w-[calc(100%-32px)] rounded-lg object-cover shadow-[0_6px_20px_rgba(0,0,0,0.35)] @2xl/tickets:h-[208px]"
                />
            </div>
            <div aria-hidden="true" className="h-1.5" style={{ background: accent }} />
        </>
    ) : (
        <div className="relative flex h-[196px] flex-col justify-end overflow-hidden bg-[var(--brand-yellow)] p-5 @2xl/tickets:h-[232px]">
            <div aria-hidden="true" className="absolute -right-9 -top-9 h-40 w-40 rounded-full border-2 border-[rgba(20,18,15,0.9)]" />
            <div aria-hidden="true" className="absolute right-11 top-11 h-16 w-16 rounded-full bg-[var(--brand-teal)]" />
            {category && <p className="brand-label relative">{category}</p>}
            <p
                className={`brand-display relative mt-1.5 line-clamp-2 break-words pr-12 ${
                    cleanEventTitle.length > 22 ? 'text-[38px] leading-[38px]' : 'text-[52px] leading-[50px]'
                }`}
            >
                {cleanEventTitle}
            </p>
        </div>
    );

    return (
        <div className="brand-theme @container flex w-full flex-col bg-[var(--brand-cream)] text-[15px] leading-[22px] text-[var(--brand-black)]">
            <header className="border-b border-[var(--brand-line)] bg-[var(--brand-surface)] px-4">
                <div className={`mx-auto flex h-16 w-full items-center gap-2 ${pageWidth}`}>
                    <button
                        type="button"
                        onClick={onDone}
                        aria-label="Back to all events"
                        className="-ml-2.5 flex h-11 w-11 items-center justify-center rounded-lg text-[var(--brand-black)] hover:bg-[var(--brand-skeleton)] focus-visible:outline-2 focus-visible:outline-[var(--brand-teal)]"
                    >
                        <ArrowLeft size={20} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    <h1 className="brand-display text-[22px] leading-6">
                        You&rsquo;re <span className="text-[var(--brand-teal)]">in.</span>
                    </h1>
                </div>
            </header>

            <main
                className={`mx-auto grid w-full grid-cols-1 items-start gap-4 p-4 @4xl:grid-cols-[minmax(0,1fr)_340px] @4xl:gap-6 @4xl:py-8 ${pageWidth}`}
            >
                <div className="@container/tickets flex min-w-0 flex-col gap-4">
                    {emailedTo && emailedTo.length > 0 && (
                        <div className="flex items-start gap-3 rounded-xl border border-[var(--brand-line)] bg-[var(--brand-surface)] px-4 py-3">
                            <Mail size={18} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--brand-teal)]" />
                            <p className="min-w-0 text-[13px] text-[var(--brand-muted)]">
                                We&rsquo;re emailing your {passes.length === 1 ? 'ticket' : 'tickets'} to{' '}
                                <span className="break-all font-semibold text-[var(--brand-black)]">{emailedTo.join(', ')}</span>.
                                It can take a few minutes, so check your spam folder too.
                            </p>
                        </div>
                    )}
                    {autoDownload && (
                        <div className="flex items-start gap-3 rounded-xl border border-[var(--brand-line)] bg-[var(--brand-surface)] px-4 py-3">
                            <FileDown size={18} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--brand-teal)]" />
                            <div className="min-w-0">
                                <p className="text-[13px] text-[var(--brand-muted)]">
                                    Your {passes.length === 1 ? 'ticket is' : 'tickets are'} downloading to this device as PDF.
                                    If nothing downloaded, tap below.
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={handleDownloadAllPdf}
                                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--brand-line-strong)] bg-[var(--brand-surface)] px-4 text-sm font-semibold hover:bg-[var(--brand-cream)]"
                                    >
                                        <FileDown size={18} strokeWidth={1.75} aria-hidden="true" />
                                        Download {passes.length === 1 ? 'ticket' : 'tickets'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => sharePasses(passes, SHARE_ALL_KEY)}
                                        disabled={sharingId === SHARE_ALL_KEY}
                                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--brand-line-strong)] bg-[var(--brand-surface)] px-4 text-sm font-semibold hover:bg-[var(--brand-cream)] disabled:text-[var(--brand-muted)]"
                                    >
                                        <Share2 size={18} strokeWidth={1.75} aria-hidden="true" />
                                        {sharingId === SHARE_ALL_KEY ? 'Sharing…' : 'Share'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {multi && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--brand-line)] bg-[var(--brand-surface)] px-4 py-3">
                            <div className="min-w-0">
                                <p className="text-[13px] text-[var(--brand-muted)]">This order</p>
                                <p className="font-semibold">
                                    {ticketCount}
                                    {passes.length < tickets.length && ` · ${passes.length} passes`}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleDownloadAllPdf}
                                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--brand-line-strong)] bg-[var(--brand-surface)] px-4 text-sm font-semibold hover:bg-[var(--brand-cream)]"
                            >
                                <FileDown size={18} strokeWidth={1.75} aria-hidden="true" /> Download all
                            </button>
                        </div>
                    )}

                    <div className="flex flex-col gap-4">
                        {passes.map((t) => {
                            const cancelled = t.status === 'cancelled';
                            const contact = [
                                t.attendeeEmail ? maskEmail(t.attendeeEmail) : '',
                                t.attendeePhone ? maskPhone(t.attendeePhone) : '',
                            ].filter(Boolean).join(' · ');
                            const bookedMs = t.purchasedAt ?? t.createdAt;
                            return (
                                <article
                                    key={t.ticketId}
                                    aria-label={`Ticket for ${cleanEventTitle}`}
                                    className="relative overflow-hidden rounded-xl border border-[var(--brand-line)] bg-[var(--brand-surface)] shadow-[var(--brand-shadow-raise)] @2xl/tickets:flex"
                                >
                                    <div className="flex min-w-0 flex-col @2xl/tickets:flex-1">
                                        {hero}

                                        {/* Event block on ink */}
                                        <div className="flex flex-col gap-[18px] bg-[var(--brand-black)] px-5 pb-[22px] pt-5 text-[var(--brand-cream)] @2xl/tickets:flex-1">
                                            <div className="flex items-center justify-between">
                                                <span className={LABEL_ON_INK}>E-ticket</span>
                                                {cancelled ? (
                                                    <span className="brand-label inline-flex h-[26px] items-center gap-1.5 rounded-full border border-[rgba(248,113,113,0.45)] px-2.5 text-[#f87171]">
                                                        <X size={14} strokeWidth={2.25} aria-hidden="true" />Cancelled
                                                    </span>
                                                ) : (
                                                    <span className="brand-label inline-flex h-[26px] items-center gap-1.5 rounded-full border border-[rgba(45,212,191,0.45)] px-2.5 text-[var(--brand-teal-light)]">
                                                        <Check size={14} strokeWidth={2.25} aria-hidden="true" />Confirmed
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-stretch gap-4">
                                                <div className="flex w-[76px] flex-none flex-col items-center justify-center rounded-lg bg-[var(--brand-yellow)] pb-2 pt-2.5 text-[var(--brand-black)]">
                                                    <span className="brand-label">{dateObj ? WEEKDAYS[dateObj.getDay()] : 'Date'}</span>
                                                    <span className="brand-display text-[44px] leading-[46px] tracking-normal">
                                                        {dateObj ? dateObj.getDate() : '--'}
                                                    </span>
                                                    <span className="brand-display text-[17px] leading-[18px] tracking-[0.04em]">
                                                        {dateObj ? MONTHS[dateObj.getMonth()] : 'TBA'}
                                                    </span>
                                                </div>
                                                <div className="flex min-w-0 flex-col justify-center gap-1.5">
                                                    <h2 className="brand-display break-words text-[34px] leading-[34px] text-[var(--brand-cream)] [text-wrap:balance]">
                                                        {cleanEventTitle}
                                                    </h2>
                                                    {subtitle && (
                                                        <p className="text-[15px] font-semibold leading-5 text-[var(--brand-teal-light)]">{subtitle}</p>
                                                    )}
                                                </div>
                                            </div>

                                            <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                                                {timeFact && (
                                                    <div>
                                                        <dt className={LABEL_ON_INK}>{timeFact.label}</dt>
                                                        <dd className="mt-1 text-base font-bold tabular-nums">{timeFact.value}</dd>
                                                    </div>
                                                )}
                                                <div>
                                                    <dt className={LABEL_ON_INK}>Admits</dt>
                                                    <dd className="mt-1 text-base font-bold tabular-nums">
                                                        {t.admits} {t.admits === 1 ? 'person' : 'people'}
                                                    </dd>
                                                </div>
                                                <div className="col-span-2">
                                                    <dt className={LABEL_ON_INK}>Venue</dt>
                                                    <dd className="mt-1 break-words text-base font-bold">{venueLabel}</dd>
                                                </div>
                                            </dl>
                                        </div>

                                        {/* Holder */}
                                        <div className="flex items-start justify-between gap-3 p-5">
                                            <div className="min-w-0">
                                                <p className={LABEL}>Ticket holder</p>
                                                <p className="mt-1 break-words text-[22px] font-bold leading-7">{t.attendeeName || 'Guest'}</p>
                                                {contact && (
                                                    <p className="mt-0.5 text-[13px] font-medium leading-[18px] text-[var(--brand-muted)] tabular-nums">{contact}</p>
                                                )}
                                            </div>
                                            <span className="brand-display inline-flex h-[30px] max-w-[50%] flex-none items-center rounded-full bg-[var(--brand-yellow)] px-3 text-[15px] tracking-[0.04em]">
                                                <span className="truncate">{t.tierName}</span>
                                            </span>
                                        </div>

                                    </div>

                                    {/* Perforation: across the card when stacked, down it when sideways */}
                                    <div aria-hidden="true" className="relative h-6 @2xl/tickets:hidden">
                                        <div className="absolute inset-x-5 top-[11px] border-t-2 border-dashed border-[rgba(20,18,15,0.18)]" />
                                        <div className="absolute -left-[13px] top-0 h-6 w-6 rounded-full bg-[var(--brand-cream)] shadow-[inset_-1px_0_0_rgba(20,18,15,0.12)]" />
                                        <div className="absolute -right-[13px] top-0 h-6 w-6 rounded-full bg-[var(--brand-cream)] shadow-[inset_1px_0_0_rgba(20,18,15,0.12)]" />
                                    </div>
                                    <div aria-hidden="true" className="relative hidden w-6 flex-none @2xl/tickets:block">
                                        <div className="absolute inset-y-5 left-[11px] border-l-2 border-dashed border-[rgba(20,18,15,0.18)]" />
                                        <div className="absolute -top-[13px] left-0 h-6 w-6 rounded-full bg-[var(--brand-cream)] shadow-[inset_0_-1px_0_rgba(20,18,15,0.12)]" />
                                        <div className="absolute -bottom-[13px] left-0 h-6 w-6 rounded-full bg-[var(--brand-cream)] shadow-[inset_0_1px_0_rgba(20,18,15,0.12)]" />
                                    </div>

                                    <div className="flex flex-col @2xl/tickets:w-[320px] @2xl/tickets:flex-none">
                                        {/* QR + payment + actions */}
                                        <div className="flex flex-col items-center gap-3 px-5 pb-5 pt-4 text-center @2xl/tickets:flex-1 @2xl/tickets:justify-center @2xl/tickets:pt-6">
                                            <div className="relative rounded-xl border border-[var(--brand-line)] bg-white p-3.5">
                                                <QRCodeCanvas
                                                    value={t.ticketId}
                                                    size={352}
                                                    style={{ display: 'block', width: 176, height: 176 }}
                                                    ref={(el) => {
                                                        canvasRefs.current[t.ticketId] = el as unknown as HTMLCanvasElement;
                                                    }}
                                                />
                                                {cancelled && (
                                                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/80">
                                                        <span className="brand-display rounded-md bg-[var(--brand-danger)] px-3 py-1.5 text-xl text-white">Cancelled</span>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="brand-label break-all tabular-nums">{t.ticketId}</p>
                                            <p className="text-[13px] font-medium leading-[18px] text-[var(--brand-muted)]">
                                                Show this at the gate. Turn your brightness up. One scan per ticket.
                                            </p>

                                            {t.admits > 1 && (
                                                <div className="w-full rounded-lg bg-[var(--brand-discover-bg)] px-3 py-2.5 ring-1 ring-inset ring-[var(--brand-yellow)]">
                                                    <p className="text-sm font-semibold">Group pass, admits {t.admits}</p>
                                                    <p className="mt-0.5 text-[13px] leading-[18px] text-[var(--brand-muted)]">
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

                                            <dl className="mt-1 grid w-full grid-cols-2 border-t border-[var(--brand-line)] pt-3.5 text-left">
                                                <div>
                                                    <dt className={LABEL}>{t.paymentMode ? `Paid via ${t.paymentMode}` : 'Amount paid'}</dt>
                                                    <dd className="mt-1 font-bold tabular-nums">{formatAmount(t.amountPaid, '₹')}</dd>
                                                </div>
                                                <div>
                                                    <dt className={LABEL}>Booked on</dt>
                                                    <dd className="mt-1 font-bold tabular-nums">{bookedMs ? formatFullDate(new Date(bookedMs)) : '—'}</dd>
                                                </div>
                                            </dl>

                                            <div className="mt-1 flex w-full gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDownload(t)}
                                                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--brand-black)] text-[15px] font-semibold text-[var(--brand-cream)] hover:bg-[#2b2925] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]"
                                                >
                                                    <Download size={20} strokeWidth={1.75} aria-hidden="true" /> Download
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleShare(t)}
                                                    disabled={sharingId === t.ticketId}
                                                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--brand-line-strong)] bg-[var(--brand-surface)] text-[15px] font-semibold hover:bg-[var(--brand-cream)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)] disabled:text-[var(--brand-muted)]"
                                                >
                                                    <Share2 size={20} strokeWidth={1.75} aria-hidden="true" /> {sharingId === t.ticketId ? 'Sharing…' : 'Share'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <a
                                            href={OUTSOLD_SITE_URL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between gap-3 border-t border-[var(--brand-line)] bg-[var(--brand-cream)] px-5 py-3"
                                        >
                                            <span className="text-[13px] font-medium leading-[18px] text-[var(--brand-muted)]">Ticketing by</span>
                                            <img src="/Outsold.png" alt="Outsold" className="block h-auto w-24" />
                                        </a>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </div>

                <aside className="grid grid-cols-1 items-start gap-4 @2xl:grid-cols-2 @4xl:sticky @4xl:top-6 @4xl:grid-cols-1">
                    {(directionsUrl || calendarUrl || eventHelplineNumber) && (
                        <section
                            aria-label="Plan your visit"
                            className="divide-y divide-[var(--brand-line)] overflow-hidden rounded-xl border border-[var(--brand-line)] bg-[var(--brand-surface)]"
                        >
                            {directionsUrl && (
                                <PlanRow href={directionsUrl} icon={MapPin} title="Get directions" detail={venueLabel} external />
                            )}
                            {calendarUrl && (
                                <PlanRow href={calendarUrl} icon={CalendarPlus} title="Add to calendar" detail={whenLabel} external />
                            )}
                            {eventHelplineNumber && (
                                <PlanRow
                                    href={`tel:${eventHelplineNumber.replace(/\s+/g, '')}`}
                                    icon={Phone}
                                    title="Contact the organiser"
                                    detail={eventHelplineNumber}
                                />
                            )}
                        </section>
                    )}

                    {(eventAgeLimit || goodToKnow) && (
                        <section
                            aria-labelledby="ticket-before-you-go"
                            className="flex flex-col gap-3.5 rounded-xl border border-[var(--brand-line)] bg-[var(--brand-surface)] p-5"
                        >
                            <h2 id="ticket-before-you-go" className="brand-display text-2xl leading-[26px]">Before you go</h2>
                            {eventAgeLimit && (
                                <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--brand-discover-bg)] px-3.5 py-3 font-semibold">
                                    <span>Age limit</span>
                                    <span>{eventAgeLimit}</span>
                                </div>
                            )}
                            {goodToKnow && (
                                <div>
                                    <p className={LABEL}>From the organiser</p>
                                    <p className="mt-1.5 whitespace-pre-line">{goodToKnow}</p>
                                </div>
                            )}
                        </section>
                    )}

                    {bookMoreUrl && (
                        <a
                            href={bookMoreUrl}
                            className="flex h-12 items-center justify-center gap-2 rounded-lg border border-[var(--brand-line-strong)] font-semibold @2xl:col-span-2 @4xl:col-span-1 hover:bg-[var(--brand-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]"
                        >
                            <Ticket size={20} strokeWidth={1.75} aria-hidden="true" /> Book more tickets
                        </a>
                    )}
                </aside>
            </main>
        </div>
    );
};

const PlanRow: React.FC<{
    href: string;
    icon: React.ElementType;
    title: string;
    detail: string;
    external?: boolean;
}> = ({ href, icon: Icon, title, detail, external }) => (
    <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-[var(--brand-cream)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--brand-teal)]"
    >
        <Icon size={20} strokeWidth={1.75} className="shrink-0 text-[var(--brand-teal)]" aria-hidden="true" />
        <span className="min-w-0 flex-1">
            <span className="block font-semibold">{title}</span>
            {detail && <span className="block truncate text-[13px] leading-[18px] text-[var(--brand-muted)]">{detail}</span>}
        </span>
        <ChevronRight size={16} strokeWidth={1.75} className="shrink-0 text-[var(--brand-muted)]" aria-hidden="true" />
    </a>
);

export default TicketConfirmation;
