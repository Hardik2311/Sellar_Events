import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, serverTimestamp, updateDoc, type Timestamp } from 'firebase/firestore';
import { AlertTriangle, CalendarDays, ExternalLink, Lock, MapPin, RefreshCw, RotateCcw, Search, Star, Trash2, X } from 'lucide-react';
import { db } from '../../lib/firebase';
import { buildEventSlugId } from '../../data/events';
import { stripHtmlTags } from '../../lib/utils';

// Super Admin → Outsold.in Events → "App events": every event any company has
// made in the organizer app (companies/{companyId}/events), with the same Live,
// Featured and Delete/Restore controls organizers have.
//
// Going live here is an admin override: it does NOT take an event credit from
// the company (the organizer dashboard does).

interface AppEvent {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  date: string;
  endDate: string;
  time: string;
  venue: string;
  isOnline: boolean;
  isPrivate: boolean;
  status: string; // 'draft' | 'published' | 'deleted'
  featured: boolean;
  // outsold.in's query filters on the literal string "true" — not a boolean —
  // so this must be written/read as a string, not `!!data.isWebsite`.
  isWebsite: boolean;
  cover: string;
  ticketsSold: number;
  ticketsTotal: number;
  registrationMode: string;
  createdAt?: Timestamp;
}

type StatusFilter = 'all' | 'published' | 'draft' | 'deleted';
type TimeFilter = 'upcoming' | 'past' | 'all';

