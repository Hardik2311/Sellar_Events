import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { ArrowLeft, Search } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useSuperAdmin } from '../../hooks/usePlatformPayments';
import { stripHtmlTags } from '../../lib/utils';
import {
  computePlatformFee,
  describeFee,
  eventFeeOverrideId,
  resolveFeeConfig,
  round2,
  type PlatformConfigDoc,
  type PlatformFeeOverrideDoc,
} from '../../lib/platformFee';

const inputClass =
  'w-full rounded-sm border border-slate-200 dark:border-slate-700 bg-[#F9FAFB] dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#007A78]';
const labelClass = 'block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1';
const cardClass = 'bg-white dark:bg-[#1E293B] rounded-md shadow-sm border border-slate-200 dark:border-slate-800 p-4';
const primaryBtn =
  'rounded-sm bg-[#007A78] dark:bg-[#2DD4BF] px-3 py-2 text-xs font-bold text-white dark:text-slate-950 hover:bg-[#006361] disabled:opacity-50';
const secondaryBtn =
  'rounded-sm border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50';

const inr = (n: number) => `₹${round2(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// Razorpay's standard domestic pricing, for the "what you keep" estimate only.
const GATEWAY_COST_PERCENT = 2;

// '' → undefined so empty inputs fall back to the default.
const parseNum = (v: string): number | undefined => {
  if (v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};
const str = (n?: number | null) => (typeof n === 'number' ? String(n) : '');

interface ConfigForm {
  gatewayEnabled: boolean;
  percent: string;
  fixedPerTicket: string;
  feeGstRate: string;
  tcsPercent: string;
  tdsPercent: string;
  platformLegalName: string;
  platformGstin: string;
}

const toForm = (c: PlatformConfigDoc | null): ConfigForm => {
  const r = resolveFeeConfig(c);
  return {
    gatewayEnabled: r.gatewayEnabled,
    percent: String(r.percent),
    fixedPerTicket: String(r.fixedPerTicket),
    feeGstRate: String(r.feeGstRate),
    tcsPercent: String(r.tcsPercent),
    tdsPercent: String(r.tdsPercent),
    platformLegalName: c?.platformLegalName ?? '',
    platformGstin: c?.platformGstin ?? '',
  };
};

interface CompanyRow {
  id: string;
  name: string;
}

// A published event, across all organizers.
interface EventRow {
  id: string;
  companyId: string;
  title: string;
  date?: string; // yyyy-mm-dd
  paymentCollectionMode?: string;
}

// The event a custom fee is being edited for.
interface OverrideTarget {
  companyId: string;
  eventId: string;
  eventTitle: string;
}

interface OverrideForm {
  percent: string;
  fixedPerTicket: string;
  tcsPercent: string;
  tdsPercent: string;
  note: string;
}

/** Super Admin → Payments: platform gateway switch, default fee, tax/deduction rates, custom fee per event. */
const SuperAdminPayments: React.FC = () => {
  const navigate = useNavigate();
  const { uid, checked, isSuperAdmin } = useSuperAdmin();

  const [rawConfig, setRawConfig] = useState<PlatformConfigDoc | null>(null);
  const [form, setForm] = useState<ConfigForm>(() => toForm(null));
  const [configLoaded, setConfigLoaded] = useState(false);
  const formInitialized = useRef(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [previewPrice, setPreviewPrice] = useState('500');
  const [previewHasGstin, setPreviewHasGstin] = useState(false);

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [overrides, setOverrides] = useState<Record<string, PlatformFeeOverrideDoc>>({});
  const [activeEvents, setActiveEvents] = useState<EventRow[] | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null); // override doc id
  const [overrideForm, setOverrideForm] = useState<OverrideForm>({ percent: '', fixedPerTicket: '', tcsPercent: '', tdsPercent: '', note: '' });
  const [overrideSaving, setOverrideSaving] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    return onSnapshot(doc(db, 'platform', 'config'), (snap) => {
      const data = snap.exists() ? (snap.data() as PlatformConfigDoc) : null;
      setRawConfig(data);
      if (!formInitialized.current) {
        setForm(toForm(data)); // only once — later snapshots mustn't clobber unsaved edits
        formInitialized.current = true;
      }
      setConfigLoaded(true);
    }, (err) => {
      // Usually: firestore.rules with the platform/* rules isn't deployed yet.
      console.error('Failed to load platform/config:', err);
      setConfigLoaded(true); // still allow saving — the save shows its own error
      setMessage({
        ok: false,
        text: err.code === 'permission-denied'
          ? 'No permission to read platform settings. Deploy the latest Firestore rules (firebase deploy --only firestore:rules) and reload.'
          : `Could not load platform settings: ${err.message}`,
      });
    });
  }, [isSuperAdmin]);

  // Companies and custom fees load independently: if the custom-fee read is
  // refused (Firestore rules not deployed yet) the events must still show.
  const fetchOverrideData = async () => {
    const [companiesResult, overridesResult] = await Promise.allSettled([
      getDocs(collection(db, 'companies')),
      getDocs(collection(db, 'eventFeeOverrides')),
    ]);
    if (companiesResult.status === 'rejected') throw companiesResult.reason;
    const map: Record<string, PlatformFeeOverrideDoc> = {};
    let overridesError: string | null = null;
    if (overridesResult.status === 'fulfilled') {
      overridesResult.value.forEach((d) => { map[d.id] = d.data() as PlatformFeeOverrideDoc; });
    } else {
      console.error('Failed to load event fee overrides:', overridesResult.reason);
      overridesError = (overridesResult.reason as { code?: string })?.code === 'permission-denied'
        ? 'Custom fees can’t be read or saved yet. Deploy the latest Firestore rules (firebase deploy --only firestore:rules) and reload.'
        : 'Could not load custom fees.';
    }
    return {
      companies: companiesResult.value.docs
        .map((d) => ({ id: d.id, name: (d.data().name as string) || d.id }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      overrides: map,
      overridesError,
    };
  };

  // Every published event, one small query per organizer (works with the
  // existing public-read rule on events — no collection-group index needed).
  const fetchActiveEvents = async (companyIds: string[]): Promise<EventRow[]> => {
    const perCompany = await Promise.all(
      companyIds.map((companyId) =>
        getDocs(query(collection(db, 'companies', companyId, 'events'), where('status', '==', 'published')))
          .then((snap) =>
            snap.docs.map((d) => ({
              id: d.id,
              companyId,
              title: stripHtmlTags(String(d.data().title ?? '')) || d.id,
              date: d.data().date as string | undefined,
              paymentCollectionMode: d.data().paymentCollectionMode as string | undefined,
            }))
          )
          .catch((err) => {
            console.error(`Failed to load events for ${companyId}:`, err);
            return [] as EventRow[];
          })
      )
    );
    // Soonest first; undated events last.
    return perCompany.flat().sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  };

  const loadOverrides = async () => {
    const data = await fetchOverrideData();
    setCompanies(data.companies);
    setOverrides(data.overrides);
    setEventsError(data.overridesError);
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    let cancelled = false;
    fetchOverrideData()
      .then(async (data) => {
        if (cancelled) return;
        setCompanies(data.companies);
        setOverrides(data.overrides);
        setEventsError(data.overridesError);
        const events = await fetchActiveEvents(data.companies.map((c) => c.id));
        if (!cancelled) setActiveEvents(events);
      })
      .catch((err) => {
        console.error('Failed to load companies/overrides:', err);
        if (cancelled) return;
        setActiveEvents([]);
        setEventsError(`Could not load events: ${(err as Error).message}`);
      });
    return () => { cancelled = true; };
  }, [isSuperAdmin]);

  const draftConfig: PlatformConfigDoc = {
    gatewayEnabled: form.gatewayEnabled,
    fee: { percent: parseNum(form.percent) ?? 0, fixedPerTicket: parseNum(form.fixedPerTicket) ?? 0 },
    feeGstRate: parseNum(form.feeGstRate) ?? 18,
    deductions: { tcsPercent: parseNum(form.tcsPercent) ?? 0, tdsPercent: parseNum(form.tdsPercent) ?? 0 },
  };
  const effective = resolveFeeConfig(draftConfig);

  // Cheap to compute, and `effective` is rebuilt every render anyway — no memo.
  const preview = (() => {
    const price = parseNum(previewPrice) ?? 0;
    const { platformFee, platformFeeGst } = computePlatformFee([{ unitTotal: price, qty: 1 }], effective);
    const buyerPays = round2(price + platformFee + platformFeeGst);
    const gatewayCost = round2(buyerPays * GATEWAY_COST_PERCENT / 100 * 1.18);
    const tcs = previewHasGstin ? round2(price * effective.tcsPercent / 100) : 0;
    const tds = round2(price * effective.tdsPercent / 100);
    return { price, platformFee, platformFeeGst, buyerPays, gatewayCost, keep: round2(platformFee - gatewayCost), tcs, tds, organizerNet: round2(price - tcs - tds) };
  })();

  const saveConfig = async () => {
    const gstin = form.platformGstin.trim().toUpperCase();
    if (gstin && !/^[0-9]{2}[A-Z0-9]{13}$/.test(gstin)) {
      setMessage({ ok: false, text: 'Platform GSTIN should be 15 characters.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await setDoc(doc(db, 'platform', 'config'), {
        ...draftConfig,
        platformLegalName: form.platformLegalName.trim(),
        platformGstin: gstin,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      }, { merge: true });
      setMessage({ ok: true, text: 'Saved. New checkouts use these settings immediately.' });
    } catch (err) {
      console.error('Failed to save platform config:', err);
      const code = (err as { code?: string }).code;
      setMessage({
        ok: false,
        text: code === 'permission-denied'
          ? 'Permission denied. Deploy the latest Firestore rules (firebase deploy --only firestore:rules) and make sure you are signed in as a super admin.'
          : `Could not save: ${(err as Error).message}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const startOverride = (target: OverrideTarget) => {
    const key = eventFeeOverrideId(target.companyId, target.eventId);
    const o = overrides[key] ?? {};
    setOverrideForm({
      percent: str(o.percent),
      fixedPerTicket: str(o.fixedPerTicket),
      tcsPercent: str(o.tcsPercent),
      tdsPercent: str(o.tdsPercent),
      note: o.note ?? '',
    });
    setEditingId(key);
  };

  const saveOverride = async (target: OverrideTarget) => {
    const key = eventFeeOverrideId(target.companyId, target.eventId);
    setOverrideSaving(true);
    try {
      const data = {
        percent: parseNum(overrideForm.percent) ?? null,
        fixedPerTicket: parseNum(overrideForm.fixedPerTicket) ?? null,
        tcsPercent: parseNum(overrideForm.tcsPercent) ?? null,
        tdsPercent: parseNum(overrideForm.tdsPercent) ?? null,
        note: overrideForm.note.trim(),
      };
      const isEmpty = data.percent === null && data.fixedPerTicket === null && data.tcsPercent === null && data.tdsPercent === null;
      if (isEmpty) {
        await deleteDoc(doc(db, 'eventFeeOverrides', key));
      } else {
        await setDoc(doc(db, 'eventFeeOverrides', key), {
          ...data,
          companyId: target.companyId,
          eventId: target.eventId,
          eventTitle: target.eventTitle,
          updatedAt: serverTimestamp(),
          updatedBy: uid,
        });
      }
      setEditingId(null);
      await loadOverrides();
    } catch (err) {
      console.error('Failed to save event fee:', err);
      alert('Could not save the custom fee. Make sure the latest Firestore rules are deployed.');
    } finally {
      setOverrideSaving(false);
    }
  };

  const clearOverride = async (target: OverrideTarget) => {
    if (!window.confirm(`Remove the custom fee for "${target.eventTitle}"? It will go back to the default fee.`)) return;
    await deleteDoc(doc(db, 'eventFeeOverrides', eventFeeOverrideId(target.companyId, target.eventId)));
    await loadOverrides();
  };

  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? id;

  // Filter box narrows the active-events list by event or organizer name.
  const visibleEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!activeEvents) return [];
    if (!q) return activeEvents;
    return activeEvents.filter(
      (e) => e.title.toLowerCase().includes(q) || companyName(e.companyId).toLowerCase().includes(q)
    );
    // companyName reads `companies`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEvents, companies, search]);

  // Custom fees on events that aren't currently published (drafts, completed…)
  // — still listed so they can be cleared.
  const inactiveOverrides = useMemo(() => {
    const active = new Set((activeEvents ?? []).map((e) => eventFeeOverrideId(e.companyId, e.id)));
    return Object.entries(overrides)
      .filter(([key, o]) => o.companyId && o.eventId && !active.has(key))
      .map(([, o]) => ({ companyId: o.companyId as string, eventId: o.eventId as string, eventTitle: o.eventTitle || (o.eventId as string) }));
  }, [activeEvents, overrides]);

  const eventMeta = (e: EventRow) =>
    [
      companyName(e.companyId),
      e.date ? new Date(`${e.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null,
      e.paymentCollectionMode === 'gateway'
        ? 'payment gateway'
        : e.paymentCollectionMode === 'manual_qr'
          ? 'manual UPI QR (no fee charged)'
          : null,
    ]
      .filter(Boolean)
      .join(' · ');

  // One row per event: its current fee, and an inline editor for a custom fee.
  const renderEventFeeRow = (target: OverrideTarget, meta?: string) => {
    const key = eventFeeOverrideId(target.companyId, target.eventId);
    const o = overrides[key];
    const eff = resolveFeeConfig(draftConfig, o);
    return (
      <div key={key} className="rounded-sm border border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{target.eventTitle}</p>
            {meta && <p className="text-[11px] text-slate-500">{meta}</p>}
          </div>
          <div className="flex items-center gap-2">
            {o ? (
              <span className="text-[#007A78] bg-[#007A78]/10 dark:text-[#2DD4BF] dark:bg-[#2DD4BF]/15 px-2 py-0.5 rounded uppercase text-[10px] font-bold">Custom</span>
            ) : (
              <span className="text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded uppercase text-[10px] font-bold">Default</span>
            )}
            <span className="text-xs text-slate-600 dark:text-slate-300">{describeFee(eff)} · TCS {eff.tcsPercent}% · TDS {eff.tdsPercent}%</span>
          </div>
        </div>
        {o?.note && editingId !== key && <p className="text-[11px] text-slate-500">Note: {o.note}</p>}
        {editingId === key ? (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(['percent', 'fixedPerTicket', 'tcsPercent', 'tdsPercent'] as const).map((k) => (
                <div key={k}>
                  <label className={labelClass}>{{ percent: 'Fee %', fixedPerTicket: 'Fixed ₹ per ticket', tcsPercent: 'TCS %', tdsPercent: 'TDS %' }[k]}</label>
                  <input
                    inputMode="decimal"
                    value={overrideForm[k]}
                    placeholder="default"
                    onChange={(e) => setOverrideForm((f) => ({ ...f, [k]: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
            <input value={overrideForm.note} onChange={(e) => setOverrideForm((f) => ({ ...f, note: e.target.value }))} placeholder="Note (e.g. charity event, launch offer)" className={inputClass} />
            <div className="flex gap-2">
              <button type="button" onClick={() => saveOverride(target)} disabled={overrideSaving} className={primaryBtn}>
                {overrideSaving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => setEditingId(null)} className={secondaryBtn}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={() => startOverride(target)} className={secondaryBtn}>{o ? 'Edit custom fee' : 'Set custom fee'}</button>
            {o && <button type="button" onClick={() => clearOverride(target)} className={secondaryBtn}>Use default</button>}
          </div>
        )}
      </div>
    );
  };

  if (!checked) return null;
  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-[#0F172A] p-6 text-center">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">ACCESS DENIED</h1>
          <p className="mt-2 text-sm text-slate-500">This page is for platform super admins only.</p>
        </div>
      </div>
    );
  }

  const field = (key: keyof ConfigForm, label: string, suffix?: string, hint?: string) => (
    <div>
      <label htmlFor={`cfg-${key}`} className={labelClass}>{label}{suffix ? ` (${suffix})` : ''}</label>
      <input
        id={`cfg-${key}`}
        inputMode="decimal"
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className={inputClass}
      />
      {hint && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-16">
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-6 py-4 relative">
        <div className="absolute left-6 top-1/2 -translate-y-1/2">
          <button onClick={() => navigate(-1)} className="p-2 rounded-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft size={20} />
          </button>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Payments &amp; Platform Fee</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Online payments, fee charged to attendees, TCS / TDS on payouts</p>
        </div>
      </header>

      <main className="grow overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto max-w-4xl flex flex-col gap-4">
          {/* Gateway switch */}
          <div className={`${cardClass} flex items-center justify-between gap-4`}>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Online payment gateway</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                When on, organizers can choose &quot;Payment gateway&quot; and attendees pay into the platform&apos;s Razorpay account.
                {!rawConfig && ' Not configured yet, so it stays off until you save.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.gatewayEnabled}
              onClick={() => setForm((f) => ({ ...f, gatewayEnabled: !f.gatewayEnabled }))}
              className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition-colors ${form.gatewayEnabled ? 'bg-[#007A78]' : 'bg-gray-300'}`}
            >
              <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${form.gatewayEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Fee + taxes */}
          <div className={`${cardClass} flex flex-col gap-4`}>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Platform fee (paid by the attendee)</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Charged per paid ticket and added on top of the ticket price at checkout. Free tickets have no fee. Individual events can be given a custom fee below.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {field('percent', 'Fee', '% of ticket price')}
              {field('fixedPerTicket', 'Fixed fee', '₹ per ticket')}
              {field('feeGstRate', 'GST on fee', '%', '18% applies to platform/convenience fees.')}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Withheld from organizer payouts</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                As an e-commerce operator collecting on organizers&apos; behalf. Locked into each order when it is placed. Confirm the rates with your CA.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {field('tcsPercent', 'GST TCS, sec 52', '%', '0.5% of taxable value. Only applied when the organizer has a GSTIN. File GSTR-8 monthly.')}
              {field('tdsPercent', 'Income-tax TDS, sec 194-O', '%', '0.1% (5% if no PAN). Use a per-organizer override of 0 for exempt organizers.')}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="cfg-legal" className={labelClass}>Platform legal name (for fee invoices)</label>
                <input id="cfg-legal" value={form.platformLegalName} onChange={(e) => setForm((f) => ({ ...f, platformLegalName: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label htmlFor="cfg-gstin" className={labelClass}>Platform GSTIN</label>
                <input id="cfg-gstin" value={form.platformGstin} onChange={(e) => setForm((f) => ({ ...f, platformGstin: e.target.value.toUpperCase() }))} maxLength={15} className={`${inputClass} font-mono`} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={saveConfig} disabled={saving || !configLoaded} className={primaryBtn}>
                {saving ? 'Saving…' : 'Save settings'}
              </button>
              {message && <p className={`text-xs font-bold ${message.ok ? 'text-emerald-600' : 'text-red-500'}`}>{message.text}</p>}
            </div>
          </div>

          {/* Preview */}
          <div className={`${cardClass} flex flex-col gap-3`}>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Preview: {describeFee(effective)}</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-40">
                <label htmlFor="preview-price" className={labelClass}>Ticket price (₹)</label>
                <input id="preview-price" inputMode="decimal" value={previewPrice} onChange={(e) => setPreviewPrice(e.target.value)} className={inputClass} />
              </div>
              <label className="flex items-center gap-2 pb-2 text-xs text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={previewHasGstin} onChange={(e) => setPreviewHasGstin(e.target.checked)} />
                Organizer is GST-registered
              </label>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-slate-300 sm:max-w-md">
              <dt>Ticket</dt><dd className="text-right">{inr(preview.price)}</dd>
              <dt>Platform fee</dt><dd className="text-right">{inr(preview.platformFee)}</dd>
              <dt>GST on fee ({effective.feeGstRate}%)</dt><dd className="text-right">{inr(preview.platformFeeGst)}</dd>
              <dt className="font-bold text-slate-900 dark:text-white">Attendee pays</dt><dd className="text-right font-bold text-slate-900 dark:text-white">{inr(preview.buyerPays)}</dd>
              <dt className="pt-2">Est. Razorpay charges ({GATEWAY_COST_PERCENT}% + GST)</dt><dd className="pt-2 text-right">− {inr(preview.gatewayCost)}</dd>
              <dt className="font-bold text-slate-900 dark:text-white">Platform keeps (excl. GST)</dt>
              <dd className={`text-right font-bold ${preview.keep < 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>{inr(preview.keep)}</dd>
              <dt className="pt-2">Organizer: TCS / TDS withheld</dt><dd className="pt-2 text-right">− {inr(preview.tcs + preview.tds)}</dd>
              <dt className="font-bold text-slate-900 dark:text-white">Organizer is paid out</dt><dd className="text-right font-bold text-slate-900 dark:text-white">{inr(preview.organizerNet)}</dd>
            </dl>
            {preview.keep < 0 && (
              <p className="text-xs font-bold text-red-500">At this price the fee doesn&apos;t cover the gateway charges. Consider a higher fee.</p>
            )}
          </div>

          {/* Custom fee per event */}
          <div className={`${cardClass} flex flex-col gap-3`}>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Custom fee per event</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Give a single event a different fee or TCS/TDS rate. Leave a field empty to use the default above. New checkouts for that event use it straight away.
              </p>
            </div>

            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by event or organizer name"
                className={`${inputClass} pl-9`}
              />
            </div>

            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Active events{activeEvents ? ` (${visibleEvents.length})` : ''}
            </p>
            {eventsError && <p className="text-xs font-bold text-red-500">{eventsError}</p>}
            {activeEvents === null && <p className="text-xs text-slate-500">Loading events…</p>}
            {activeEvents && visibleEvents.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {search.trim() ? 'No active events match.' : 'No published events right now.'}
              </p>
            )}
            {visibleEvents.map((e) =>
              renderEventFeeRow({ companyId: e.companyId, eventId: e.id, eventTitle: e.title }, eventMeta(e))
            )}

            {inactiveOverrides.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Unpublished events with a custom fee</p>
                {inactiveOverrides.map((t) => renderEventFeeRow(t, companyName(t.companyId)))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SuperAdminPayments;
