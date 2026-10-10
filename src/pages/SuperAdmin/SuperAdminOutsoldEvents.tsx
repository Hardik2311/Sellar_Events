import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../../lib/firebase';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  ImagePlus,
  MapPin,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { canEncodeWebp, compressImageToTargetSize } from '../../lib/imageCompression';
import SuperAdminAppEvents from './SuperAdminAppEvents';

// Super Admin → Outsold.in Events: everything listed on outsold.in lives in the
// top-level `event_submissions` collection. Only status "published" shows on the
// site; displaySection "featured" puts an event in the featured area.

// Keep in sync with isSuperAdmin() in firestore.rules.
const SUPER_ADMIN_UIDS: string[] = ['sR4lj7OfkAc7DhdxfHhuC7XAzLC2', '8ZanoQBNWbeKTfOIVrddKObJuP02'];

const COLLECTION = 'event_submissions';
const STORAGE_FOLDER = 'event-submissions';

type SubmissionStatus = 'pending' | 'published' | 'rejected';
const STATUSES: { value: SubmissionStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
];

const SECTIONS = [
  { value: 'regular', label: 'Regular listing' },
  { value: 'featured', label: 'Featured' },
];

const CATEGORIES = ['music', 'sports', 'comedy', 'workshop', 'food', 'art', 'nightlife', 'festival', 'business', 'other'];

