import React, { useState } from 'react';
import { X, Upload, Copy, Check, Loader2 } from 'lucide-react';
import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { compressImageToTargetSize } from '../lib/imageCompression';
import type { PublicEvent } from '../data/events';

interface Breakdown {
  id: string;      // tierId
  name: string;    // tierName
  qty: number;
  subtotal: number;
  price: number;
}

interface Props {
  event: PublicEvent;
  totalAmount: number;
  breakdown: Breakdown[];
  quantities: Record<string, number>;
  onClose: () => void;
  onSuccess: () => void;
}

// Same scheme as CheckoutPage's getEventInitials — kept identical so
// gateway and manual-QR tickets look consistent to the organizer.
const getEventInitials = (title: string): string => {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'EV';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
};

const ManualQRPaymentCard: React.FC<Props> = ({ event, totalAmount, breakdown, quantities, onClose, onSuccess }) => {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false); // NEW

  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be under 10 MB.');
      return;
    }
    setError(null);
    setIsCompressing(true);
    try {
      // Screenshots are photos of a screen — jpeg + target-size compression,
      // capped around 500KB, keeps Storage usage predictable regardless of
      // how large the source phone screenshot is.
      const compressed = await compressImageToTargetSize(file, 500, {
        maxWidth: 1280,
        maxHeight: 1280,
        mimeType: 'image/jpeg',
      });
      setScreenshot(compressed);
    } catch {
      setError('Could not process that image, please try another.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleCopyUpi = async () => {
    await navigator.clipboard.writeText(event.upiId || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSubmit = async () => {
    if (!screenshot || !consentChecked || totalAmount <= 0 || !buyerName.trim() || !buyerPhone.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const orderStamp = Date.now();

      // 1. Upload the payment screenshot once — reused as proof on every
      //    attendee doc created from this single payment.
      const shotRef = ref(storage, `companies/${event.companyId}/events/${event.id}/manual-payments/${orderStamp}.jpg`);
      await uploadString(shotRef, screenshot, 'data_url');
      const screenshotUrl = await getDownloadURL(shotRef);

            // 2 & 3. Atomically bump `sold` AND create attendee docs in the same
      //    transaction — mirrors CheckoutPage: initials + running count of
      //    tickets already sold, so IDs stay sequential and consistent
      //    across both gateway and manual-QR purchases.
      const eventRef = doc(db, 'companies', event.companyId, 'events', event.id);
      const attendeesRef = collection(db, 'companies', event.companyId, 'events', event.id, 'attendees');
      const initials = getEventInitials(event.title);

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(eventRef);
        if (!snap.exists()) throw new Error('Event not found');
        const data = snap.data();
        const currentTiers = (data.tiers || []) as { id: string; name: string; quantity: number; sold: number }[];

        const updatedTiers = currentTiers.map((t) => {
          const qty = quantities[t.id] ?? 0;
          if (qty <= 0) return t;
          const currentSold = Number.isFinite(t.sold) ? t.sold : 0; // heal bad/NaN data
          const remaining = t.quantity - currentSold;
          if (qty > remaining) throw new Error(`Not enough "${t.name}" tickets left`);
          return { ...t, sold: currentSold + qty };
        });

        const totalAlreadySold = currentTiers.reduce(
          (sum, t) => sum + (Number.isFinite(t.sold) ? t.sold : 0),
          0
        );

        tx.update(eventRef, { tiers: updatedTiers });

        let index = 0;
        breakdown.forEach((tier) => {
          for (let i = 0; i < tier.qty; i++) {
            const attendeeDoc = doc(attendeesRef);
            const ticketNumber = totalAlreadySold + index + 1;
            const ticketId = `${initials}-${String(ticketNumber).padStart(3, '0')}`;

            tx.set(attendeeDoc, {
              name: buyerName.trim(),
              email: buyerEmail.trim(),
              phone: buyerPhone.trim(),
              tierName: tier.name,
              ticketTierId: tier.id,
              ticketId,
              status: 'valid',
              amountPaid: tier.price,
              purchasedAt: serverTimestamp(),
              checkedInAt: null,
              paymentMethod: 'manual_qr',
              screenshotUrl,
            });
            index += 1;
          }
        });
      });

      setSubmitted(true);
      onSuccess();
    } catch (e: any) {
      console.error('Manual QR payment submission failed:', e);
      setError(e?.message || 'Something went wrong while submitting. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-sm bg-white dark:bg-[#1E293B] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 p-3">
          <h2 className="text-base font-bold text-slate-800 dark:text-white">Complete payment</h2>
          <button onClick={onClose} className="rounded-sm p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <Check size={40} className="text-[#007A78] dark:text-[#2DD4BF]" />
            <p className="text-sm font-semibold text-slate-800 dark:text-white">You're on the list! 🎉</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your entry is confirmed. Carry the payment screenshot — it'll be checked against our records at the door.
            </p>
            <button
              onClick={onClose}
              className="mt-2 rounded-sm bg-[#007A78] px-4 py-2 text-sm font-semibold text-white hover:bg-[#006361]"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="grow overflow-y-auto p-4 space-y-4">
            {/* Order breakdown */}
            <div className="rounded-sm bg-slate-50 dark:bg-slate-800 p-3 space-y-1">
              {breakdown.map((b) => (
                <div key={b.id} className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>{b.qty}× {b.name}</span>
                  <span>₹{b.subtotal.toLocaleString('en-IN')}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1.5 text-sm font-bold text-slate-800 dark:text-white">
                <span>Total</span>
                <span>₹{totalAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {event.payeeName || 'Kindly pay the exact amount on the below QR'}
            </p>

            {event.qrImageUrl ? (
              <img src={event.qrImageUrl} alt="Payment QR" className="mx-auto w-48 h-48 rounded-sm border border-slate-200 dark:border-slate-700 object-contain bg-white" />
            ) : (
              <p className="text-xs text-red-500">QR not set up by the organizer.</p>
            )}

            {event.upiId && (
              <button
                onClick={handleCopyUpi}
                className="mx-auto flex items-center gap-1.5 rounded-sm border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                {event.upiId} {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            )}

            {/* Buyer details — needed so the attendee doc is complete, like a normal ticket */}
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Full name *"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                className="w-full rounded-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-[#007A78]"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="tel"
                  placeholder="Phone *"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className="rounded-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-[#007A78]"
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  className="rounded-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-[#007A78]"
                />
              </div>
            </div>

            {/* Screenshot upload */}
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Upload the screenshot once done *</p>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border-2 border-dashed border-slate-300 dark:border-slate-600 p-4 text-center hover:bg-slate-50 dark:hover:bg-slate-800">
                {isCompressing ? (
                  <Loader2 size={18} className="animate-spin text-slate-400" />
                ) : (
                  <Upload size={18} className="text-slate-400" />
                )}
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {isCompressing
                    ? 'Processing image…'
                    : screenshot
                      ? 'Screenshot selected — tap to change'
                      : 'Click to choose a file or drag here'}
                </span>
                <span className="text-[10px] text-slate-400">Size limit 10 MB</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isCompressing}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </label>
              {screenshot && (
                <img src={screenshot} alt="Screenshot preview" className="mt-2 max-h-32 rounded-sm border border-slate-200 dark:border-slate-700 mx-auto" />
              )}
            </div>

            <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 bg-white accent-[#007A78] [color-scheme:light]"
              />
              I confirm I've paid the exact amount. No separate confirmation message will be sent — my ticket(s) are
              confirmed now and payment will be checked against this screenshot at entry.
            </label>

            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}

        {!submitted && (
          <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3">
            <button
              onClick={handleSubmit}
              disabled={!screenshot || !consentChecked || !buyerName.trim() || !buyerPhone.trim() || submitting || isCompressing}
              className="w-full rounded-sm bg-[#007A78] py-2.5 text-sm font-semibold text-white hover:bg-[#006361] disabled:opacity-40"
            >
              {submitting ? 'Submitting…' : "I've paid — confirm my ticket"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualQRPaymentCard;