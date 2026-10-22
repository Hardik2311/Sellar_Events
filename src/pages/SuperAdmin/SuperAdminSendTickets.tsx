import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Loader2, Mail, RefreshCw, Search, Send, Square, XCircle } from 'lucide-react';
import { db } from '../../lib/firebase';
import { buildEventSlugId } from '../../data/events';
import { getShareBaseUrl } from '../../lib/shareLinks';
import { stripHtmlTags } from '../../lib/utils';
import { useAttendees } from '../../hooks/useAttendees';
import type { Attendee } from '../../types/attendee.types';
import { buildAcknowledgementPdf, loadTicketPdfHero, type AcknowledgementEventData, type AcknowledgementTicketData } from '../../lib/ticketPdf';
import { toPasses, type TicketPass } from '../../lib/ticketPasses';
import { markTicketEmails, pdfToBase64, sendTicketEmail } from '../../lib/ticketEmail';

// Super Admin → Send Tickets: emails every attendee of one event their ticket
// PDF (the same PDF as the in-app download) from the platform Gmail account.
// Sending runs from this tab, one email at a time; each attendee doc records
// ticketEmail, so new bookings show up as Pending and re-runs skip sent ones.

const inputClass =
  'w-full rounded-sm border border-slate-200 dark:border-slate-700 bg-[#F9FAFB] dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#007A78]';