const STATUS_LABEL: Record<string, string> = { published: 'Live', draft: 'Draft', deleted: 'Deleted' };
const STATUS_BADGE: Record<string, string> = {
  published: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10',
  draft: 'text-slate-600 dark:text-slate-300 bg-slate-500/10',
  deleted: 'text-red-600 dark:text-red-400 bg-red-500/10',
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const isPast = (e: AppEvent) => !!e.date && (e.endDate || e.date) < todayISO();
const formatDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

// Per-company reads (not a collectionGroup query) so one unreadable company
// doesn't break the whole list — same approach as SuperAdminCompanies.
const loadAppEvents = async (): Promise<{ companies: { id: string; name: string }[]; events: AppEvent[] }> => {
  const companiesSnap = await getDocs(collection(db, 'companies'));
  const companyList = companiesSnap.docs.map((d) => ({ id: d.id, name: (d.data().name as string) || 'Unnamed company' }));
  const perCompany = await Promise.all(
    companyList.map(async (company) => {
      try {
        const snap = await getDocs(collection(db, 'companies', company.id, 'events'));
        return snap.docs.map((d): AppEvent => {
          const data = d.data();
          const tiers: { quantity?: number; sold?: number }[] = data.tiers || [];
          return {
            id: d.id,
            companyId: company.id,
            companyName: company.name,
            title: stripHtmlTags(data.title || '') || 'Untitled event',
            date: data.date || '',
            endDate: data.endDate || '',
            time: data.time || '',
            venue: data.venue || '',
            isOnline: !!data.isOnline,
            isPrivate: !!data.isPrivate,
            status: data.status || 'draft',
            featured: !!data.featured,
            isWebsite: data.isWebsite === 'true',
            cover: data.coverImageMobile || data.coverImageDesktop || data.coverImageUrls?.[0] || data.coverImageUrl || '',
            ticketsSold: tiers.reduce((s, t) => s + (Number(t.sold) || 0), 0),
            ticketsTotal: tiers.reduce((s, t) => s + (Number(t.quantity) || 0), 0),
            registrationMode: data.registrationMode || 'tickets',
            createdAt: data.createdAt,
          };
        });
      } catch (err) {
        console.error(`Failed to load events for company ${company.id}:`, err);
        return [];
      }
    })
  );
  return {
    companies: companyList.sort((a, b) => a.name.localeCompare(b.name)),
    events: perCompany.flat(),
  };
};

const SuperAdminAppEvents: React.FC = () => {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AppEvent | null>(null);

  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('upcoming');

  // Reloads the list (Refresh button); state is only touched once the data arrives.
  const refresh = () => {
    setLoading(true);
    setLoadError(null);
    loadAppEvents()
      .then((r) => {
        setCompanies(r.companies);
        setEvents(r.events);
      })
      .catch(() => setLoadError("Couldn't load events. Check your connection and try again."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAppEvents()
      .then((r) => {
        setCompanies(r.companies);
        setEvents(r.events);
      })
      .catch(() => setLoadError("Couldn't load events. Check your connection and try again."))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const pool = companyFilter === 'all' ? events : events.filter((e) => e.companyId === companyFilter);
    const c: Record<StatusFilter, number> = { all: 0, published: 0, draft: 0, deleted: 0 };
    pool.forEach((e) => {
      if (e.status !== 'deleted') c.all += 1;
      if (e.status in c) c[e.status as StatusFilter] += 1;
    });
    return c;
  }, [events, companyFilter]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events
      .filter((e) => companyFilter === 'all' || e.companyId === companyFilter)
      .filter((e) => (statusFilter === 'all' ? e.status !== 'deleted' : e.status === statusFilter))
      .filter((e) => (timeFilter === 'all' ? true : timeFilter === 'past' ? isPast(e) : !isPast(e)))
      .filter((e) => !q || [e.title, e.companyName, e.venue].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => (timeFilter === 'past' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  }, [events, search, companyFilter, statusFilter, timeFilter]);

  const patchLocal = (e: AppEvent, patch: Partial<AppEvent>) =>
    setEvents((list) => list.map((x) => (x.id === e.id && x.companyId === e.companyId ? { ...x, ...patch } : x)));

  const run = async (e: AppEvent, write: Record<string, unknown>, local: Partial<AppEvent>) => {
    setBusyId(`${e.companyId}/${e.id}`);
    setActionError(null);
    try {
      await updateDoc(doc(db, 'companies', e.companyId, 'events', e.id), write);
      patchLocal(e, local);
    } catch (err) {
      console.error(err);
      setActionError("That change couldn't be saved. If this keeps happening, the Firestore rules may not be deployed yet.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleLive = (e: AppEvent) =>
    e.status === 'published'
      ? run(e, { status: 'draft' }, { status: 'draft' })
      : run(e, { status: 'published', everPublished: true }, { status: 'published' });

  const toggleFeatured = (e: AppEvent) => run(e, { featured: !e.featured }, { featured: !e.featured });

  // Written as the string "true"/"false" — outsold.in's query filters on
  // the literal string, so a boolean here would silently never match.
  const toggleWebsite = (e: AppEvent) =>
    run(e, { isWebsite: e.isWebsite ? 'false' : 'true' }, { isWebsite: !e.isWebsite });

  // Same soft delete the organizer app uses: restorable, hard-deleted after the grace window.
  const softDelete = async (e: AppEvent) => {
    await run(e, { status: 'deleted', deletedAt: serverTimestamp() }, { status: 'deleted' });
    setDeleting(null);
  };
  const restore = (e: AppEvent) => run(e, { status: 'draft', deletedAt: null }, { status: 'draft' });

  const publicUrl = (e: AppEvent) => `/public/${e.companyId}/e/${buildEventSlugId(e.title, e.id)}`;

  if (loading) {
    return <p className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading app events…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'published', 'draft', 'deleted'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-sm border px-3 py-1.5 text-xs font-bold transition-colors ${
              statusFilter === s
                ? 'border-[#007A78] bg-[#007A78] text-white dark:border-[#2DD4BF] dark:bg-[#2DD4BF] dark:text-slate-950'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_LABEL[s]} ({counts[s]})
          </button>
        ))}
        <button
          onClick={refresh}
          className="ml-auto flex items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by event, company or venue…"
            className="w-full rounded-sm border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm shadow-sm outline-none focus:ring-1 focus:ring-[#007A78] dark:border-slate-700 dark:bg-[#1E293B] dark:focus:ring-[#2DD4BF]"
          />
        </div>
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          className="rounded-sm border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none dark:border-slate-700 dark:bg-[#1E293B] sm:w-56"
          aria-label="Company"
        >
          <option value="all">All companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
          className="rounded-sm border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none dark:border-slate-700 dark:bg-[#1E293B]"
          aria-label="Show"
        >
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
          <option value="all">All dates</option>
        </select>
      </div>

      {(loadError || actionError) && (
        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {loadError || actionError}
        </p>
      )}

      {visible.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-[#1E293B] dark:text-slate-500">
          No events match these filters.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((e) => {
            const key = `${e.companyId}/${e.id}`;
            const busy = busyId === key;
            const live = e.status === 'published';
            const deleted = e.status === 'deleted';
            return (
              <div
                key={key}
                className={`flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-[#1E293B] sm:flex-row ${busy ? 'opacity-60' : ''}`}
              >
                <div className="h-36 w-full shrink-0 overflow-hidden rounded-sm bg-slate-100 dark:bg-slate-800 sm:h-28 sm:w-24">
                  {e.cover && <img src={e.cover} alt="" className="h-full w-full object-cover" loading="lazy" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_BADGE[e.status] ?? STATUS_BADGE.draft}`}>
                      {STATUS_LABEL[e.status] ?? e.status}
                    </span>
                    {e.featured && (
                      <span className="flex items-center gap-1 rounded bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold uppercase text-yellow-700 dark:text-yellow-300">
                        <Star size={10} className="fill-current" /> Featured
                      </span>
                    )}
                    {e.isPrivate && (
                      <span className="flex items-center gap-1 rounded bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300">
                        <Lock size={10} /> Private
                      </span>
                    )}
                    {isPast(e) && (
                      <span className="rounded bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Past</span>
                    )}
                  </div>
                  <h3 className="truncate text-base font-bold text-slate-900 dark:text-white">{e.title}</h3>
                  <p className="truncate text-xs font-semibold text-[#007A78] dark:text-[#2DD4BF]">{e.companyName}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1">
                      <CalendarDays size={13} className="text-slate-400" />
                      {formatDate(e.date) || 'No date'}
                      {e.endDate && e.endDate !== e.date ? ` to ${formatDate(e.endDate)}` : ''}
                      {e.time ? `, ${e.time}` : ''}
                    </span>
                    <span className="flex min-w-0 items-center gap-1">
                      <MapPin size={13} className="shrink-0 text-slate-400" />
                      <span className="truncate">{e.isOnline ? 'Online' : e.venue || 'No venue'}</span>
                    </span>
                    {e.registrationMode === 'rsvp' ? (
                      <span className="font-semibold">RSVP</span>
                    ) : (
                      <span className="font-semibold">{e.ticketsSold}/{e.ticketsTotal} tickets sold</span>
                    )}
                  </div>
                  <p className="mt-1 truncate font-mono text-[10px] text-slate-400 dark:text-slate-500">{key}</p>
                </div>

                <div className="flex shrink-0 flex-wrap items-start gap-2 sm:w-56 sm:flex-col sm:items-stretch">
                  {deleted ? (
                    <button
                      onClick={() => restore(e)}
                      disabled={busy}
                      className="flex items-center justify-center gap-1.5 rounded-sm border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <RotateCcw size={13} /> Restore as draft
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={live}
                        aria-label={`${e.title} live`}
                        onClick={() => toggleLive(e)}
                        disabled={busy}
                        className={`flex items-center justify-between gap-3 rounded-sm border px-2.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-60 ${
                          live
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-500 motion-safe:animate-pulse' : 'bg-slate-400'}`} aria-hidden="true" />
                          {live ? 'Live' : 'Draft'}
                        </span>
                        <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${live ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} aria-hidden="true">
                          <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${live ? 'translate-x-4' : ''}`} />
                        </span>
                      </button>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={e.isWebsite}
                        aria-label={`${e.title} live on outsold.in`}
                        onClick={() => toggleWebsite(e)}
                        disabled={busy}
                        className={`flex items-center justify-between gap-3 rounded-sm border px-2.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-60 ${
                          e.isWebsite
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${e.isWebsite ? 'bg-emerald-500 motion-safe:animate-pulse' : 'bg-slate-400'}`} aria-hidden="true" />
                          {e.isWebsite ? 'Live on outsold.in' : 'Not on outsold.in'}
                        </span>
                        <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${e.isWebsite ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} aria-hidden="true">
                          <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${e.isWebsite ? 'translate-x-4' : ''}`} />
                        </span>
                      </button>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => toggleFeatured(e)}
                          disabled={busy}
                          title={e.featured ? 'Remove from the company store hero' : "Feature in the company store's hero"}
                          className={`flex items-center gap-1 rounded-sm border px-2.5 py-1.5 text-xs font-semibold ${
                            e.featured
                              ? 'border-yellow-400 bg-yellow-400/15 text-yellow-700 dark:text-yellow-300'
                              : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Star size={13} className={e.featured ? 'fill-current' : ''} />
                          {e.featured ? 'Featured' : 'Feature'}
                        </button>
                        <a
                          href={publicUrl(e)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-sm border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <ExternalLink size={13} /> View
                        </a>
                        <button
                          onClick={() => setDeleting(e)}
                          disabled={busy}
                          className="flex items-center gap-1 rounded-sm border border-red-300 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-[#1E293B]">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle size={18} />
                <h2 className="text-sm font-extrabold">Delete this event?</h2>
              </div>
              <button onClick={() => setDeleting(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-bold text-slate-800 dark:text-white">{deleting.title}</span> by {deleting.companyName} comes off its store
              straight away. Like a delete from the organizer app, it can be restored from the Deleted tab until it's permanently
              removed after the grace period.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleting(null)}
                className="rounded-sm px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => softDelete(deleting)}
                disabled={busyId === `${deleting.companyId}/${deleting.id}`}
                className="rounded-sm bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminAppEvents;
