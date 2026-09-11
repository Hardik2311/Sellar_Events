import React, { useState, useMemo, useEffect } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import type { EventSummary } from '../types/event.types';
import { createWalkInAttendee } from '../lib/ticketing';

interface AddWalkInAttendeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventSummary | null;
  companyId: string | undefined;
  onSuccess: (name: string, ticketId: string, tierName: string) => void;
}

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Other'] as const;

// Same rule as the Attendees page: date-only comparison, time ignored.
const isEventDateInFuture = (event: EventSummary | null): boolean => {
  if (!event?.startDate) return false;
  const eventDate = new Date(event.startDate);
  const today = new Date();
  eventDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return eventDate.getTime() > today.getTime();
};

const AddWalkInAttendeeModal: React.FC<AddWalkInAttendeeModalProps> = ({
  isOpen,
  onClose,
  event,
  companyId,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [tierId, setTierId] = useState('');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<typeof PAYMENT_MODES[number]>('Cash');
  const [markCheckedIn, setMarkCheckedIn] = useState(true);
  const [allowOverbook, setAllowOverbook] = useState(false);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTier = useMemo(
    () => event?.tiers.find((t) => t.id === tierId) ?? null,
    [event, tierId]
  );

  const remaining = selectedTier ? selectedTier.total - selectedTier.sold : null;
  const isFutureEvent = isEventDateInFuture(event);

  // Force the checkbox off whenever the modal opens for an event whose date
  // hasn't arrived yet — prevents a stale "true" from a previous open.
  useEffect(() => {
    if (isOpen && isFutureEvent) {
      setMarkCheckedIn(false);
    }
  }, [isOpen, isFutureEvent]);

  if (!isOpen || !event) return null;

  const reset = () => {
    setName(''); setEmail(''); setPhone(''); setTierId('');
    setAmountPaid(0); setPaymentMode('Cash'); setMarkCheckedIn(true);
    setAllowOverbook(false); setCustomAnswers({}); setError(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  const isValidPhone = /^[6-9]\d{9}$/.test(phone.trim());
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const customFields = event.customFields ?? [];

  const formComplete =
    name.trim().length > 0 &&
    isValidEmail &&
    isValidPhone &&
    !!selectedTier &&
    customFields.every((f) => {
      if (!f.required) return true;
      const val = customAnswers[f.id] ?? '';
      return f.type === 'checkbox' ? val === 'true' : val.trim().length > 0;
    });

  const handleSubmit = async () => {
    if (!formComplete || !selectedTier || !companyId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const ticketId = await createWalkInAttendee({
        companyId,
        eventId: event.id,
        eventTitle: event.title,
        tierId: selectedTier.id,
        tierName: selectedTier.name,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        amountPaid,
        paymentMode,
        markCheckedIn: markCheckedIn && !isFutureEvent,
        allowOverbook,
        customFieldAnswers: customAnswers,
      });
      onSuccess(name.trim(), ticketId, selectedTier.name);
      reset();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not add attendee, please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-sm sm:rounded-sm bg-white dark:bg-slate-900 shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Add walk-in attendee</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          {error && (
            <div className="flex items-start gap-2 rounded-sm bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Full name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#007A78] focus:ring-1 focus:ring-[#007A78] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full rounded-sm border bg-white px-3 py-2 text-sm outline-none focus:ring-1 dark:bg-slate-800 dark:text-slate-100 ${email.trim().length > 0 && !isValidEmail
                ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-[#007A78] focus:ring-[#007A78] dark:border-slate-600'
                }`}
            />
            {email.trim().length > 0 && !isValidEmail && (
              <p className="mt-1 text-xs text-red-600">Enter a valid email address (e.g. name@example.com)</p>
            )}
          </div>
          <label className=" block text-xs font-medium text-slate-600 dark:text-slate-300">Phone</label>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            maxLength={10}
            className={`w-full rounded-sm border bg-white px-3 py-2 text-sm outline-none focus:ring-1 dark:bg-slate-800 dark:text-slate-100 ${phone.trim().length > 0 && !isValidPhone
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-[#007A78] focus:ring-[#007A78] dark:border-slate-600'
              }`}
          />
          {phone.trim().length > 0 && !isValidPhone && (
            <p className="mt-1 text-xs text-red-600">Enter a valid 10-digit mobile number starting with 6-9</p>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Ticket tier</label>
            <select
              value={tierId}
              onChange={(e) => {
                const t = event.tiers.find((tier) => tier.id === e.target.value);
                setTierId(e.target.value);
                setAmountPaid(t?.price ?? 0);
              }}
              className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#007A78] focus:ring-1 focus:ring-[#007A78] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Select a tier…</option>
              {event.tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — ₹{t.price}
                </option>
              ))}
            </select>
            {selectedTier && remaining !== null && remaining <= 0 && (
              <label className="mt-2 flex items-center gap-2 text-xs font-medium text-amber-700">
                <input
                  type="checkbox"
                  checked={allowOverbook}
                  onChange={(e) => setAllowOverbook(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 bg-white accent-[#007A78] [color-scheme:light]"
                />
                This tier shows no capacity left — add anyway
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Amount paid (₹)</label>
              <input
                type="number"
                min={0}
                value={amountPaid}
                onChange={(e) => setAmountPaid(Number(e.target.value))}
                className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#007A78] focus:ring-1 focus:ring-[#007A78] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Payment mode</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as typeof PAYMENT_MODES[number])}
                className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#007A78] focus:ring-1 focus:ring-[#007A78] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {customFields.map((field) => {
            const value = customAnswers[field.id] ?? '';
            const baseClass = 'w-full rounded-sm border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#007A78] focus:ring-1 focus:ring-[#007A78]';
            return (
              <div key={field.id}>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  {field.label}{field.required ? ' *' : ''}
                </label>
                {field.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={value === 'true'}
                      onChange={(e) => setCustomAnswers((p) => ({ ...p, [field.id]: e.target.checked ? 'true' : 'false' }))}
                      className="h-4 w-4 rounded border-gray-300 bg-white accent-[#007A78] [color-scheme:light]"
                    />
                    {field.label}
                  </label>
                ) : field.type === 'select' ? (
                  <select
                    value={value}
                    onChange={(e) => setCustomAnswers((p) => ({ ...p, [field.id]: e.target.value }))}
                    className={baseClass}
                  >
                    <option value="">Select…</option>
                    {(field.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setCustomAnswers((p) => ({ ...p, [field.id]: e.target.value }))}
                    className={baseClass}
                  />
                )}
              </div>
            );
          })}

          <label
            className={`flex items-center gap-2 text-xs font-medium ${isFutureEvent ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed' : 'text-slate-700 dark:text-slate-300'
              }`}
          >
            <input
              type="checkbox"
              checked={markCheckedIn && !isFutureEvent}
              disabled={isFutureEvent}
              onChange={(e) => setMarkCheckedIn(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 bg-white accent-[#007A78] [color-scheme:light] disabled:cursor-not-allowed disabled:opacity-50"
            />
            Mark as checked-in immediately
          </label>
          {isFutureEvent && (
            <p className="-mt-2 text-xs text-amber-600">
              Check-in opens on the event date. This attendee will be added as "not arrived".
            </p>
          )}
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 rounded-sm border border-gray-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formComplete || isSubmitting}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-sm bg-[#007A78] py-2.5 text-sm font-semibold text-white hover:bg-[#006361] disabled:opacity-40"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
            {isSubmitting ? 'Adding…' : 'Add attendee'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddWalkInAttendeeModal;