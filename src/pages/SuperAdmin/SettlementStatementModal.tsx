import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getCountFromServer, getDoc, query, where } from 'firebase/firestore';
import { X, Download, CheckCircle2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { round2 } from '../../lib/platformFee';
import { stripHtmlTags } from '../../lib/utils';
import { usePlatformFeeConfig } from '../../hooks/usePlatformPayments';
import {
  calculateSettlement,
  downloadPayoutSettlementPdf,
  type SettlementStatementInput,
} from '../../lib/payoutSettlementPdf';

const inputClass =
  'w-full rounded-sm border border-slate-200 dark:border-slate-700 bg-[#F9FAFB] dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#007A78]';
const labelClass = 'block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1';

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const inr = (n: number) => `₹${round2(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface SettlementTarget {
  companyId: string;
  companyName: string;
  eventId: string;
  eventTitle: string;
  ticketsGross: number;
  tickets: number;
  payoutAccountName?: string;
}

interface Props {
  target: SettlementTarget | null;
  onClose: () => void;
  // Lets this statement's calculated amount prefill the "Record a payout"
  // field on the page behind it — the number here, built from the real
  // gateway-fee deal, is what the ledger's TCS/TDS-based balance doesn't
  // capture.
  onApplyAmount?: (amount: number) => void;
}

/** Super Admin → Payouts → "Statement": builds an editable settlement PDF for one event. */
const SettlementStatementModal: React.FC<Props> = ({ target, onClose, onApplyAmount }) => {
  const { config } = usePlatformFeeConfig(target?.companyId, target?.eventId);
  const [form, setForm] = useState<SettlementStatementInput | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(false);

  useEffect(() => {
    if (!target) {
      setForm(null);
      return;
    }
    const issuedDate = todayISO();
    const defaults: SettlementStatementInput = {
      refNo: '',
      issuedDate,
      payableTo: target.payoutAccountName || target.companyName,
      eventTitle: stripHtmlTags(target.eventTitle),
      eventDate: '',
      venue: '',
      soldOnOutsold: target.tickets,
      priceEach: target.tickets > 0 ? round2(target.ticketsGross / target.tickets) : 0,
      walkIns: 0,
      gatewayFeePercent: 2, // Razorpay's standard domestic rate — editable per the organizer's actual deal
      gstOnFeePercent: 18,
      payoutDueDate: addDaysISO(issuedDate, 3),
      contactInfo: '',
    };
    setForm(defaults);

    // Best-effort: pull the event's actual date/venue, and count actual
    // walk-in attendees (isWalkIn === true, written by createWalkInAttendees)
    // — neither is tracked in the payout ledger itself.
    setLoadingEvent(true);
    Promise.all([
      getDoc(doc(db, 'companies', target.companyId, 'events', target.eventId)),
      getCountFromServer(
        query(
          collection(db, 'companies', target.companyId, 'events', target.eventId, 'attendees'),
          where('isWalkIn', '==', true)
        )
      ),
    ])
      .then(([eventSnap, walkInCount]) => {
        const data = eventSnap.exists() ? eventSnap.data() : null;
        setForm((f) =>
          f
            ? {
                ...f,
                eventDate: data?.date || f.eventDate,
                venue: data ? (data.isOnline ? 'Online' : data.venue || f.venue) : f.venue,
                walkIns: walkInCount.data().count,
              }
            : f
        );
      })
      .catch((err) => console.error('Failed to load event details for statement:', err))
      .finally(() => setLoadingEvent(false));
  }, [target]);

  // Once the platform's default gateway fee % is known, use it as the
  // starting point instead of the hardcoded 2% guess — still editable.
  useEffect(() => {
    if (!config) return;
    setForm((f) => (f ? { ...f, gstOnFeePercent: config.feeGstRate ?? f.gstOnFeePercent } : f));
  }, [config]);

  const calc = useMemo(() => (form ? calculateSettlement(form) : null), [form]);

  const set = <K extends keyof SettlementStatementInput>(key: K, value: SettlementStatementInput[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  if (!target || !form) return null;

  const handleDownload = () => {
    downloadPayoutSettlementPdf(form).catch((err) => {
      console.error('Failed to generate settlement PDF:', err);
      alert('Could not generate the PDF. Please try again.');
    });
  };

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-md bg-white dark:bg-[#1E293B] shadow-xl border border-slate-200 dark:border-slate-800">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Settlement statement</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{stripHtmlTags(target.eventTitle)}{loadingEvent ? ' · loading event details…' : ''}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Ref. no.</label>
              <input value={form.refNo} onChange={(e) => set('refNo', e.target.value)} placeholder="e.g. ATMH001" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Issued date</label>
              <input type="date" value={form.issuedDate} onChange={(e) => set('issuedDate', e.target.value)} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Payable to</label>
              <input value={form.payableTo} onChange={(e) => set('payableTo', e.target.value)} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Event</label>
              <input value={form.eventTitle} onChange={(e) => set('eventTitle', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Event date</label>
              <input type="date" value={form.eventDate} onChange={(e) => set('eventDate', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Venue</label>
              <input value={form.venue} onChange={(e) => set('venue', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Sold on Outsold</label>
              <input
                type="number"
                min={0}
                value={form.soldOnOutsold}
                onChange={(e) => set('soldOnOutsold', Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Price each (₹)</label>
              <input
                type="number"
                min={0}
                value={form.priceEach}
                onChange={(e) => set('priceEach', Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Walk-ins</label>
              <input type="number" min={0} value={form.walkIns} onChange={(e) => set('walkIns', Number(e.target.value))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Payout due date</label>
              <input type="date" value={form.payoutDueDate} onChange={(e) => set('payoutDueDate', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Payment gateway fee (%)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.gatewayFeePercent}
                onChange={(e) => set('gatewayFeePercent', Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>GST on gateway fee (%)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.gstOnFeePercent}
                onChange={(e) => set('gstOnFeePercent', Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Contact for questions</label>
              <input
                value={form.contactInfo}
                onChange={(e) => set('contactInfo', e.target.value)}
                placeholder="email or phone shown on the statement"
                className={inputClass}
              />
            </div>
          </div>

          {calc && (
            <div className="rounded-sm border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-1">Preview</p>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                <dt>Gross ticket sales</dt><dd className="text-right">{inr(calc.grossTicketSales)}</dd>
                <dt>Payment gateway fee</dt><dd className="text-right">− {inr(calc.gatewayFee)}</dd>
                <dt>GST on gateway fee</dt><dd className="text-right">− {inr(calc.gstOnGatewayFee)}</dd>
                <dt className="font-bold text-slate-900 dark:text-white">Net payable (before rounding)</dt>
                <dd className="text-right font-bold text-slate-900 dark:text-white">{inr(calc.netPayableBeforeRounding)}</dd>
                <dt className="font-bold text-[#007A78] dark:text-[#2DD4BF]">Amount due (rounded)</dt>
                <dd className="text-right font-bold text-[#007A78] dark:text-[#2DD4BF]">₹{calc.amountDue.toLocaleString('en-IN')}</dd>
              </dl>
              {onApplyAmount && (
                <button
                  type="button"
                  onClick={() => onApplyAmount(calc.amountDue)}
                  className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[#007A78] dark:text-[#2DD4BF] hover:underline"
                >
                  <CheckCircle2 size={13} /> Use ₹{calc.amountDue.toLocaleString('en-IN')} for "Record a payout" below
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-sm border border-slate-200 dark:border-slate-700 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-sm bg-[#007A78] hover:bg-[#006361] dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5] py-2.5 text-xs font-bold text-white dark:text-slate-950"
            >
              <Download size={14} /> Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettlementStatementModal;
