import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Attendee } from '../types/attendee.types';
import type { EventSummary } from '../types/event.types';

interface EditAttendeeModalProps {
  attendee: Attendee | null;
  event: EventSummary | null;
  onSave: (
    id: string,
    updates: Pick<Attendee, 'name' | 'email' | 'phone' | 'tierName'> & {
      tierId?: string;
      amountPaid?: number;
      paymentMode?: Attendee['paymentMode']; // match the narrow union from attendee.types.ts, not a bare string
    }
  ) => void;
  onCancel: () => void;
}

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Other'] as const;

const EditAttendeeModal: React.FC<EditAttendeeModalProps> = ({ attendee, event, onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [tierId, setTierId] = useState('');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<typeof PAYMENT_MODES[number]>('Cash');

  // Reset the form whenever a new attendee is opened for editing
  useEffect(() => {
    if (attendee) {
      setName(attendee.name);
      setEmail(attendee.email);
      setPhone(attendee.phone);
      // fall back to matching by name if tierId isn't stored yet on old records
      const matchedTier = event?.tiers.find(
        (t) => t.id === (attendee as any).tierId || t.name === attendee.tierName
      );
      setTierId(matchedTier?.id ?? '');
      setAmountPaid((attendee as any).amountPaid ?? 0);
      setPaymentMode((attendee as any).paymentMode ?? 'Cash');
    }
  }, [attendee, event]);

  if (!attendee) return null;

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isValidPhone = /^[6-9]\d{9}$/.test(phone.trim());
  const selectedTier = event?.tiers.find((t) => t.id === tierId) ?? null;

  const showEmailError = email.trim().length > 0 && !isValidEmail;
  const showPhoneError = phone.trim().length > 0 && !isValidPhone;

  const formValid = name.trim().length > 0 && isValidEmail && isValidPhone && !!tierId;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid || !selectedTier) return;
    onSave(attendee.id, {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      tierName: selectedTier.name,
      tierId: selectedTier.id,
      amountPaid,
      paymentMode,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-sm bg-white dark:bg-slate-900 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Edit Attendee</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-sm border border-slate-200 dark:border-slate-700 bg-[#F9FAFB] dark:bg-slate-800 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`mt-1 w-full rounded-sm border bg-[#F9FAFB] dark:bg-slate-800 px-3 py-2 text-sm ${showEmailError ? 'border-red-400 focus:border-red-500' : 'border-slate-200 dark:border-slate-700'
                }`}
              required
            />
            {showEmailError && (
              <p className="mt-1 text-[11px] font-medium text-red-600">Enter a valid email address.</p>
            )}
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Phone</label>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              maxLength={10}
              className={`mt-1 w-full rounded-sm border bg-[#F9FAFB] dark:bg-slate-800 px-3 py-2 text-sm ${showPhoneError ? 'border-red-400 focus:border-red-500' : 'border-slate-200 dark:border-slate-700'
                }`}
              required
            />
            {showPhoneError && (
              <p className="mt-1 text-[11px] font-medium text-red-600">Enter a valid 10-digit phone number.</p>
            )}
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Ticket tier</label>
            <select
              value={tierId}
              onChange={(e) => {
                const t = event?.tiers.find((tier) => tier.id === e.target.value);
                setTierId(e.target.value);
                if (t) setAmountPaid(t.price);
              }}
              className="mt-1 w-full rounded-sm border border-slate-200 dark:border-slate-700 bg-[#F9FAFB] dark:bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="">Select a tier…</option>
              {event?.tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — ₹{t.price}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Amount paid (₹)</label>
              <input
                type="number"
                min={0}
                value={amountPaid}
                onChange={(e) => setAmountPaid(Number(e.target.value))}
                className="mt-1 w-full rounded-sm border border-slate-200 dark:border-slate-700 bg-[#F9FAFB] dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Payment mode</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as typeof PAYMENT_MODES[number])}
                className="mt-1 w-full rounded-sm border border-slate-200 dark:border-slate-700 bg-[#F9FAFB] dark:bg-slate-800 px-3 py-2 text-sm"
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-sm border border-slate-200 dark:border-slate-700 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formValid}
              className="flex-1 rounded-sm bg-[#007A78] hover:bg-[#006361] dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5] py-2.5 text-xs font-bold text-white dark:text-slate-950 disabled:opacity-40"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditAttendeeModal;