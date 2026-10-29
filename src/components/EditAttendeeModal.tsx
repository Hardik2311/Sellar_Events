import React, { useEffect, useState } from 'react';
import { X, Upload } from 'lucide-react';
import QRCode from 'qrcode';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { usePayoutAccount } from '../hooks/usePlatformPayments';
import { compressImageToTargetSize } from '../lib/imageCompression';
import type { Attendee } from '../types/attendee.types';
import type { EventSummary } from '../types/event.types';

interface EditAttendeeModalProps {
  attendee: Attendee | null;
  event: EventSummary | null;
  companyId: string | undefined;
  onSave: (
    id: string,
    updates: Pick<Attendee, 'name' | 'email' | 'phone' | 'tierName'> & {
      tierId?: string;
      amountPaid?: number;
      paymentMode?: Attendee['paymentMode']; // match the narrow union from attendee.types.ts, not a bare string
      screenshotUrl?: string | null;
    }
  ) => void;
  onCancel: () => void;
}

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Other'] as const;

const EditAttendeeModal: React.FC<EditAttendeeModalProps> = ({ attendee, event, companyId, onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [tierId, setTierId] = useState('');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<typeof PAYMENT_MODES[number]>('Cash');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // screenshot holds either the attendee's existing screenshotUrl (https…) or
  // a freshly chosen base64 preview; screenshotIsNew tells submit whether it
  // needs uploading (vs. an untouched existing URL to leave alone).
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotIsNew, setScreenshotIsNew] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [isCompressingScreenshot, setIsCompressingScreenshot] = useState(false);

  // Organizer's payout UPI id — same one shown in Event Settings → Payout
  // bank account — reused here so the QR matches whatever UPI id the
  // organizer actually has on file.
  const { account: payoutAccount } = usePayoutAccount(companyId);

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
      // Older manual-QR records were created before paymentMode was stored —
      // manual_qr always means UPI, so infer it instead of defaulting to Cash.
      setPaymentMode(
        (attendee as any).paymentMode ?? ((attendee as any).paymentMethod === 'manual_qr' ? 'UPI' : 'Cash')
      );
      setScreenshot((attendee as any).screenshotUrl ?? null);
      setScreenshotIsNew(false);
      setScreenshotError(null);
    }
  }, [attendee, event]);

  // Set once the ticket actually exists — a real online payment already
  // happened, via either the gateway or the online manual-QR checkout. The
  // "scan to collect" QR only makes sense for a walk-in-recorded payment
  // that hasn't happened yet, never for a ticket that's already paid for.
  const isOnlinePayment = !!(attendee as any)?.paymentMethod;

  // UPI QR for this amount — same upi:// deep link format as the online
  // manual-QR checkout and the walk-in modal.
  useEffect(() => {
    if (paymentMode !== 'UPI' || isOnlinePayment || !payoutAccount?.upiId || amountPaid <= 0) {
      setQrDataUrl(null);
      return;
    }
    const payeeName = payoutAccount.accountHolderName || event?.title || 'Payment';
    const upiString = `upi://pay?pa=${payoutAccount.upiId}&pn=${encodeURIComponent(payeeName)}&am=${amountPaid.toFixed(2)}&cu=INR`;
    let cancelled = false;
    QRCode.toDataURL(upiString, { width: 200, margin: 1, errorCorrectionLevel: 'L' })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(null); });
    return () => { cancelled = true; };
  }, [paymentMode, isOnlinePayment, payoutAccount?.upiId, payoutAccount?.accountHolderName, event?.title, amountPaid]);

  const MAX_SCREENSHOT_BYTES = 1 * 1024 * 1024; // 1 MB hard cap
  const handleScreenshotFile = async (file: File) => {
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setScreenshotError('File must be under 1 MB.');
      return;
    }
    setScreenshotError(null);
    setIsCompressingScreenshot(true);
    try {
      const compressed = await compressImageToTargetSize(file, 700, {
        maxWidth: 1280,
        maxHeight: 1280,
        mimeType: 'image/jpeg',
      });
      const approxBytes = compressed.length * 0.75;
      if (approxBytes > MAX_SCREENSHOT_BYTES) {
        setScreenshotError('Image is still too large after compression. Try a smaller photo.');
        return;
      }
      setScreenshot(compressed);
      setScreenshotIsNew(true);
    } catch {
      setScreenshotError('Could not process that image, please try another.');
    } finally {
      setIsCompressingScreenshot(false);
    }
  };

  if (!attendee) return null;

  const isValidEmail = email.trim().length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isValidPhone = /^[6-9]\d{9}$/.test(phone.trim());
  const selectedTier = event?.tiers.find((t) => t.id === tierId) ?? null;

  const showEmailError = email.trim().length > 0 && !isValidEmail;
  const showPhoneError = phone.trim().length > 0 && !isValidPhone;

  const formValid = name.trim().length > 0 && isValidEmail && isValidPhone && !!tierId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid || !selectedTier || isSaving) return;

    setIsSaving(true);
    try {
      // Only touch screenshotUrl when the staff actually changed it this
      // session — a fresh file needs uploading; `null` means it was removed;
      // untouched means leave whatever's already stored alone.
      let screenshotUrl: string | null = null;
      if (screenshotIsNew && screenshot && companyId && event) {
        const shotRef = ref(storage, `companies/${companyId}/events/${event.id}/manual-payments/${Date.now()}-edit.jpg`);
        await uploadString(shotRef, screenshot, 'data_url');
        screenshotUrl = await getDownloadURL(shotRef);
      }

      onSave(attendee.id, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        tierName: selectedTier.name,
        tierId: selectedTier.id,
        amountPaid,
        paymentMode,
        ...(screenshotIsNew ? { screenshotUrl } : {}), // null = explicitly removed
      });
    } finally {
      setIsSaving(false);
    }
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
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`mt-1 w-full rounded-sm border bg-[#F9FAFB] dark:bg-slate-800 px-3 py-2 text-sm ${showEmailError ? 'border-red-400 focus:border-red-500' : 'border-slate-200 dark:border-slate-700'
                }`}
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

          {paymentMode === 'UPI' && isOnlinePayment && (
            // This ticket already came through a real online payment — the
            // gateway, or the online manual-QR checkout — so there's nothing
            // left to collect. Show what happened instead of a "scan to pay"
            // QR, which would be nonsensical for a payment that's done.
            <div className="rounded-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
              <p>
                Paid via UPI in {(attendee as any).paymentMethod === 'gateway' ? 'payment gateway' : 'online UPI QR'}
                {' '}— ₹{amountPaid.toFixed(2)}
              </p>
              {screenshot && (
                <img src={screenshot} alt="Payment screenshot" className="mt-2 h-16 w-16 rounded-sm border border-slate-200 dark:border-slate-700 object-cover" />
              )}
            </div>
          )}

          {paymentMode === 'UPI' && !isOnlinePayment && (
            payoutAccount?.upiId ? (
              <>
                {/* A "scan to pay" QR only makes sense while payment is still
                    outstanding. An attendee who already has a screenshot on
                    file has already paid — showing a fresh QR to "pay me" on
                    top of their existing proof read as broken/confusing when
                    just editing their other details. */}
                {!screenshot && (
                  <div className="flex flex-col items-center gap-2 rounded-sm border border-dashed border-slate-300 dark:border-slate-700 p-3">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="UPI payment QR code" className="h-36 w-36 object-contain" />
                    ) : (
                      <div className="flex h-36 w-36 items-center justify-center text-xs text-slate-400">Generating QR…</div>
                    )}
                    {payoutAccount.accountHolderName && (
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{payoutAccount.accountHolderName}</p>
                    )}
                    <p className="text-xs text-slate-500 dark:text-slate-400">{payoutAccount.upiId}</p>
                    <p className="text-sm font-bold text-[#007A78] dark:text-[#2DD4BF]">₹{amountPaid.toFixed(2)}</p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Payment screenshot (optional)</label>
                  {screenshot ? (
                    <div className="mt-1 flex items-center gap-2">
                      <img src={screenshot} alt="Payment screenshot preview" className="h-12 w-12 shrink-0 rounded-sm border border-slate-200 dark:border-slate-700 object-cover" />
                      <button
                        type="button"
                        onClick={() => { setScreenshot(null); setScreenshotIsNew(true); }}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 px-3 py-3 text-xs text-slate-500 dark:text-slate-400 hover:border-[#007A78] dark:hover:border-[#2DD4BF]">
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isCompressingScreenshot}
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleScreenshotFile(e.target.files[0])}
                      />
                      <Upload size={14} />
                      {isCompressingScreenshot ? 'Compressing…' : 'Upload a screenshot of the payment'}
                    </label>
                  )}
                  {screenshotError && <p className="mt-1 text-xs text-red-600">{screenshotError}</p>}
                </div>
              </>
            ) : (
              <p className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                No UPI id on file — add one under Event Settings → Payout bank account to show a scannable code here.
              </p>
            )
          )}

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
              disabled={!formValid || isSaving}
              className="flex-1 rounded-sm bg-[#007A78] hover:bg-[#006361] dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5] py-2.5 text-xs font-bold text-white dark:text-slate-950 disabled:opacity-40"
            >
              {isSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditAttendeeModal;