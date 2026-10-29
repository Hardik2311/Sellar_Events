import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, query, where, type Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ArrowLeft, ChevronDown, ChevronRight, FileText, Search } from 'lucide-react';
import { db, paymentFunctions } from '../../lib/firebase';
import { round2 } from '../../lib/platformFee';
import { stripHtmlTags } from '../../lib/utils';
import { useSuperAdmin, type PayoutAccount, type PayoutLedger } from '../../hooks/usePlatformPayments';
import SettlementStatementModal, { type SettlementTarget } from './SettlementStatementModal';

const inputClass =
  'w-full rounded-sm border border-slate-200 dark:border-slate-700 bg-[#F9FAFB] dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#007A78]';
const labelClass = 'block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1';
const cardClass = 'bg-white dark:bg-[#1E293B] rounded-md shadow-sm border border-slate-200 dark:border-slate-800';
const primaryBtn =
  'rounded-sm bg-[#007A78] dark:bg-[#2DD4BF] px-3 py-2 text-xs font-bold text-white dark:text-slate-950 hover:bg-[#006361] disabled:opacity-50';

const inr = (n?: number) => `₹${round2(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// Recomputed from the independently-tracked components rather than trusting
// the stored netPayable field — that field was written with the platform
// fee NOT subtracted for orders placed before the fee moved from "charged to
// the buyer" to "deducted from the organizer." The components themselves
// (ticketsGross/tcs/tds/platformFee/platformFeeGst) were always tracked
// correctly, so this self-corrects old ledger rows without a data migration.
const netPayableOf = (l: PayoutLedger) =>
  round2((l.ticketsGross ?? 0) - (l.tcs ?? 0) - (l.tds ?? 0) - (l.platformFee ?? 0) - (l.platformFeeGst ?? 0));
const balanceOf = (l: PayoutLedger) => round2(netPayableOf(l) - (l.paidOut ?? 0));

const recordPayout = httpsCallable<
  { companyId: string; amount: number; method: string; reference: string; note: string; paidAt: string; eventId?: string | null },
  { success: boolean; payoutId: string }
>(paymentFunctions, 'recordPayout');

interface LedgerRow extends PayoutLedger {
  companyId: string;
  name: string;
}
interface EventLedgerRow extends PayoutLedger {
  eventId: string;
  eventTitle?: string;
}
interface PayoutRow {
  id: string;
  amount: number;
  method: string;
  reference: string;
  note: string;
  paidAt?: Timestamp;
}
interface Detail {
  account: PayoutAccount | null;
  events: EventLedgerRow[];
  payouts: PayoutRow[];
}

const METHOD_LABELS: Record<string, string> = { bank_transfer: 'Bank transfer', upi: 'UPI', cash: 'Cash', other: 'Other' };
const today = () => new Date().toISOString().slice(0, 10);

/** Super Admin → Payouts: what the platform owes each organizer, and a log of manual payouts. */
const SuperAdminPayouts: React.FC = () => {
  const navigate = useNavigate();
  const { checked, isSuperAdmin } = useSuperAdmin();
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Detail>>({});
  const [form, setForm] = useState({ amount: '', method: 'bank_transfer', reference: '', paidAt: today(), note: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statementTarget, setStatementTarget] = useState<SettlementTarget | null>(null);

  const fetchLedgers = async (): Promise<LedgerRow[]> => {
    const [ledgerSnap, companiesSnap] = await Promise.all([
      getDocs(collection(db, 'payoutLedger')),
      getDocs(collection(db, 'companies')),
    ]);
    const names = new Map<string, string>();
    companiesSnap.forEach((d) => names.set(d.id, (d.data().name as string) || d.id));
    return ledgerSnap.docs
      .map((d) => ({ ...(d.data() as PayoutLedger), companyId: d.id, name: names.get(d.id) ?? d.id }))
      .sort((a, b) => balanceOf(b) - balanceOf(a));
  };

  const loadLedgers = async () => setRows(await fetchLedgers());

  const loadDetail = useCallback(async (companyId: string) => {
    const [accountSnap, eventsSnap, payoutsSnap] = await Promise.all([
      getDoc(doc(db, 'payoutAccounts', companyId)),
      getDocs(collection(db, 'payoutLedger', companyId, 'events')),
      getDocs(query(collection(db, 'payouts'), where('companyId', '==', companyId))),
    ]);
    setDetails((d) => ({
      ...d,
      [companyId]: {
        account: accountSnap.exists() ? (accountSnap.data() as PayoutAccount) : null,
        events: eventsSnap.docs.map((e) => ({ ...(e.data() as EventLedgerRow), eventId: e.id })),
        payouts: payoutsSnap.docs
          .map((p) => ({ id: p.id, ...(p.data() as Omit<PayoutRow, 'id'>) }))
          .sort((a, b) => (b.paidAt?.toMillis() ?? 0) - (a.paidAt?.toMillis() ?? 0)),
      },
    }));
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    let cancelled = false;
    fetchLedgers()
      .then((data) => { if (!cancelled) setRows(data); })
      .catch((err) => console.error('Failed to load payout ledgers:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isSuperAdmin]);

  const toggle = (row: LedgerRow) => {
    if (expanded === row.companyId) {
      setExpanded(null);
      return;
    }
    setExpanded(row.companyId);
    setForm({ amount: String(Math.max(0, balanceOf(row))), method: 'bank_transfer', reference: '', paidAt: today(), note: '' });
    setFormError(null);
    if (!details[row.companyId]) loadDetail(row.companyId).catch((err) => console.error('Failed to load payout detail:', err));
  };

  const submitPayout = async (row: LedgerRow) => {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount === 0) return setFormError('Enter an amount.');
    if (amount > 0 && !form.reference.trim()) return setFormError('Enter the bank / UPI reference (UTR).');
    if (amount > balanceOf(row) && !window.confirm(`${inr(amount)} is more than the balance due (${inr(balanceOf(row))}). Record anyway?`)) return;
    setSaving(true);
    setFormError(null);
    try {
      await recordPayout({
        companyId: row.companyId,
        amount,
        method: form.method,
        reference: form.reference.trim(),
        note: form.note.trim(),
        paidAt: new Date(`${form.paidAt}T12:00:00`).toISOString(),
      });
      await Promise.all([loadLedgers(), loadDetail(row.companyId)]);
      setForm((f) => ({ ...f, amount: '0', reference: '', note: '' }));
    } catch (err) {
      setFormError((err as Error).message || 'Could not record the payout.');
    } finally {
      setSaving(false);
    }
  };

  const totals = useMemo(
    () =>
      rows.reduce(
        (t, r) => ({
          balance: t.balance + balanceOf(r),
          fee: t.fee + (r.platformFee ?? 0),
          feeGst: t.feeGst + (r.platformFeeGst ?? 0),
          tcs: t.tcs + (r.tcs ?? 0),
          tds: t.tds + (r.tds ?? 0),
        }),
        { balance: 0, fee: 0, feeGst: 0, tcs: 0, tds: 0 }
      ),
    [rows]
  );

  const visible = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || r.companyId.toLowerCase().includes(q);
  });

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

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-16">
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-6 py-4 relative">
        <div className="absolute left-6 top-1/2 -translate-y-1/2">
          <button onClick={() => navigate(-1)} className="p-2 rounded-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft size={20} />
          </button>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Organizer Payouts</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ticket money collected online and owed to organizers</p>
        </div>
      </header>

      <main className="grow overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto max-w-5xl flex flex-col gap-4">
          {/* Totals */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: 'Balance due to organizers', value: totals.balance, strong: true },
              { label: 'Platform fee earned', value: totals.fee },
              { label: 'GST on fee collected', value: totals.feeGst },
              { label: 'TCS withheld (GSTR-8)', value: totals.tcs },
              { label: 'TDS withheld (194-O)', value: totals.tds },
            ].map((t) => (
              <div key={t.label} className={`${cardClass} p-3`}>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{t.label}</p>
                <p className={`mt-1 ${t.strong ? 'text-lg font-extrabold text-[#007A78] dark:text-[#2DD4BF]' : 'text-base font-bold text-slate-900 dark:text-white'}`}>{inr(t.value)}</p>
              </div>
            ))}
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search organizers" className={`${inputClass} pl-9`} />
          </div>

          {loading && <p className="text-sm text-slate-500">Loading…</p>}
          {!loading && visible.length === 0 && (
            <p className="text-sm text-slate-500">No online sales yet. Organizers appear here after their first paid gateway order.</p>
          )}

          {visible.map((row) => {
            const open = expanded === row.companyId;
            const detail = details[row.companyId];
            const balance = balanceOf(row);
            return (
              <div key={row.companyId} className={cardClass}>
                <button type="button" onClick={() => toggle(row)} className="w-full p-4 flex flex-col gap-2 text-left sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{row.name}</p>
                      <p className="text-[11px] text-slate-500">{row.orders ?? 0} orders · {row.tickets ?? 0} tickets</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs sm:text-right">
                    <div><p className="text-slate-500">Net payable</p><p className="font-semibold">{inr(netPayableOf(row))}</p></div>
                    <div><p className="text-slate-500">Paid out</p><p className="font-semibold">{inr(row.paidOut)}</p></div>
                    <div>
                      <p className="text-slate-500">Balance due</p>
                      <p className={`font-extrabold ${balance > 0 ? 'text-[#007A78] dark:text-[#2DD4BF]' : 'text-slate-900 dark:text-white'}`}>{inr(balance)}</p>
                    </div>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-4 text-xs">
                    {/* Breakdown */}
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-slate-600 dark:text-slate-300 sm:max-w-md">
                      <dt>Ticket sales collected</dt><dd className="text-right">{inr(row.ticketsGross)}</dd>
                      <dt>Platform fee + GST</dt><dd className="text-right">− {inr((row.platformFee ?? 0) + (row.platformFeeGst ?? 0))}</dd>
                      <dt>TCS withheld</dt><dd className="text-right">− {inr(row.tcs)}</dd>
                      <dt>TDS withheld</dt><dd className="text-right">− {inr(row.tds)}</dd>
                      <dt className="font-bold text-slate-900 dark:text-white">Net payable</dt><dd className="text-right font-bold text-slate-900 dark:text-white">{inr(netPayableOf(row))}</dd>
                    </dl>

                    {!detail && <p className="text-slate-500">Loading details…</p>}
                    {detail && (
                      <>
                        {/* Bank details */}
                        <div className="rounded-sm border border-slate-200 dark:border-slate-700 p-3">
                          <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Pay to</p>
                          {detail.account ? (
                            <div className="text-slate-700 dark:text-slate-200 space-y-0.5">
                              <p>{detail.account.accountHolderName}</p>
                              <p className="font-mono">A/c {detail.account.accountNumber} · IFSC {detail.account.ifsc}</p>
                              <p>{detail.account.bankName}{detail.account.upiId ? ` · UPI ${detail.account.upiId}` : ''}</p>
                            </div>
                          ) : (
                            <p className="text-amber-700 dark:text-amber-300">No payout bank account on file.</p>
                          )}
                        </div>

                        {/* Per event */}
                        {detail.events.length > 0 && (
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1">By event</p>
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                              {detail.events.map((e) => (
                                <div key={e.eventId} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                                  <span className="truncate">{stripHtmlTags(e.eventTitle) || e.eventId} <span className="text-slate-500">({e.tickets ?? 0} tickets)</span></span>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <span>sales {inr(e.ticketsGross)} · net {inr(netPayableOf(e))}</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setStatementTarget({
                                          companyId: row.companyId,
                                          companyName: row.name,
                                          eventId: e.eventId,
                                          eventTitle: e.eventTitle || e.eventId,
                                          ticketsGross: e.ticketsGross ?? 0,
                                          tickets: e.tickets ?? 0,
                                          payoutAccountName: detail.account?.accountHolderName,
                                        })
                                      }
                                      className="flex items-center gap-1 rounded-sm border border-slate-300 dark:border-slate-700 px-2 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                    >
                                      <FileText size={11} /> Statement
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Record payout */}
                        <div className="rounded-sm border border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-2">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">Record a payout</p>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <div>
                              <label className={labelClass}>Amount (₹)</label>
                              <input inputMode="decimal" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className={inputClass} />
                            </div>
                            <div>
                              <label className={labelClass}>Method</label>
                              <select value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))} className={inputClass}>
                                {Object.entries(METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className={labelClass}>Reference / UTR</label>
                              <input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} className={inputClass} />
                            </div>
                            <div>
                              <label className={labelClass}>Paid on</label>
                              <input type="date" value={form.paidAt} onChange={(e) => setForm((f) => ({ ...f, paidAt: e.target.value }))} className={inputClass} />
                            </div>
                          </div>
                          <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Note (optional). Use a negative amount to record an adjustment." className={inputClass} />
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={() => submitPayout(row)} disabled={saving} className={primaryBtn}>
                              {saving ? 'Recording…' : 'Record payout'}
                            </button>
                            {formError && <p className="font-bold text-red-500">{formError}</p>}
                          </div>
                        </div>

                        {/* History */}
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Payout history</p>
                          {detail.payouts.length === 0 ? (
                            <p className="text-slate-500">No payouts yet.</p>
                          ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                              {detail.payouts.map((p) => (
                                <div key={p.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                                  <span>
                                    {p.paidAt ? p.paidAt.toDate().toLocaleDateString('en-IN') : '—'} · {METHOD_LABELS[p.method] ?? p.method}
                                    {p.reference && <span className="font-mono"> · {p.reference}</span>}
                                    {p.note && <span className="text-slate-500"> · {p.note}</span>}
                                  </span>
                                  <span className="font-semibold">{inr(p.amount)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <SettlementStatementModal
        target={statementTarget}
        onClose={() => setStatementTarget(null)}
        onApplyAmount={(amount) => {
          setForm((f) => ({ ...f, amount: String(amount) }));
          setFormError(null);
          setStatementTarget(null);
        }}
      />
    </div>
  );
};

export default SuperAdminPayouts;
