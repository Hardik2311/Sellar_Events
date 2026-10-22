import React, { useState } from 'react';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Landmark } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { db } from '../lib/firebase';
import { round2 } from '../lib/platformFee';
import {
  usePayoutAccount,
  usePayoutLedger,
  usePlatformFeeConfig,
  type PayoutAccount,
} from '../hooks/usePlatformPayments';

interface Props {
  companyId: string;
  canManage: boolean; // owner only — bank details are sensitive
  payoutAccountReady: boolean; // settings/general flag, visible to team members too
}

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_RE = /^\d{9,18}$/;
const UPI_RE = /^[\w.-]{2,}@[a-zA-Z]{2,}$/;

const inputClass =
  'w-full rounded-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007A78] dark:focus:ring-[#2DD4BF]';
const labelClass = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1';

const inr = (n?: number) => `₹${round2(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const emptyForm = { accountHolderName: '', accountNumber: '', confirmAccountNumber: '', ifsc: '', bankName: '', upiId: '' };

/**
 * Settings → Event: online payments are collected into the PLATFORM's
 * gateway account; the organizer sees the fee buyers pay, adds the bank
 * account they're paid out to, and tracks what they're owed.
 */
const OnlinePaymentsCard: React.FC<Props> = ({ companyId, canManage, payoutAccountReady }) => {
  const { config, loading: configLoading } = usePlatformFeeConfig(companyId);
  const { account } = usePayoutAccount(canManage ? companyId : null);
  const ledger = usePayoutLedger(companyId);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEditing = () => {
    setForm(
      account
        ? { ...account, confirmAccountNumber: account.accountNumber, upiId: account.upiId ?? '' }
        : emptyForm
    );
    setError(null);
    setEditing(true);
  };

  const set = (key: keyof typeof emptyForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const accountNumber = form.accountNumber.replace(/\s/g, '');
    const ifsc = form.ifsc.trim().toUpperCase();
    const upiId = form.upiId.trim();
    if (!form.accountHolderName.trim()) return setError('Enter the account holder name, exactly as on the bank account.');
    if (!ACCOUNT_RE.test(accountNumber)) return setError('Account number should be 9 to 18 digits.');
    if (accountNumber !== form.confirmAccountNumber.replace(/\s/g, '')) return setError('Account numbers do not match.');
    if (!IFSC_RE.test(ifsc)) return setError('Enter a valid 11-character IFSC, like HDFC0001234.');
    if (!form.bankName.trim()) return setError('Enter the bank name.');
    if (upiId && !UPI_RE.test(upiId)) return setError('Enter a valid UPI ID, like name@bank, or leave it empty.');

    setSaving(true);
    setError(null);
    try {
      const payout: PayoutAccount & { updatedAt: ReturnType<typeof serverTimestamp> } = {
        accountHolderName: form.accountHolderName.trim(),
        accountNumber,
        ifsc,
        bankName: form.bankName.trim(),
        upiId,
        updatedAt: serverTimestamp(),
      };
      const batch = writeBatch(db);
      batch.set(doc(db, 'payoutAccounts', companyId), payout);
      batch.set(doc(db, 'companies', companyId, 'settings', 'general'), { payments: { payoutAccountReady: true } }, { merge: true });
      await batch.commit();
      setEditing(false);
    } catch (err) {
      console.error('Failed to save payout account:', err);
      setError('Could not save. Only the account owner can change payout details.');
    } finally {
      setSaving(false);
    }
  };

  const balanceDue = round2((ledger?.netPayable ?? 0) - (ledger?.paidOut ?? 0));

  return (
    <Card className="shadow-sm border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
          Online payments
          {!configLoading && (
            <span
              className={`rounded-sm px-1.5 py-0.5 text-[11px] font-bold uppercase ${
                config.gatewayEnabled
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              {config.gatewayEnabled ? 'Available' : 'Not available yet'}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Choose <b>Payment gateway</b> on an event and attendees pay online by UPI, card, net banking or wallet. Tickets are
          issued automatically. We collect the payment and pay your ticket revenue out to your bank account.
        </p>

        {/* Fee + deductions */}
        <div className="rounded-sm border border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Fees &amp; payouts</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            A small convenience fee is added on top of the ticket price and paid by the attendee at checkout. Standard payment gateway charges are deducted from your payout, and for some events a custom fee may apply as agreed with you.
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            As required by Indian tax law, applicable TDS (Section 194-O) and, if you&apos;re GST-registered, TCS (GST Section 52) are deducted from your ticket sales. Both can be claimed back in full when you file your tax returns.
          </p>
        </div>

        {/* Payout account */}
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
            <Landmark size={14} aria-hidden="true" /> Payout bank account
          </p>

          {!canManage && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {payoutAccountReady
                ? 'Added by the account owner.'
                : 'Not added yet. The account owner needs to add it before events can use the payment gateway.'}
            </p>
          )}

          {canManage && !editing && (
            <>
              {account ? (
                <div className="rounded-sm border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-700 dark:text-slate-200">
                  <p className="font-semibold">{account.accountHolderName}</p>
                  <p>
                    {account.bankName} · ••••{account.accountNumber.slice(-4)} · {account.ifsc}
                  </p>
                  {account.upiId && <p>UPI: {account.upiId}</p>}
                </div>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Add the bank account your ticket money should be paid out to. You need this before publishing an event with the payment gateway.
                </p>
              )}
              <button
                type="button"
                onClick={startEditing}
                className="self-start rounded-sm border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {account ? 'Change bank account' : 'Add bank account'}
              </button>
            </>
          )}

          {canManage && editing && (
            <form onSubmit={handleSave} className="flex flex-col gap-3">
              <div>
                <label htmlFor="payout-holder" className={labelClass}>Account holder name</label>
                <input id="payout-holder" value={form.accountHolderName} onChange={(e) => set('accountHolderName', e.target.value)} className={inputClass} autoComplete="off" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="payout-account" className={labelClass}>Account number</label>
                  <input id="payout-account" inputMode="numeric" value={form.accountNumber} onChange={(e) => set('accountNumber', e.target.value.replace(/[^\d\s]/g, ''))} className={`${inputClass} font-mono`} autoComplete="off" />
                </div>
                <div>
                  <label htmlFor="payout-account-confirm" className={labelClass}>Confirm account number</label>
                  <input id="payout-account-confirm" inputMode="numeric" value={form.confirmAccountNumber} onChange={(e) => set('confirmAccountNumber', e.target.value.replace(/[^\d\s]/g, ''))} onPaste={(e) => e.preventDefault()} className={`${inputClass} font-mono`} autoComplete="off" />
                </div>
                <div>
                  <label htmlFor="payout-ifsc" className={labelClass}>IFSC</label>
                  <input id="payout-ifsc" value={form.ifsc} onChange={(e) => set('ifsc', e.target.value.toUpperCase())} maxLength={11} placeholder="HDFC0001234" className={`${inputClass} font-mono`} autoComplete="off" />
                </div>
                <div>
                  <label htmlFor="payout-bank" className={labelClass}>Bank name</label>
                  <input id="payout-bank" value={form.bankName} onChange={(e) => set('bankName', e.target.value)} className={inputClass} autoComplete="off" />
                </div>
              </div>
              <div>
                <label htmlFor="payout-upi" className={labelClass}>UPI ID (optional)</label>
                <input id="payout-upi" value={form.upiId} onChange={(e) => set('upiId', e.target.value)} placeholder="name@bank" className={inputClass} autoComplete="off" />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-sm bg-[#007A78] hover:bg-[#006361] dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5] py-2.5 text-sm font-bold text-white dark:text-slate-950 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save bank account'}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditing(false); setError(null); }}
                  className="rounded-sm border border-slate-300 dark:border-slate-700 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          {error && <p className="text-xs font-bold text-red-500">{error}</p>}
        </div>

        {/* What we owe them */}
        {ledger && (
          <div className="rounded-sm border border-slate-200 dark:border-slate-700 p-3">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-2">Payout summary</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
              <dt>Ticket sales collected online</dt><dd className="text-right">{inr(ledger.ticketsGross)}</dd>
              <dt>TCS withheld</dt><dd className="text-right">− {inr(ledger.tcs)}</dd>
              <dt>TDS withheld</dt><dd className="text-right">− {inr(ledger.tds)}</dd>
              <dt>Paid out to you</dt><dd className="text-right">− {inr(ledger.paidOut)}</dd>
              <dt className="font-bold text-slate-900 dark:text-white">Balance due to you</dt>
              <dd className="text-right font-bold text-slate-900 dark:text-white">{inr(balanceDue)}</dd>
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OnlinePaymentsCard;