const labelClass = 'block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1';
const cardClass = 'bg-white dark:bg-[#1E293B] rounded-md shadow-sm border border-slate-200 dark:border-slate-800 p-4';
const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-sm bg-[#007A78] dark:bg-[#2DD4BF] px-3 py-2 text-xs font-bold text-white dark:text-slate-950 hover:bg-[#006361] disabled:opacity-50';
const secondaryBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-sm border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50';

interface EventOption {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  category: string;
  status: string;
  cover: string;
  consentText?: string;
  goodToKnowText?: string;
  isOnline: boolean;
  isPrivate: boolean;
  arriveByTime: string | null;
  ageLimit: string | null;
  helplineNumber: string | null;
}

type RecipientStatus = 'pending' | 'sent' | 'failed';
type Filter = RecipientStatus | 'all' | 'no_email';

interface Recipient {
  email: string;
  name: string;
  passes: TicketPass<Attendee>[];
  unsent: TicketPass<Attendee>[];
  status: RecipientStatus;
  sentAt?: number;
  error?: string;
}

interface LogLine {
  at: number;
  kind: 'ok' | 'error' | 'info';
  text: string;
}

const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
// A group booking is one PDF for all its tickets, so the pass counts as sent
// once any of its tickets is marked sent (e.g. "Mark as sent" with one ID).
const passSent = (p: TicketPass<Attendee>) => p.members.some((m) => m.ticketEmail?.status === 'sent');
// Common typos that pass the format check but will bounce.
const SUSPICIOUS_EMAIL = /@(gamil|gmial|gmai|gmal|gnail)\.|@gmail\.(co|con|cm|om)$|\.(con|cmo)$|@\d/i;
const passFailed = (p: TicketPass<Attendee>) => p.members.some((m) => m.ticketEmail?.status === 'failed');
const fmtTime = (ms?: number) => (ms ? new Date(ms).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const ticketLabel = (passes: TicketPass<Attendee>[]) => passes.flatMap((p) => p.memberIds).join(', ');

const loadEvents = async (): Promise<EventOption[]> => {
  const companiesSnap = await getDocs(collection(db, 'companies'));
  const perCompany = await Promise.all(
    companiesSnap.docs.map(async (c) => {
      const companyName = (c.data().name as string) || 'Unnamed company';
      try {
        const snap = await getDocs(collection(db, 'companies', c.id, 'events'));
        return snap.docs
          .map((d): EventOption => {
            const data = d.data();
            return {
              id: d.id,
              companyId: c.id,
              companyName,
              title: stripHtmlTags(data.title || '') || 'Untitled event',
              date: data.date || '',
              time: data.time || '',
              venue: data.isOnline ? 'Online' : data.venue || '',
              category: data.category || '',
              status: data.status || 'draft',
              // PDF hero is wide, so desktop cover first (same as Attendees page)
              cover: data.coverImageDesktop || data.coverImageMobile || data.coverImageUrl || '',
              consentText: data.consentText,
              goodToKnowText: data.goodToKnowText,
              isOnline: !!data.isOnline,
              isPrivate: !!data.isPrivate,
              arriveByTime: data.arriveByTime ?? null,
              ageLimit: data.ageLimit ?? null,
              helplineNumber: data.helplineNumber ?? null,
            };
          })
          .filter((e) => e.status !== 'deleted');
      } catch (err) {
        console.error(`Failed to load events for company ${c.id}:`, err);
        return [];
      }
    })
  );
  return perCompany.flat().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
};

const errorCode = (err: unknown) => String((err as { code?: string })?.code ?? '');
const errorMessage = (err: unknown) => {
  const e = err as { message?: string; details?: { message?: string } };
  return e?.details?.message || e?.message || 'Unknown error';
};

const sleep = (ms: number, stopped: () => boolean) =>
  new Promise<void>((resolve) => {
    const started = Date.now();
    const tick = () => (stopped() || Date.now() - started >= ms ? resolve() : setTimeout(tick, 250));
    tick();
  });

const SuperAdminSendTickets: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const companyId = params.get('companyId') || '';
  const eventId = params.get('eventId') || '';

  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventSearch, setEventSearch] = useState('');

  const fetchEvents = useCallback(
    () =>
      loadEvents()
        .then((list) => {
          setEvents(list);
          setEventsError(null);
        })
        .catch((err) => setEventsError(errorMessage(err)))
        .finally(() => setEventsLoading(false)),
    []
  );
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);
  const refreshEvents = () => {
    setEventsLoading(true);
    fetchEvents();
  };

  const event = events.find((e) => e.id === eventId && e.companyId === companyId) ?? null;
  const visibleEvents = useMemo(() => {
    const q = eventSearch.trim().toLowerCase();
    return q ? events.filter((e) => `${e.title} ${e.companyName}`.toLowerCase().includes(q)) : events;
  }, [events, eventSearch]);

  const { attendees, loading: attendeesLoading } = useAttendees(event?.companyId, event?.id);

  // PDF inputs (hero image + "Book more tickets" link) resolved once per event;
  // tagged with the event key so a stale result never applies to another event.
  const [pdfInputs, setPdfInputs] = useState<{ eventKey: string; hero: string | null; bookMoreUrl: string | null } | null>(null);
  const eventKey = event ? `${event.companyId}/${event.id}` : '';
  useEffect(() => {
    if (!event) return;
    let cancelled = false;
    const heroP = event.cover ? loadTicketPdfHero(event.cover).catch(() => null) : Promise.resolve(null);
    const linkP =
      event.status === 'published'
        ? getShareBaseUrl(event.companyId)
            .catch(() => window.location.origin)
            .then((base) => `${base}/e/${buildEventSlugId(event.title, event.id)}`)
        : Promise.resolve(null);
    Promise.all([heroP, linkP]).then(([hero, bookMoreUrl]) => {
      if (!cancelled) setPdfInputs({ eventKey, hero, bookMoreUrl });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey]);
  const pdfReady = !!event && pdfInputs?.eventKey === eventKey;

  // ── Recipients: live tickets → passes (group bookings) → one row per email ──
  const { recipients, noEmail } = useMemo(() => {
    const live = attendees
      .filter((a) => a.status !== 'cancelled')
      // group lead first, so the pass QR is the lead ticket's ID (as on the Attendees page)
      .sort((x, y) => {
        const lx = x.bookingGroupId && x.id === x.bookingGroupId ? 0 : 1;
        const ly = y.bookingGroupId && y.id === y.bookingGroupId ? 0 : 1;
        return lx - ly || x.ticketId.localeCompare(y.ticketId);
      });
    const byEmail = new Map<string, TicketPass<Attendee>[]>();
    const missing: TicketPass<Attendee>[] = [];
    toPasses(live).forEach((p) => {
      const email = (p.email || '').trim().toLowerCase();
      if (!isEmail(email)) return void missing.push(p);
      byEmail.set(email, [...(byEmail.get(email) ?? []), p]);
    });
    const list: Recipient[] = Array.from(byEmail.entries()).map(([email, passes]) => {
      const unsent = passes.filter((p) => !passSent(p));
      const members = passes.flatMap((p) => p.members);
      const failed = unsent.find(passFailed);
      const sentTimes = members.map((m) => m.ticketEmail?.sentAt ?? 0);
      return {
        email,
        name: passes[0].name,
        passes,
        unsent,
        status: unsent.length === 0 ? 'sent' : failed ? 'failed' : 'pending',
        sentAt: Math.max(0, ...sentTimes) || undefined,
        error: failed?.members.find((m) => m.ticketEmail?.status === 'failed')?.ticketEmail?.error,
      };
    });
    list.sort((a, b) => a.passes[0].ticketId.localeCompare(b.passes[0].ticketId));
    return { recipients: list, noEmail: missing };
  }, [attendees]);

  const counts = useMemo(
    () => ({
      all: recipients.length,
      pending: recipients.filter((r) => r.status === 'pending').length,
      failed: recipients.filter((r) => r.status === 'failed').length,
      sent: recipients.filter((r) => r.status === 'sent').length,
      no_email: noEmail.length,
    }),
    [recipients, noEmail]
  );
  // Ticket-level numbers, to match the Attendees page (which counts tickets, not people)
  const ticketCounts = useMemo(() => {
    const ticketsOf = (passes: TicketPass<Attendee>[]) => passes.reduce((n, p) => n + p.members.length, 0);
    const all = ticketsOf(recipients.flatMap((r) => r.passes)) + ticketsOf(noEmail);
    const sent = ticketsOf(recipients.flatMap((r) => r.passes.filter(passSent)));
    return { all, sent, noEmail: ticketsOf(noEmail), cancelled: attendees.filter((a) => a.status === 'cancelled').length };
  }, [recipients, noEmail, attendees]);

  const [filter, setFilter] = useState<Filter>('pending');
  const [search, setSearch] = useState('');
  const visibleRecipients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipients.filter(
      (r) =>
        (filter === 'all' || r.status === filter) &&
        (!q || `${r.name} ${r.email} ${ticketLabel(r.passes)}`.toLowerCase().includes(q))
    );
  }, [recipients, filter, search]);

  // ── Sending ──
  const [batchSize, setBatchSize] = useState(50);
  const [delaySec, setDelaySec] = useState(5);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const stopRef = useRef(false);

  const addLog = (kind: LogLine['kind'], text: string) =>
    setLog((prev) => [{ at: Date.now(), kind, text }, ...prev].slice(0, 300));

  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [running]);

  const buildPdfs = async (passes: TicketPass<Attendee>[]) => {
    if (!event) throw new Error('No event selected');
    const eventData: AcknowledgementEventData = {
      eventTitle: event.title,
      eventCategory: event.category,
      eventDate: event.date,
      eventTime: event.time,
      eventVenue: event.venue,
      eventBannerDataUrl: pdfInputs?.hero ?? null,
      eventConsentText: event.consentText,
      eventGoodToKnowText: event.goodToKnowText,
      eventIsOnline: event.isOnline,
      eventIsPrivate: event.isPrivate,
      eventArriveBy: event.arriveByTime,
      eventAgeLimit: event.ageLimit,
      eventHelplineNumber: event.helplineNumber,
      bookMoreTicketsUrl: pdfInputs?.bookMoreUrl ?? null,
    };
    const pdfs: { filename: string; base64: string }[] = [];
    for (const p of passes) {
      const ticketData: AcknowledgementTicketData = {
        ticketId: p.ticketId,
        tierName: p.tierName,
        admits: p.admits,
        attendeeName: p.name,
        attendeeEmail: p.email,
        attendeePhone: p.phone,
        amountPaid: p.amountPaid,
        // older manual-QR tickets have no paymentMode saved, but manual_qr is always UPI
        paymentMode: p.paymentMode ?? (p.paymentMethod === 'manual_qr' ? 'UPI' : undefined),
        purchasedAt: p.purchasedAt,
        createdAt: p.createdAt,
        isCancelled: false,
      };
      const doc = await buildAcknowledgementPdf(ticketData, eventData, null);
      pdfs.push({ filename: `${p.ticketId}-ticket.pdf`, base64: pdfToBase64(doc) });
    }
    return pdfs;
  };

  /** Sends one recipient. Returns 'stop' when the whole run must halt. */
  const sendOne = async (r: Recipient, opts: { test?: boolean; all?: boolean } = {}): Promise<'ok' | 'error' | 'stop'> => {
    if (!event) return 'stop';
    const passes = opts.all || r.unsent.length === 0 ? r.passes : r.unsent;
    setBusyEmail(r.email);
    try {
      const pdfs = await buildPdfs(passes);
      const res = await sendTicketEmail({
        companyId: event.companyId,
        eventId: event.id,
        attendeeIds: passes.flatMap((p) => p.members.map((m) => m.id)),
        pdfs,
        test: opts.test,
      });
      addLog('ok', `${opts.test ? 'TEST ' : ''}Sent ${ticketLabel(passes)} → ${res.to}`);
      return 'ok';
    } catch (err) {
      const code = errorCode(err);
      const msg = errorMessage(err);
      if (code.endsWith('resource-exhausted')) {
        addLog('error', 'Gmail daily sending limit reached. Stopped. Resume after 24 hours.');
        return 'stop';
      }
      if (code.endsWith('permission-denied') || code.endsWith('unauthenticated') || msg.includes('EMAIL_NOT_CONFIGURED') || msg.includes('App Password')) {
        addLog('error', msg.includes('EMAIL_NOT_CONFIGURED') ? 'Email is not configured (GMAIL_USER / GMAIL_APP_PASSWORD secrets). Stopped.' : `${msg} Stopped.`);
        return 'stop';
      }
      addLog('error', `Failed ${ticketLabel(passes)} (${r.email}): ${msg}`);
      return 'error';
    } finally {
      setBusyEmail(null);
    }
  };

  const runSingle = async (r: Recipient, opts: { test?: boolean; all?: boolean }) => {
    if (running) return;
    setRunning(true);
    await sendOne(r, opts);
    setRunning(false);
  };

  const sendTest = () => {
    const r = recipients.find((x) => x.status !== 'sent') ?? recipients[0];
    if (r) runSingle(r, { test: true });
  };

  const sendPending = async () => {
    if (running) return;
    const queue = recipients.filter((r) => r.status !== 'sent').slice(0, Math.max(1, batchSize));
    if (!queue.length) return;
    if (!window.confirm(`Send ticket emails to ${queue.length} recipient(s) for "${event?.title}"?`)) return;
    stopRef.current = false;
    setRunning(true);
    setProgress({ done: 0, total: queue.length });
    addLog('info', `Started: ${queue.length} recipient(s).`);
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < queue.length; i++) {
      if (stopRef.current) break;
      const result = await sendOne(queue[i]);
      if (result === 'stop') break;
      if (result === 'ok') ok++;
      else failed++;
      setProgress({ done: i + 1, total: queue.length });
      if (i < queue.length - 1) await sleep(Math.max(0, delaySec) * 1000, () => stopRef.current);
    }
    addLog('info', `Finished: ${ok} sent, ${failed} failed${stopRef.current ? ' (stopped)' : ''}.`);
    setRunning(false);
  };

  // ── Mark already sent ──
  const [markText, setMarkText] = useState('');
  const [markBusy, setMarkBusy] = useState(false);
  const [markResult, setMarkResult] = useState<string | null>(null);
  const runMark = async (action: 'sent' | 'clear') => {
    if (!event) return;
    const ticketIds = Array.from(new Set(markText.split(/[\s,;]+/).map((t) => t.trim().toUpperCase()).filter(Boolean)));
    if (!ticketIds.length) return;
    setMarkBusy(true);
    setMarkResult(null);
    try {
      const res = await markTicketEmails({ companyId: event.companyId, eventId: event.id, ticketIds, action });
      setMarkResult(
        `${action === 'sent' ? 'Marked as sent' : 'Cleared'}: ${res.updated}.` +
          (res.notFound.length ? ` Not found: ${res.notFound.join(', ')}` : '')
      );
      if (!res.notFound.length) setMarkText('');
    } catch (err) {
      setMarkResult(`Error: ${errorMessage(err)}`);
    } finally {
      setMarkBusy(false);
    }
  };

  const selectEvent = (value: string) => {
    if (running) return;
    const [c, e] = value.split('/');
    setParams(c && e ? { companyId: c, eventId: e } : {});
    setLog([]);
    setProgress(null);
    setMarkResult(null);
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'failed', label: 'Failed' },
    { key: 'sent', label: 'Sent' },
    { key: 'all', label: 'All' },
    { key: 'no_email', label: 'No email' },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-16">
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-6 py-4 relative">
        <div className="absolute left-6 top-1/2 -translate-y-1/2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Send Tickets</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Email ticket PDFs to every attendee of an event</p>
        </div>
      </header>

      <main className="grow overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto max-w-3xl flex flex-col gap-4">
          {/* Event picker */}
          <section className={cardClass}>
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass}>Event</label>
              <button onClick={refreshEvents} disabled={eventsLoading || running} className="text-xs font-semibold text-[#007A78] dark:text-[#2DD4BF] inline-flex items-center gap-1 disabled:opacity-50">
                <RefreshCw size={12} className={eventsLoading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative sm:w-56">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={eventSearch} onChange={(e) => setEventSearch(e.target.value)} placeholder="Search events" className={`${inputClass} pl-8`} />
              </div>
              <select
                value={event ? eventKey : ''}
                onChange={(e) => selectEvent(e.target.value)}
                disabled={eventsLoading || running}
                className={inputClass}
              >
                <option value="">{eventsLoading ? 'Loading events…' : 'Select an event'}</option>
                {visibleEvents.map((e) => (
                  <option key={`${e.companyId}/${e.id}`} value={`${e.companyId}/${e.id}`}>
                    {e.title} · {e.companyName}{e.date ? ` · ${e.date}` : ''}{e.status !== 'published' ? ` (${e.status})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {eventsError && <p className="mt-2 text-xs text-red-600">{eventsError}</p>}
          </section>

          {event && (
            <>
              {/* Summary + controls */}
              <section className={cardClass}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  {[
                    { label: 'Recipients', value: counts.all, icon: Mail, cls: 'text-slate-700 dark:text-slate-200' },
                    { label: 'Pending', value: counts.pending, icon: Clock, cls: 'text-amber-600 dark:text-amber-400' },
                    { label: 'Sent', value: counts.sent, icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Failed', value: counts.failed, icon: XCircle, cls: 'text-red-600 dark:text-red-400' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-sm border border-slate-200 dark:border-slate-700 px-3 py-2">
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <s.icon size={12} className={s.cls} /> {s.label}
                      </p>
                      <p className={`text-lg font-extrabold ${s.cls}`}>{attendeesLoading ? '–' : s.value}</p>
                    </div>
                  ))}
                </div>
                {!attendeesLoading && (
                  <p className="-mt-2 mb-4 text-[11px] text-slate-500 dark:text-slate-400">
                    Counts are people (one email each, all their tickets attached). Tickets: <b>{ticketCounts.all}</b> live
                    {' · '}<b>{ticketCounts.sent}</b> sent
                    {ticketCounts.noEmail > 0 && <> · <b>{ticketCounts.noEmail}</b> without email</>}
                    {ticketCounts.cancelled > 0 && <> · {ticketCounts.cancelled} cancelled (skipped)</>}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className={labelClass}>Emails per run</label>
                    <input type="number" min={1} max={500} value={batchSize} disabled={running}
                      onChange={(e) => setBatchSize(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Gap between emails (seconds)</label>
                    <input type="number" min={0} max={60} value={delaySec} disabled={running}
                      onChange={(e) => setDelaySec(Math.max(0, Math.min(60, Number(e.target.value) || 0)))} className={inputClass} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!running ? (
                    <>
                      <button onClick={sendPending} disabled={!pdfReady || counts.pending + counts.failed === 0} className={primaryBtn}>
                        <Send size={14} /> Send {Math.min(batchSize, counts.pending + counts.failed)} pending
                      </button>
                      <button onClick={sendTest} disabled={!pdfReady || recipients.length === 0} className={secondaryBtn}>
                        <Mail size={14} /> Send test to me
                      </button>
                    </>
                  ) : (
                    <button onClick={() => { stopRef.current = true; }} disabled={!progress} className={`${secondaryBtn} border-red-300 text-red-600`}>
                      <Square size={14} /> Stop
                    </button>
                  )}
                  {!pdfReady && <span className="text-xs text-slate-500 inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Preparing ticket design…</span>}
                </div>

                {progress && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1">
                      <span>{running ? 'Sending… keep this tab open' : 'Last run'}</span>
                      <span>{progress.done} / {progress.total}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full bg-[#007A78] dark:bg-[#2DD4BF] transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                    </div>
                  </div>
                )}

                <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 flex gap-1.5">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5 text-amber-500" />
                  Sent from the platform Gmail account. Gmail allows about 500 recipients a day; if the limit is hit the run stops and you can resume tomorrow. Emails already sent are never sent twice.
                </p>
              </section>

              {/* Log */}
              {log.length > 0 && (
                <section className={`${cardClass} max-h-56 overflow-y-auto`}>
                  <p className={labelClass}>Activity</p>
                  <ul className="space-y-1">
                    {log.map((l, i) => (
                      <li key={i} className={`text-xs ${l.kind === 'error' ? 'text-red-600 dark:text-red-400' : l.kind === 'ok' ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 font-semibold'}`}>
                        <span className="text-slate-400 mr-1.5">{new Date(l.at).toLocaleTimeString('en-IN')}</span>{l.text}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Recipients */}
              <section className={cardClass}>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {FILTERS.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className={`rounded-sm px-2.5 py-1 text-xs font-bold ${filter === f.key ? 'bg-[#007A78] dark:bg-[#2DD4BF] text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                    >
                      {f.label} ({counts[f.key]})
                    </button>
                  ))}
                </div>
                {filter !== 'no_email' && (
                  <div className="relative mb-3">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or ticket ID" className={`${inputClass} pl-8`} />
                  </div>
                )}

                {attendeesLoading ? (
                  <p className="text-xs text-slate-500 py-6 text-center">Loading attendees…</p>
                ) : filter === 'no_email' ? (
                  noEmail.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">Every ticket has an email address.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {noEmail.map((p) => (
                        <li key={p.id} className="py-2 text-xs">
                          <span className="font-bold">{p.memberIds.join(', ')}</span> · {p.name} · <span className="text-red-600">{p.email || 'no email'}</span>
                        </li>
                      ))}
                    </ul>
                  )
                ) : visibleRecipients.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">Nothing here.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleRecipients.map((r) => (
                      <li key={r.email} className="py-2.5 flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{r.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{r.email}</p>
                          {SUSPICIOUS_EMAIL.test(r.email) && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                              <AlertTriangle size={11} /> Looks like a typo, so this will probably bounce. Fix it on the Attendees page.
                            </p>
                          )}
                          <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-0.5 break-words">{ticketLabel(r.passes)}</p>
                          {r.status === 'sent' && <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">Sent {fmtTime(r.sentAt)}</p>}
                          {r.status === 'pending' && r.unsent.length < r.passes.length && (
                            <p className="text-[11px] text-amber-600 mt-0.5">New ticket(s) not sent yet: {ticketLabel(r.unsent)}</p>
                          )}
                          {r.status === 'failed' && <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5 break-words">{r.error || 'Failed'}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={`rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase ${
                            r.status === 'sent' ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
                              : r.status === 'failed' ? 'text-red-600 dark:text-red-400 bg-red-500/10'
                              : 'text-amber-700 dark:text-amber-400 bg-amber-500/10'
                          }`}>
                            {busyEmail === r.email ? 'Sending…' : r.status}
                          </span>
                          <button
                            onClick={() => runSingle(r, { all: r.status === 'sent' })}
                            disabled={running || !pdfReady}
                            className="text-[11px] font-bold text-[#007A78] dark:text-[#2DD4BF] disabled:opacity-40"
                          >
                            {r.status === 'sent' ? 'Resend' : 'Send now'}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Mark already sent */}
              <section className={cardClass}>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Mark tickets as already sent</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  Paste ticket IDs that were emailed outside the app (e.g. NUS-152, NUS-053) so they aren't sent again. "Clear" makes them pending again.
                </p>
                <textarea
                  value={markText}
                  onChange={(e) => setMarkText(e.target.value)}
                  rows={3}
                  placeholder="NUS-152, NUS-053, NUS-122"
                  className={`${inputClass} font-mono`}
                />
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <button onClick={() => runMark('sent')} disabled={markBusy || running || !markText.trim()} className={primaryBtn}>Mark as sent</button>
                  <button onClick={() => runMark('clear')} disabled={markBusy || running || !markText.trim()} className={secondaryBtn}>Clear</button>
                  {markBusy && <Loader2 size={14} className="animate-spin text-slate-400" />}
                  {markResult && <span className="text-xs text-slate-600 dark:text-slate-300">{markResult}</span>}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default SuperAdminSendTickets;