interface OutsoldEvent {
  id: string;
  eventName: string;
  organizedBy: string;
  category: string;
  otherCategory: string;
  description: string;
  venue: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD or ''
  time: string; // e.g. "5:30 am"
  pricing: string;
  bookingUrl: string;
  displaySection: string;
  status: string;
  coverImage: string;
  coverImageUrl: string;
  coverImageDesktop: string;
  coverImageMobile: string;
  source: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

type EventForm = Omit<OutsoldEvent, 'id' | 'createdAt' | 'updatedAt' | 'source' | 'coverImage' | 'coverImageUrl'>;

const EMPTY_FORM: EventForm = {
  eventName: '',
  organizedBy: '',
  category: 'music',
  otherCategory: '',
  description: '',
  venue: '',
  startDate: '',
  endDate: '',
  time: '',
  pricing: '',
  bookingUrl: '',
  displaySection: 'regular',
  status: 'published',
  coverImageDesktop: '',
  coverImageMobile: '',
};

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

const toOutsoldEvent = (id: string, d: Record<string, unknown>): OutsoldEvent => ({
  id,
  eventName: str(d.eventName),
  organizedBy: str(d.organizedBy),
  category: str(d.category),
  otherCategory: str(d.otherCategory),
  description: str(d.description),
  venue: str(d.venue),
  startDate: str(d.startDate),
  endDate: str(d.endDate),
  time: str(d.time),
  pricing: str(d.pricing),
  bookingUrl: str(d.bookingUrl),
  displaySection: str(d.displaySection),
  status: str(d.status) || 'pending',
  coverImage: str(d.coverImage),
  coverImageUrl: str(d.coverImageUrl),
  coverImageDesktop: str(d.coverImageDesktop),
  coverImageMobile: str(d.coverImageMobile),
  source: str(d.source),
  createdAt: d.createdAt as Timestamp | undefined,
  updatedAt: d.updatedAt as Timestamp | undefined,
});

// "5:30 am" <-> "05:30" (the stored format is the site's; <input type="time"> needs 24h)
const to24h = (value: string) => {
  const m = value.trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (!m) return '';
  let h = Number(m[1]);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
};
const to12h = (value: string) => {
  if (!value) return '';
  const [hStr, mStr] = value.split(':');
  const h = Number(hStr);
  return `${h % 12 === 0 ? 12 : h % 12}:${mStr} ${h >= 12 ? 'pm' : 'am'}`;
};

const formatDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const isPast = (e: OutsoldEvent) => !!e.startDate && (e.endDate || e.startDate) < todayISO();
const categoryLabel = (e: { category: string; otherCategory: string }) =>
  e.category === 'other' && e.otherCategory ? e.otherCategory : e.category;
const posterOf = (e: OutsoldEvent) => e.coverImageMobile || e.coverImageDesktop || e.coverImageUrl || e.coverImage;

const STATUS_BADGE: Record<string, string> = {
  published: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10',
  pending: 'text-amber-700 dark:text-amber-400 bg-amber-500/10',
  rejected: 'text-red-600 dark:text-red-400 bg-red-500/10',
};

const inputClass =
  'w-full rounded-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-[#007A78] focus:ring-1 focus:ring-[#007A78] dark:focus:border-[#2DD4BF] dark:focus:ring-[#2DD4BF]';
const labelClass = 'mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300';

// ── Cover image picker (compresses before upload) ─────────────────────────
const CoverField: React.FC<{
  label: string;
  hint: string;
  value: string;
  onChange: (dataUrlOrUrl: string) => void;
  maxWidth: number;
  maxHeight: number;
  aspectClass: string;
}> = ({ label, hint, value, onChange, maxWidth, maxHeight, aspectClass }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const compressed = await compressImageToTargetSize(file, 450, {
        maxWidth,
        maxHeight,
        quality: 0.85,
        mimeType: canEncodeWebp() ? 'image/webp' : 'image/jpeg',
      });
      onChange(compressed);
    } catch (err) {
      console.error(err);
      setError("That image couldn't be processed. Try another one.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span className={labelClass}>{label}</span>
      <label
        className={`relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-sm border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 hover:border-[#007A78] dark:hover:border-[#2DD4BF] ${aspectClass}`}
      >
        <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => handleFile(e.target.files?.[0])} />
        {value ? (
          <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <ImagePlus size={18} />
            {busy ? 'Compressing…' : 'Choose image'}
          </span>
        )}
        {value && busy && <span className="absolute inset-0 grid place-items-center bg-black/50 text-xs font-semibold text-white">Compressing…</span>}
      </label>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
        {value && (
          <button type="button" onClick={() => onChange('')} className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline">
            Remove
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-[11px] font-semibold text-red-500">{error}</p>}
    </div>
  );
};

// ── Add / edit form ───────────────────────────────────────────────────────
const EventFormModal: React.FC<{
  initial: OutsoldEvent | null;
  onClose: () => void;
}> = ({ initial, onClose }) => {
  const [form, setForm] = useState<EventForm>(() =>
    initial
      ? {
          eventName: initial.eventName,
          organizedBy: initial.organizedBy,
          category: initial.category || 'other',
          otherCategory: initial.otherCategory,
          description: initial.description,
          venue: initial.venue,
          startDate: initial.startDate,
          endDate: initial.endDate,
          time: initial.time,
          pricing: initial.pricing,
          bookingUrl: initial.bookingUrl,
          displaySection: initial.displaySection === 'featured' ? 'featured' : 'regular',
          status: initial.status,
          coverImageDesktop: initial.coverImageDesktop || initial.coverImageUrl || initial.coverImage,
          coverImageMobile: initial.coverImageMobile,
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof EventForm>(key: K, value: EventForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const categoryOptions = useMemo(
    () => (form.category && !CATEGORIES.includes(form.category) ? [form.category, ...CATEGORIES] : CATEGORIES),
    [form.category]
  );

  const validate = () => {
    if (!form.eventName.trim()) return 'Add the event name.';
    if (!form.startDate) return 'Add the start date.';
    if (form.endDate && form.endDate < form.startDate) return 'The end date is before the start date.';
    if (!form.bookingUrl.trim()) return 'Add the booking link.';
    try {
      const url = new URL(form.bookingUrl.trim());
      if (!/^https?:$/.test(url.protocol)) throw new Error();
    } catch {
      return 'The booking link must be a full web address starting with https://';
    }
    if (form.category === 'other' && !form.otherCategory.trim()) return 'Name the category, or pick one from the list.';
    if (!form.coverImageDesktop && !form.coverImageMobile) return 'Add at least one cover image.';
    return null;
  };

  const uploadIfNeeded = async (value: string, eventId: string, name: string) => {
    if (!value.startsWith('data:')) return value;
    const ext = value.startsWith('data:image/webp') ? 'webp' : 'jpg';
    const fileRef = ref(storage, `${STORAGE_FOLDER}/${eventId}/${name}-${Date.now()}.${ext}`);
    await uploadString(fileRef, value, 'data_url', { cacheControl: 'public, max-age=31536000, immutable' });
    return getDownloadURL(fileRef);
  };

  const handleSave = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const docRef = initial ? doc(db, COLLECTION, initial.id) : doc(collection(db, COLLECTION));
      const [desktop, mobile] = await Promise.all([
        uploadIfNeeded(form.coverImageDesktop, docRef.id, 'cover-desktop'),
        uploadIfNeeded(form.coverImageMobile, docRef.id, 'cover-mobile'),
      ]);
      const primary = desktop || mobile;
      const payload = {
        eventName: form.eventName.trim(),
        organizedBy: form.organizedBy.trim(),
        category: form.category,
        otherCategory: form.category === 'other' ? form.otherCategory.trim() : '',
        description: form.description.trim(),
        venue: form.venue.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        time: form.time,
        pricing: form.pricing.trim(),
        bookingUrl: form.bookingUrl.trim(),
        displaySection: form.displaySection,
        status: form.status,
        coverImageDesktop: desktop,
        coverImageMobile: mobile,
        // Older fields the site may still read — kept pointing at the main cover
        coverImage: primary,
        coverImageUrl: primary,
        updatedAt: serverTimestamp(),
      };
      if (initial) {
        // updateDoc only touches these fields; anything else on the document stays as it is
        await updateDoc(docRef, payload);
      } else {
        await setDoc(docRef, { ...payload, source: 'outsold', createdAt: serverTimestamp() });
      }
      onClose();
    } catch (err) {
      console.error('Failed to save outsold.in event:', err);
      setError("Couldn't save the event. Check your connection and try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-white dark:bg-[#1E293B] shadow-xl sm:max-h-[92vh] sm:rounded-md">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">{initial ? 'Edit event' : 'Add event'}</h2>
          <button onClick={onClose} disabled={saving} className="rounded-sm p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="oe-name" className={labelClass}>Event name *</label>
              <input id="oe-name" className={inputClass} value={form.eventName} onChange={(e) => set('eventName', e.target.value)} />
            </div>
            <div>
              <label htmlFor="oe-org" className={labelClass}>Organized by</label>
              <input id="oe-org" className={inputClass} value={form.organizedBy} onChange={(e) => set('organizedBy', e.target.value)} placeholder="e.g. SogaRuns" />
            </div>
            <div>
              <label htmlFor="oe-cat" className={labelClass}>Category</label>
              <select id="oe-cat" className={`${inputClass} capitalize`} value={form.category} onChange={(e) => set('category', e.target.value)}>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {form.category === 'other' && (
              <div className="sm:col-span-2">
                <label htmlFor="oe-other" className={labelClass}>Category name *</label>
                <input id="oe-other" className={inputClass} value={form.otherCategory} onChange={(e) => set('otherCategory', e.target.value)} />
              </div>
            )}
            <div className="sm:col-span-2">
              <label htmlFor="oe-desc" className={labelClass}>Description</label>
              <textarea id="oe-desc" rows={5} className={inputClass} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="oe-venue" className={labelClass}>Venue</label>
              <input id="oe-venue" className={inputClass} value={form.venue} onChange={(e) => set('venue', e.target.value)} placeholder="e.g. East Delhi Mall, Anand Vihar" />
            </div>
            <div>
              <label htmlFor="oe-start" className={labelClass}>Start date *</label>
              <input id="oe-start" type="date" className={inputClass} value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </div>
            <div>
              <label htmlFor="oe-end" className={labelClass}>End date</label>
              <input id="oe-end" type="date" className={inputClass} value={form.endDate} min={form.startDate || undefined} onChange={(e) => set('endDate', e.target.value)} />
            </div>
            <div>
              <label htmlFor="oe-time" className={labelClass}>Start time</label>
              <input id="oe-time" type="time" className={inputClass} value={to24h(form.time)} onChange={(e) => set('time', to12h(e.target.value))} />
            </div>
            <div>
              <label htmlFor="oe-price" className={labelClass}>Price (₹)</label>
              <input id="oe-price" className={inputClass} value={form.pricing} onChange={(e) => set('pricing', e.target.value)} placeholder="e.g. 599, or Free" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="oe-url" className={labelClass}>Booking link *</label>
              <input id="oe-url" type="url" className={inputClass} value={form.bookingUrl} onChange={(e) => set('bookingUrl', e.target.value)} placeholder="https://" />
            </div>
            <div>
              <label htmlFor="oe-status" className={labelClass}>Status</label>
              <select id="oe-status" className={inputClass} value={form.status} onChange={(e) => set('status', e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}{s.value === 'published' ? ' (shows on outsold.in)' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="oe-section" className={labelClass}>Homepage section</label>
              <select id="oe-section" className={inputClass} value={form.displaySection} onChange={(e) => set('displaySection', e.target.value)}>
                {SECTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <CoverField
              label="Desktop cover"
              hint="Wide image, about 1600 × 600"
              value={form.coverImageDesktop}
              onChange={(v) => set('coverImageDesktop', v)}
              maxWidth={1920}
              maxHeight={1080}
              aspectClass="aspect-[8/3]"
            />
            <CoverField
              label="Mobile cover"
              hint="Portrait image, about 1080 × 1350"
              value={form.coverImageMobile}
              onChange={(v) => set('coverImageMobile', v)}
              maxWidth={1080}
              maxHeight={1350}
              aspectClass="aspect-[4/5] max-h-56"
            />
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-3">
          {error && <p className="mb-2 text-xs font-semibold text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} disabled={saving} className="rounded-sm px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-sm bg-[#007A78] px-4 py-2 text-sm font-semibold text-white hover:bg-[#006361] disabled:opacity-60 dark:bg-[#2DD4BF] dark:text-slate-950 dark:hover:bg-[#22b8a5]"
            >
              {saving ? 'Saving…' : initial ? 'Save changes' : 'Add event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────
type StatusFilter = 'all' | SubmissionStatus;
type TimeFilter = 'upcoming' | 'past' | 'all';

const SuperAdminOutsoldEvents: React.FC = () => {
  const navigate = useNavigate();
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [events, setEvents] = useState<OutsoldEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('upcoming');
  const [editing, setEditing] = useState<OutsoldEvent | null | 'new'>(null);
  const [deleting, setDeleting] = useState<OutsoldEvent | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tab, setTab] = useState<'outsold' | 'app'>('outsold');

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), (user) => {
      setCurrentUid(user?.uid ?? null);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  const isSuperAdmin = !!currentUid && SUPER_ADMIN_UIDS.includes(currentUid);

  // Live list; sorted here because some older documents have no createdAt.
  useEffect(() => {
    if (!authChecked || !isSuperAdmin) return;
    const unsub = onSnapshot(
      collection(db, COLLECTION),
      (snap) => {
        setEvents(snap.docs.map((d) => toOutsoldEvent(d.id, d.data())));
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load outsold.in events:', err);
        setLoadError("Couldn't load events. Check you're signed in as a super admin.");
        setLoading(false);
      }
    );
    return unsub;
  }, [authChecked, isSuperAdmin]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: events.length, pending: 0, published: 0, rejected: 0 };
    events.forEach((e) => {
      if (e.status in c) c[e.status as SubmissionStatus] += 1;
    });
    return c;
  }, [events]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events
      .filter((e) => statusFilter === 'all' || e.status === statusFilter)
      .filter((e) => (timeFilter === 'all' ? true : timeFilter === 'past' ? isPast(e) : !isPast(e)))
      .filter(
        (e) =>
          !q ||
          [e.eventName, e.organizedBy, e.venue, categoryLabel(e)].some((v) => v.toLowerCase().includes(q))
      )
      .sort((a, b) =>
        timeFilter === 'past' ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate)
      );
  }, [events, search, statusFilter, timeFilter]);

  const runAction = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      console.error(err);
      setActionError("That change couldn't be saved. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = (e: OutsoldEvent, status: SubmissionStatus) =>
    runAction(e.id, () => updateDoc(doc(db, COLLECTION, e.id), { status, updatedAt: serverTimestamp() }));

  // Live = published on outsold.in. Turning it off sends the event back to Pending.
  const toggleLive = (e: OutsoldEvent) => setStatus(e, e.status === 'published' ? 'pending' : 'published');

  const toggleFeatured = (e: OutsoldEvent) =>
    runAction(e.id, () =>
      updateDoc(doc(db, COLLECTION, e.id), {
        displaySection: e.displaySection === 'featured' ? 'regular' : 'featured',
        updatedAt: serverTimestamp(),
      })
    );

  const confirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    await runAction(target.id, () => deleteDoc(doc(db, COLLECTION, target.id)));
    setDeleting(null);
  };

  if (!authChecked || (isSuperAdmin && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-[#0F172A]">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-[#0F172A]">
        <div className="text-center">
          <p className="text-red-500 font-bold text-xl">Access denied</p>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Super Admin privileges required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-16">
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-6 py-4 relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
        </div>
        <div className="text-center px-12">
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Outsold.in Events</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">outsold.in listings and every company&apos;s app events</p>
        </div>
        <div className={`absolute right-4 top-1/2 -translate-y-1/2 ${tab === 'outsold' ? '' : 'hidden'}`}>
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-1.5 rounded-sm bg-[#007A78] px-3 py-2 text-xs font-bold text-white hover:bg-[#006361] dark:bg-[#2DD4BF] dark:text-slate-950 dark:hover:bg-[#22b8a5]"
          >
            <Plus size={14} /> <span className="hidden sm:inline">Add event</span>
          </button>
        </div>
      </header>

      <main className="grow overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          {/* Which events */}
          <div
            className="grid grid-cols-2 gap-1 rounded-sm border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-[#1E293B] sm:inline-grid sm:w-auto sm:self-start"
            role="tablist"
            aria-label="Event source"
          >
            {([
              { key: 'outsold', label: 'Outsold.in listings' },
              { key: 'app', label: 'App events (all companies)' },
            ] as const).map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-sm px-3 py-2 text-xs font-bold transition-colors ${
                  tab === t.key
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'app' ? (
            <SuperAdminAppEvents />
          ) : (
          <>
          {/* Status tabs */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'pending', 'published', 'rejected'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-sm border px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                  statusFilter === s
                    ? 'border-[#007A78] bg-[#007A78] text-white dark:border-[#2DD4BF] dark:bg-[#2DD4BF] dark:text-slate-950'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                {s} ({counts[s]})
              </button>
            ))}
          </div>

          {/* Search + time */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by event, organizer, venue or category…"
                className="w-full rounded-sm border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm shadow-sm outline-none focus:ring-1 focus:ring-[#007A78] dark:border-slate-700 dark:bg-[#1E293B] dark:focus:ring-[#2DD4BF]"
              />
            </div>
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
                const poster = posterOf(e);
                const busy = busyId === e.id;
                return (
                  <div
                    key={e.id}
                    className={`flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-[#1E293B] sm:flex-row ${busy ? 'opacity-60' : ''}`}
                  >
                    <div className="h-36 w-full shrink-0 overflow-hidden rounded-sm bg-slate-100 dark:bg-slate-800 sm:h-28 sm:w-24">
                      {poster && <img src={poster} alt="" className="h-full w-full object-cover" loading="lazy" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_BADGE[e.status] ?? 'bg-slate-500/10 text-slate-600 dark:text-slate-300'}`}>
                          {e.status}
                        </span>
                        {e.displaySection === 'featured' && (
                          <span className="flex items-center gap-1 rounded bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold uppercase text-yellow-700 dark:text-yellow-300">
                            <Star size={10} className="fill-current" /> Featured
                          </span>
                        )}
                        {e.category && (
                          <span className="rounded bg-[#007A78]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#007A78] dark:bg-[#2DD4BF]/15 dark:text-[#2DD4BF]">
                            {categoryLabel(e)}
                          </span>
                        )}
                        {isPast(e) && (
                          <span className="rounded bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Past</span>
                        )}
                      </div>
                      <h3 className="truncate text-base font-bold text-slate-900 dark:text-white">{e.eventName || 'Untitled event'}</h3>
                      {e.organizedBy && <p className="truncate text-xs text-slate-500 dark:text-slate-400">by {e.organizedBy}</p>}
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-1">
                          <CalendarDays size={13} className="text-slate-400" />
                          {formatDate(e.startDate) || 'No date'}
                          {e.endDate && e.endDate !== e.startDate ? ` to ${formatDate(e.endDate)}` : ''}
                          {e.time ? `, ${e.time}` : ''}
                        </span>
                        {e.venue && (
                          <span className="flex min-w-0 items-center gap-1">
                            <MapPin size={13} className="shrink-0 text-slate-400" />
                            <span className="truncate">{e.venue}</span>
                          </span>
                        )}
                        {e.pricing && <span className="font-semibold">{/^\d/.test(e.pricing) ? `₹${e.pricing}` : e.pricing}</span>}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-start gap-2 sm:w-56 sm:flex-col sm:items-stretch">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={e.status === 'published'}
                        aria-label={`${e.eventName || 'Event'} live on outsold.in`}
                        onClick={() => toggleLive(e)}
                        disabled={busy}
                        className={`flex items-center justify-between gap-3 rounded-sm border px-2.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-60 ${
                          e.status === 'published'
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`h-2 w-2 rounded-full ${e.status === 'published' ? 'bg-emerald-500 motion-safe:animate-pulse' : 'bg-slate-400'}`}
                            aria-hidden="true"
                          />
                          {e.status === 'published' ? 'Live on outsold.in' : 'Not live'}
                        </span>
                        <span
                          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${e.status === 'published' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                          aria-hidden="true"
                        >
                          <span
                            className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${e.status === 'published' ? 'translate-x-4' : ''}`}
                          />
                        </span>
                      </button>
                      <select
                        value={STATUSES.some((s) => s.value === e.status) ? e.status : ''}
                        disabled={busy}
                        onChange={(ev) => setStatus(e, ev.target.value as SubmissionStatus)}
                        className="rounded-sm border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                        aria-label={`Status of ${e.eventName}`}
                      >
                        {!STATUSES.some((s) => s.value === e.status) && <option value="">{e.status}</option>}
                        {STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => toggleFeatured(e)}
                          disabled={busy}
                          title={e.displaySection === 'featured' ? 'Remove from featured' : 'Feature on homepage'}
                          className={`flex items-center gap-1 rounded-sm border px-2.5 py-1.5 text-xs font-semibold ${
                            e.displaySection === 'featured'
                              ? 'border-yellow-400 bg-yellow-400/15 text-yellow-700 dark:text-yellow-300'
                              : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Star size={13} className={e.displaySection === 'featured' ? 'fill-current' : ''} />
                          {e.displaySection === 'featured' ? 'Featured' : 'Feature'}
                        </button>
                        <button
                          onClick={() => setEditing(e)}
                          disabled={busy}
                          className="flex items-center gap-1 rounded-sm border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        {e.bookingUrl && (
                          <a
                            href={e.bookingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-sm border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            title="Open booking link"
                          >
                            <ExternalLink size={13} /> Link
                          </a>
                        )}
                        <button
                          onClick={() => setDeleting(e)}
                          disabled={busy}
                          className="flex items-center gap-1 rounded-sm border border-red-300 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </>
          )}
        </div>
      </main>

      {editing && <EventFormModal initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

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
              <span className="font-bold text-slate-800 dark:text-white">{deleting.eventName || 'This event'}</span> will be removed from
              outsold.in and the database. This can't be undone. To only take it off the site, set it to Pending or Rejected instead.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleting(null)}
                className="rounded-sm px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={busyId === deleting.id}
                className="rounded-sm bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {busyId === deleting.id ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminOutsoldEvents;
