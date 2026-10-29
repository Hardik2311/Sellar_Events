import React, { useState, useMemo, useEffect, useId, useRef } from 'react';
import { X, Loader2, AlertTriangle, Minus, Plus, Upload, RotateCcw, ArrowLeft } from 'lucide-react';
import QRCode from 'qrcode';
import { doc, getDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import type { EventSummary } from '../types/event.types';
import { createWalkInAttendees } from '../lib/ticketing';
import { usePayoutAccount } from '../hooks/usePlatformPayments';
import { compressImageToTargetSize } from '../lib/imageCompression';

interface TaxSettings {
  enableTax?: boolean;
  gstScheme?: 'regular' | 'composition' | 'none';
  taxType?: 'inclusive' | 'exclusive';
  defaultTaxRate?: number;
  enableRounding?: boolean;
  roundingInterval?: number;
}

const roundToInterval = (value: number, interval: number) => {
  if (!interval) return Math.round(value);
  return Math.round(value / interval) * interval;
};

// Event titles can be saved with rich-text markup (e.g. <span style="color:...">).
// Strip tags so they show as plain text in this modal.
const stripHtml = (html: string | undefined | null): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};

interface WalkInAttendeeFormEntry {
  name: string;
  email: string;
  phone: string;
}

interface AddWalkInAttendeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventSummary | null;
  companyId: string | undefined;
  onSuccess: (
    data: {
      name: string;
      ticketId: string;
      tierName: string;
      email: string;
      phone: string;
      amountPaid: number;
      paymentMode: string;
    }[]
  ) => void;
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

const EMPTY_ATTENDEE: WalkInAttendeeFormEntry = { name: '', email: '', phone: '' };

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const formatPrice = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

// Shared form styling, kept in one place so every field looks and focuses the same.
const LABEL_CLASS = 'mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300';
const INPUT_BASE =
  'w-full rounded-sm border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition-[border-color,box-shadow] focus-visible:ring-2 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400';
const INPUT_OK =
  'border-slate-300 focus-visible:border-[#007A78] focus-visible:ring-[#007A78]/25 dark:border-slate-600 dark:focus-visible:border-[#2DD4BF] dark:focus-visible:ring-[#2DD4BF]/25';
const INPUT_ERROR = 'border-red-500 focus-visible:border-red-600 focus-visible:ring-red-500/25 dark:border-red-400';
const ERROR_TEXT = 'mt-1 text-xs text-red-600 dark:text-red-400';
const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-[#007A78]/40 dark:focus-visible:ring-[#2DD4BF]/40';
const BTN_SECONDARY = `flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-slate-300 bg-white py-2 text-sm font-semibold text-slate-700 transition-[background-color,transform] hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ${FOCUS_RING}`;
const BTN_PRIMARY = `flex flex-[1.4] items-center justify-center gap-1.5 whitespace-nowrap rounded-sm bg-[#007A78] py-2 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-[#006361] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${FOCUS_RING}`;

// Module-level (not inside the modal) so inputs don't remount and lose focus on every keystroke.
const Section: React.FC<{ title: string; aside?: React.ReactNode; children: React.ReactNode }> = ({ title, aside, children }) => (
  <section className="flex flex-col gap-2.5 px-4 py-3.5">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {aside}
    </div>
    {children}
  </section>
);

// Native checkbox kept for keyboard + screen readers; the track is purely visual.
const SwitchVisual: React.FC<{ checked: boolean }> = ({ checked }) => (
  <span
    aria-hidden="true"
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-[#007A78] dark:bg-[#2DD4BF]' : 'bg-slate-300 dark:bg-slate-600'}`}
  >
    <span
      className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
    />
  </span>
);

const AddWalkInAttendeeModal: React.FC<AddWalkInAttendeeModalProps> = ({
  isOpen,
  onClose,
  event,
  companyId,
  onSuccess,
}) => {
  // Tickets per tier ({ [tierId]: count }) so one walk-in group can mix tiers.
  const [tierQtyState, setTierQty] = useState<Record<string, number>>({});
  const [sameForAll, setSameForAll] = useState(true);
  const [attendees, setAttendees] = useState<WalkInAttendeeFormEntry[]>([{ ...EMPTY_ATTENDEE }]);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<typeof PAYMENT_MODES[number]>('Cash');
  const [markCheckedIn, setMarkCheckedIn] = useState(true);
  const [overbookTierIds, setOverbookTierIds] = useState<string[]>([]);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taxSettings, setTaxSettings] = useState<TaxSettings | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [amountEdited, setAmountEdited] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [isCompressingScreenshot, setIsCompressingScreenshot] = useState(false);
  // 'form' = fill attendee/tier/amount details; 'payment' = UPI-only step
  // to scan-and-pay and attach proof before the attendee is actually added.
  const [step, setStep] = useState<'form' | 'payment'>('form');

  // Organizer's UPI id for receiving payouts — same one shown in Event
  // Settings → Payout bank account — reused here so the walk-in QR always
  // matches whatever UPI id the organizer actually has on file, instead of
  // depending on this one event having its own manual-QR UPI id set.
  const { account: payoutAccount } = usePayoutAccount(companyId);

  // Single-tier events start with 1 ticket picked, so a lone walk-in is just
  // name + phone + Add. Once the organizer touches a stepper, their choice wins.
  const tierQty = useMemo<Record<string, number>>(() => {
    if (Object.keys(tierQtyState).length === 0 && event?.tiers.length === 1) {
      return { [event.tiers[0].id]: 1 };
    }
    return tierQtyState;
  }, [tierQtyState, event]);

  // One entry per ticket, in tier order. Attendee row i belongs to ticketTiers[i].
  const ticketTiers = useMemo(
    () => (event?.tiers ?? []).flatMap((t) => Array.from({ length: tierQty[t.id] ?? 0 }, () => t)),
    [event, tierQty]
  );
  const quantity = ticketTiers.length;
  const selectedTiers = (event?.tiers ?? []).filter((t) => (tierQty[t.id] ?? 0) > 0);
  const ticketSummary = selectedTiers.map((t) => `${tierQty[t.id]} × ${t.name}`).join(', ');
  const subtotal = ticketTiers.reduce((sum, t) => sum + t.price, 0);

  const isFutureEvent = isEventDateInFuture(event);

  // Same GST calc as the online checkout (ManualQRpaymentCard) — so a
  // walk-in pays the same tax-inclusive amount an online buyer would.
  useEffect(() => {
    if (!isOpen || !companyId) return;
    getDoc(doc(db, 'companies', companyId, 'settings', 'general'))
      .then((snap) => setTaxSettings(snap.exists() ? (snap.data() as TaxSettings) : {}))
      .catch(() => setTaxSettings({}));
  }, [isOpen, companyId]);

  const totalWithTax = useMemo(() => {
    if (quantity === 0) return 0;
    const scheme = (taxSettings?.gstScheme || 'none').toLowerCase();
    const taxType = (taxSettings?.taxType || 'inclusive').toLowerCase();
    const taxRate = taxSettings?.defaultTaxRate || 0;
    // 'inclusive' tax is already baked into the tier price — only
    // 'exclusive' needs tax added on top to match the online total.
    const total = scheme === 'regular' && taxType === 'exclusive' ? subtotal * (1 + taxRate / 100) : subtotal;
    return taxSettings?.enableRounding ? roundToInterval(total, taxSettings.roundingInterval || 1) : total;
  }, [subtotal, quantity, taxSettings]);

  // Auto-fill the total whenever the tickets change — same
  // "smart default, still editable" behavior the tier picker already had.
  useEffect(() => {
    if (!amountEdited) setAmountPaid(totalWithTax);
  }, [totalWithTax, amountEdited]);

  // UPI QR for the walk-in to scan — same upi:// deep link format as the
  // online manual-QR checkout, but pointed at the organizer's payout UPI id.
  useEffect(() => {
    if (paymentMode !== 'UPI' || !payoutAccount?.upiId || amountPaid <= 0) {
      setQrDataUrl(null);
      return;
    }
    const payeeName = payoutAccount.accountHolderName || stripHtml(event?.title) || 'Payment';
    const upiString = `upi://pay?pa=${payoutAccount.upiId}&pn=${encodeURIComponent(payeeName)}&am=${amountPaid.toFixed(2)}&cu=INR`;
    let cancelled = false;
    QRCode.toDataURL(upiString, { width: 200, margin: 1, errorCorrectionLevel: 'L' })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(null); });
    return () => { cancelled = true; };
  }, [paymentMode, payoutAccount?.upiId, payoutAccount?.accountHolderName, event?.title, amountPaid]);

  // Force the checkbox off whenever the modal opens for an event whose date
  // hasn't arrived yet — prevents a stale "true" from a previous open.
  useEffect(() => {
    if (isOpen && isFutureEvent) {
      setMarkCheckedIn(false);
    }
  }, [isOpen, isFutureEvent]);

  // Keep the attendee-detail rows in sync with the ticket count, same
  // pattern as the "same for all" bulk-purchase flows (Checkout.tsx /
  // ManualQRpaymentCard.tsx) — add/remove rows without clobbering what's
  // already been typed into the ones that still exist. Always keep one row so
  // details can be typed before tickets are picked.
  const rowCount = Math.max(1, quantity);
  useEffect(() => {
    setAttendees((prev) => {
      if (prev.length === rowCount) return prev;
      return Array.from({ length: rowCount }, (_, i) => prev[i] ?? { ...EMPTY_ATTENDEE });
    });
  }, [rowCount]);

  const uid = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // Focus moves into the dialog on open so keyboard users (and Escape) start inside it.
  useEffect(() => {
    if (isOpen) dialogRef.current?.focus();
  }, [isOpen]);

  // Each step starts at the top instead of wherever the previous one was scrolled.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  if (!isOpen || !event) return null;

  const reset = () => {
    setTierQty({}); setSameForAll(true); setAttendees([{ ...EMPTY_ATTENDEE }]);
    setAmountPaid(0); setPaymentMode('Cash'); setMarkCheckedIn(true);
    setOverbookTierIds([]); setCustomAnswers({}); setError(null);
    setAmountEdited(false); setQrDataUrl(null);
    setScreenshot(null); setScreenshotError(null);
    setStep('form');
  };

  const handleClose = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  const MAX_SCREENSHOT_BYTES = 1 * 1024 * 1024; // 1 MB hard cap
  const handleScreenshotFile = async (file: File) => {
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setScreenshotError('File must be under 1 MB.');
      setScreenshot(null);
      return;
    }
    setScreenshotError(null);
    setIsCompressingScreenshot(true);
    try {
      // Same target as the online manual-QR checkout — 700KB keeps the
      // base64 output (~33% larger than raw bytes) under the 1MB cap.
      const compressed = await compressImageToTargetSize(file, 700, {
        maxWidth: 1280,
        maxHeight: 1280,
        mimeType: 'image/jpeg',
      });
      const approxBytes = compressed.length * 0.75;
      if (approxBytes > MAX_SCREENSHOT_BYTES) {
        setScreenshotError('Image is still too large after compression. Try a smaller photo.');
        setScreenshot(null);
        return;
      }
      setScreenshot(compressed);
    } catch {
      setScreenshotError('Could not process that image, please try another.');
    } finally {
      setIsCompressingScreenshot(false);
    }
  };

  const isValidPhone = (phone: string) => /^[6-9]\d{9}$/.test(phone.trim());
  const isValidEmail = (email: string) => email.trim().length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  // Drop questions the organizer never actually labeled — otherwise an
  // empty custom field still renders as a blank, pointless input.
  const customFields = (event.customFields ?? []).filter((f) => f.label?.trim());

  const customFieldsComplete = customFields.every((f) => {
    if (!f.required) return true;
    const val = customAnswers[f.id] ?? '';
    return f.type === 'checkbox' ? val === 'true' : val.trim().length > 0;
  });

  // When "same for all" is on, only the first row's details actually matter
  // — the rest mirror it at submit time — so only that row needs validating.
  const rowsToValidate = sameForAll ? attendees.slice(0, 1) : attendees;
  const attendeeDetailsComplete =
    rowsToValidate.length > 0 &&
    rowsToValidate.every((a) => a.name.trim().length > 0 && isValidPhone(a.phone) && isValidEmail(a.email));

  const formComplete = quantity > 0 && attendeeDetailsComplete && customFieldsComplete;

  const MAX_TICKETS = 50;
  const changeTierQty = (tierId: string, delta: number) => {
    const next = Math.max(0, (tierQty[tierId] ?? 0) + delta);
    if (delta > 0 && quantity >= MAX_TICKETS) return;
    setTierQty({ ...tierQty, [tierId]: next });
    setAmountEdited(false); // back to the auto-calculated total for the new mix
  };

  // Splits the group total across tickets by tier price, so a VIP ticket
  // records more revenue than a General one and an edited total (a discount)
  // is spread proportionally. Rounding leftovers land on the last ticket so
  // the shares always add back up to exactly what was collected.
  const perTicketAmounts = (): number[] => {
    if (quantity === 0) return [];
    const shares = ticketTiers.map((t) =>
      Number((subtotal > 0 ? (amountPaid * t.price) / subtotal : amountPaid / quantity).toFixed(2))
    );
    const drift = Number((amountPaid - shares.reduce((s, v) => s + v, 0)).toFixed(2));
    shares[shares.length - 1] = Number((shares[shares.length - 1] + drift).toFixed(2));
    return shares;
  };

  // Nothing to upload proof against if the organizer has no UPI id on file —
  // otherwise require a screenshot before the payment step can be confirmed.
  const paymentConfirmReady = !payoutAccount?.upiId || !!screenshot;

  const updateAttendee = (index: number, field: keyof WalkInAttendeeFormEntry, value: string) => {
    setAttendees((prev) =>
      prev.map((a, i) => (i === index || (sameForAll && index === 0) ? { ...a, [field]: value } : a))
    );
  };

  const handleToggleSameForAll = (checked: boolean) => {
    setSameForAll(checked);
    if (checked) {
      setAttendees((prev) => (prev.length > 0 ? prev.map(() => ({ ...prev[0] })) : prev));
    }
  };

  // UPI stops here to collect payment first; every other mode adds straight away.
  const handlePrimaryAction = () => {
    if (!formComplete) return;
    if (paymentMode === 'UPI') {
      setStep('payment');
      return;
    }
    handleSubmit();
  };

  const handleSubmit = async () => {
    if (!formComplete || !companyId) return;
    if (paymentMode === 'UPI' && !paymentConfirmReady) return;
    setIsSubmitting(true);
    setError(null);
    try {
      // "same for all" mirrors row 0 to every slot, same semantics as the
      // bulk-purchase flows — all N tickets end up attributed to the same
      // name/contact and naturally group under one bookingGroupId.
      const finalAttendees = sameForAll
        ? Array.from({ length: quantity }, () => attendees[0])
        : attendees.slice(0, quantity);

      // `amountPaid` in the form is the group TOTAL (incl. tax); each
      // attendee doc stores its own share, since reports sum amountPaid
      // per-attendee to get revenue.
      const shares = perTicketAmounts();
      const tickets = finalAttendees.map((a, i) => ({
        name: a.name.trim(),
        email: a.email.trim(),
        phone: a.phone.trim(),
        tierId: ticketTiers[i].id,
        tierName: ticketTiers[i].name,
        amountPaid: shares[i],
      }));

      // One screenshot covers the whole group, same as the online
      // manual-QR checkout.
      let screenshotUrl: string | null = null;
      if (screenshot) {
        const shotRef = ref(storage, `companies/${companyId}/events/${event.id}/manual-payments/${Date.now()}-walkin.jpg`);
        await uploadString(shotRef, screenshot, 'data_url');
        screenshotUrl = await getDownloadURL(shotRef);
      }

      const ticketIds = await createWalkInAttendees({
        companyId,
        eventId: event.id,
        eventTitle: event.title,
        // Fallbacks only; every ticket below carries its own tier + amount.
        tierId: tickets[0].tierId,
        tierName: tickets[0].tierName,
        attendees: tickets,
        amountPaid: tickets[0].amountPaid,
        paymentMode,
        markCheckedIn: markCheckedIn && !isFutureEvent,
        allowOverbook: false,
        allowOverbookTierIds: overbookTierIds,
        customFieldAnswers: customAnswers,
        screenshotUrl,
      });
      onSuccess(
        tickets.map((t, i) => ({
          name: t.name,
          ticketId: ticketIds[i],
          tierName: t.tierName,
          email: t.email,
          phone: t.phone,
          amountPaid: t.amountPaid,
          paymentMode,
        }))
      );
      reset();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not add attendee(s), please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isUpi = paymentMode === 'UPI';
  const primaryLabel = isUpi
    ? 'Continue to payment'
    : quantity > 1
      ? `Add ${quantity} attendees`
      : 'Add attendee';
  const checkedInNow = markCheckedIn && !isFutureEvent;

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the same file be picked again after "Remove"
    if (file) handleScreenshotFile(file);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') handleClose();
        }}
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-sm bg-white shadow-[0_24px_64px_-16px_rgba(15,23,42,0.35)] outline-none sm:max-w-lg sm:rounded-sm dark:bg-slate-900"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-2.5">
            <div className="min-w-0">
              <h2 id={`${uid}-title`} className="text-base font-semibold text-balance text-slate-900 dark:text-white">
                {step === 'payment' ? 'Collect payment' : 'Add walk-in attendee'}
              </h2>
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                {isUpi ? `Step ${step === 'payment' ? 2 : 1} of 2 · ` : ''}
                {stripHtml(event.title)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              aria-label="Close"
              className={`-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${FOCUS_RING}`}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {isUpi && (
            <div className="grid grid-cols-2 gap-1 px-4 pb-2.5" aria-hidden="true">
              <span className="h-1 rounded-full bg-[#007A78] dark:bg-[#2DD4BF]" />
              <span
                className={`h-1 rounded-full transition-colors ${step === 'payment' ? 'bg-[#007A78] dark:bg-[#2DD4BF]' : 'bg-slate-200 dark:bg-slate-700'}`}
              />
            </div>
          )}
        </div>

        {/* Body */}
        <div
          ref={bodyRef}
          className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto overscroll-contain dark:divide-slate-800"
        >
          {error && (
            <div className="px-4 pt-3.5" role="alert">
              <div className="flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {step === 'payment' ? (
            <>
              <section className="flex flex-col gap-3 px-4 py-3.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">
                    {ticketSummary}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {formatINR(amountPaid)}
                  </span>
                </div>

                {payoutAccount?.upiId ? (
                  <div className="flex flex-col items-center gap-2.5 rounded-sm border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/50">
                    {/* QR stays on white in both themes so phone cameras read it reliably */}
                    <div className="rounded-sm bg-white p-2 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt={`UPI QR code to pay ${formatINR(amountPaid)}`}
                          width={176}
                          height={176}
                          className="h-44 w-44 object-contain"
                        />
                      ) : (
                        <div className="flex h-44 w-44 items-center justify-center text-xs text-slate-500">
                          <Loader2 size={16} className="mr-1.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                          Generating QR…
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-semibold tabular-nums text-[#007A78] dark:text-[#2DD4BF]">
                        {formatINR(amountPaid)}
                      </p>
                      {payoutAccount.accountHolderName && (
                        <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                          {payoutAccount.accountHolderName}
                        </p>
                      )}
                      <p translate="no" className="mt-0.5 break-all text-xs text-slate-500 dark:text-slate-400">
                        {payoutAccount.upiId}
                      </p>
                    </div>
                    <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                      Ask the attendee to scan this with any UPI app.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>
                      No UPI ID on file. Add one under Event Settings, Payout bank account, to show a scannable code here.
                      You can also go back and pick a different payment mode.
                    </span>
                  </div>
                )}
              </section>

              {payoutAccount?.upiId && (
                <Section title="Payment proof">
                  {screenshot ? (
                    <div className="flex items-center gap-3 rounded-sm border border-slate-200 p-2.5 dark:border-slate-700">
                      <img
                        src={screenshot}
                        alt="Payment screenshot preview"
                        width={56}
                        height={56}
                        className="h-14 w-14 shrink-0 rounded-sm border border-slate-200 object-cover dark:border-slate-700"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Screenshot attached</p>
                        <div className="mt-1 flex gap-3 text-xs font-semibold">
                          <label className="cursor-pointer rounded-sm text-[#007A78] hover:underline focus-within:ring-2 focus-within:ring-[#007A78]/40 dark:text-[#2DD4BF]">
                            <input type="file" accept="image/*" className="sr-only" onChange={handleFileInput} />
                            Replace
                          </label>
                          <button
                            type="button"
                            onClick={() => setScreenshot(null)}
                            className={`rounded-sm text-red-600 hover:underline dark:text-red-400 ${FOCUS_RING}`}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <label
                      className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-sm border border-dashed px-4 py-4 text-center transition-colors focus-within:ring-2 focus-within:ring-[#007A78]/40 ${screenshotError
                        ? 'border-red-400 bg-red-50/50 dark:border-red-500/60 dark:bg-red-950/20'
                        : 'border-slate-300 bg-slate-50 hover:border-[#007A78] hover:bg-[#007A78]/5 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-[#2DD4BF]'
                        }`}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isCompressingScreenshot}
                        className="sr-only"
                        aria-describedby={`${uid}-shot-help`}
                        onChange={handleFileInput}
                      />
                      {isCompressingScreenshot ? (
                        <Loader2 size={18} className="animate-spin text-slate-500 motion-reduce:animate-none" aria-hidden="true" />
                      ) : (
                        <Upload size={18} className="text-slate-500 dark:text-slate-400" aria-hidden="true" />
                      )}
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {isCompressingScreenshot ? 'Compressing…' : 'Upload payment screenshot'}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Image up to 1&nbsp;MB</span>
                    </label>
                  )}
                  <p aria-live="polite" className={screenshotError ? ERROR_TEXT.replace('mt-1.5 ', '') : 'sr-only'}>
                    {screenshotError}
                  </p>
                  <p id={`${uid}-shot-help`} className="text-xs text-slate-500 dark:text-slate-400">
                    Required. It confirms the payment was received before the attendee is added.
                  </p>
                </Section>
              )}
            </>
          ) : (
            <>
              <Section
                title="Tickets"
                aside={
                  quantity > 0 ? (
                    <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {quantity} selected
                    </span>
                  ) : undefined
                }
              >
                {event.tiers.length === 0 ? (
                  <p className="rounded-sm bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
                    This event has no ticket tiers yet. Add one in Event Settings first.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {event.tiers.map((t) => {
                      const left = t.total - t.sold;
                      const qty = tierQty[t.id] ?? 0;
                      const active = qty > 0;
                      const overCapacity = qty > Math.max(left, 0);
                      const overbookOk = overbookTierIds.includes(t.id);
                      return (
                        <li
                          key={t.id}
                          className={`rounded-sm border transition-colors ${active
                            ? 'border-[#007A78] bg-[#007A78]/5 dark:border-[#2DD4BF] dark:bg-[#2DD4BF]/10'
                            : 'border-slate-200 dark:border-slate-700'
                            }`}
                        >
                          <div className="flex items-center justify-between gap-3 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{t.name}</p>
                              <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{formatPrice(t.price)}</span>
                                <span className={left <= 0 ? 'text-amber-700 dark:text-amber-400' : undefined}>
                                  {left <= 0 ? ' · Sold out' : ` · ${left} left`}
                                </span>
                              </p>
                            </div>
                            <div
                              role="group"
                              aria-label={`${t.name} tickets`}
                              className="inline-flex shrink-0 items-stretch overflow-hidden rounded-sm border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
                            >
                              <button
                                type="button"
                                onClick={() => changeTierQty(t.id, -1)}
                                disabled={qty === 0}
                                aria-label={`Remove one ${t.name} ticket`}
                                className={`flex h-8 w-8 items-center justify-center text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-35 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 ${FOCUS_RING} focus-visible:ring-inset`}
                              >
                                <Minus size={14} aria-hidden="true" />
                              </button>
                              <output
                                aria-live="polite"
                                className={`flex w-8 items-center justify-center border-x border-slate-300 text-sm font-semibold tabular-nums dark:border-slate-600 ${active ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}
                              >
                                {qty}
                              </output>
                              <button
                                type="button"
                                onClick={() => changeTierQty(t.id, 1)}
                                disabled={quantity >= MAX_TICKETS}
                                aria-label={`Add one ${t.name} ticket`}
                                className={`flex h-8 w-8 items-center justify-center text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-35 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 ${FOCUS_RING} focus-visible:ring-inset`}
                              >
                                <Plus size={14} aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                          {overCapacity && (
                            <label className="flex cursor-pointer items-start gap-2 border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                              <input
                                type="checkbox"
                                checked={overbookOk}
                                onChange={(e) =>
                                  setOverbookTierIds((prev) =>
                                    e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)
                                  )
                                }
                                className="mt-px h-3.5 w-3.5 shrink-0 rounded border-gray-300 bg-white accent-[#007A78] [color-scheme:light]"
                              />
                              <span>
                                Only {Math.max(left, 0)} left for {qty} ticket{qty === 1 ? '' : 's'}. Add anyway.
                              </span>
                            </label>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Section>

              <Section title="Attendee details">
                {quantity > 1 && (
                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-sm bg-slate-50 px-3 py-2 focus-within:ring-2 focus-within:ring-[#007A78]/40 dark:bg-slate-800/50">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                        Same details for all {quantity}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        All tickets go under one name and contact.
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={sameForAll}
                      onChange={(e) => handleToggleSameForAll(e.target.checked)}
                      className="sr-only"
                    />
                    <SwitchVisual checked={sameForAll} />
                  </label>
                )}

                {attendees.map((a, index) => {
                  if (sameForAll && index > 0) return null;
                  const idBase = `${uid}-a${index}`;
                  const emailInvalid = a.email.trim().length > 0 && !isValidEmail(a.email);
                  const phoneInvalid = a.phone.trim().length > 0 && !isValidPhone(a.phone);
                  const grouped = quantity > 1 && !sameForAll;
                  return (
                    <fieldset
                      key={index}
                      className={grouped ? 'flex flex-col gap-2.5 rounded-sm border border-slate-200 p-3 dark:border-slate-700' : 'flex flex-col gap-2.5'}
                    >
                      <legend className={grouped ? 'px-1 text-xs font-semibold text-slate-500 dark:text-slate-400' : 'sr-only'}>
                        Ticket {index + 1}{ticketTiers[index] ? ` · ${ticketTiers[index].name}` : ''}
                      </legend>
                      <div>
                        <label htmlFor={`${idBase}-name`} className={LABEL_CLASS}>Full name</label>
                        <input
                          id={`${idBase}-name`}
                          name={`attendee-${index}-name`}
                          autoComplete="off"
                          value={a.name}
                          onChange={(e) => updateAttendee(index, 'name', e.target.value)}
                          className={`${INPUT_BASE} ${INPUT_OK}`}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        <div>
                          <label htmlFor={`${idBase}-phone`} className={LABEL_CLASS}>Mobile number</label>
                          <div className="relative">
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500 dark:text-slate-400"
                            >
                              +91
                            </span>
                            <input
                              id={`${idBase}-phone`}
                              name={`attendee-${index}-phone`}
                              type="tel"
                              inputMode="numeric"
                              autoComplete="off"
                              placeholder="98765 43210"
                              value={a.phone}
                              onChange={(e) => updateAttendee(index, 'phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                              maxLength={10}
                              aria-invalid={phoneInvalid}
                              aria-describedby={phoneInvalid ? `${idBase}-phone-err` : undefined}
                              className={`${INPUT_BASE} pl-11 tabular-nums ${phoneInvalid ? INPUT_ERROR : INPUT_OK}`}
                            />
                          </div>
                          {phoneInvalid && (
                            <p id={`${idBase}-phone-err`} className={ERROR_TEXT}>
                              Enter a 10-digit number starting with 6, 7, 8 or 9.
                            </p>
                          )}
                        </div>

                        <div>
                          <label htmlFor={`${idBase}-email`} className={LABEL_CLASS}>
                            Email <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
                          </label>
                          <input
                            id={`${idBase}-email`}
                            name={`attendee-${index}-email`}
                            type="email"
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="name@example.com"
                            value={a.email}
                            onChange={(e) => updateAttendee(index, 'email', e.target.value)}
                            aria-invalid={emailInvalid}
                            aria-describedby={emailInvalid ? `${idBase}-email-err` : undefined}
                            className={`${INPUT_BASE} ${emailInvalid ? INPUT_ERROR : INPUT_OK}`}
                          />
                          {emailInvalid && (
                            <p id={`${idBase}-email-err`} className={ERROR_TEXT}>
                              Enter a valid email, like name@example.com.
                            </p>
                          )}
                        </div>
                      </div>
                    </fieldset>
                  );
                })}
              </Section>

              <Section title="Payment">
                <fieldset>
                  <legend className={LABEL_CLASS}>Payment mode</legend>
                  <div className="grid grid-cols-4 gap-1 rounded-sm bg-slate-100 p-1 dark:bg-slate-800">
                    {PAYMENT_MODES.map((m) => {
                      const active = paymentMode === m;
                      return (
                        <label
                          key={m}
                          className={`cursor-pointer rounded-sm py-1.5 text-center text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-[#007A78]/40 ${active
                            ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                            }`}
                        >
                          <input
                            type="radio"
                            name={`${uid}-mode`}
                            value={m}
                            checked={active}
                            onChange={() => setPaymentMode(m)}
                            className="sr-only"
                          />
                          {m}
                        </label>
                      );
                    })}
                  </div>
                  {isUpi && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Next, you'll show a QR code to scan and attach the payment screenshot.
                    </p>
                  )}
                </fieldset>

                <div>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <label htmlFor={`${uid}-amount`} className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Amount received
                    </label>
                    {amountEdited && quantity > 0 && (
                      <button
                        type="button"
                        onClick={() => setAmountEdited(false)}
                        className={`inline-flex items-center gap-1 rounded-sm text-xs font-semibold text-[#007A78] hover:underline dark:text-[#2DD4BF] ${FOCUS_RING}`}
                      >
                        <RotateCcw size={12} aria-hidden="true" />
                        Use {formatINR(totalWithTax)}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      ₹
                    </span>
                    <input
                      id={`${uid}-amount`}
                      name="amount"
                      type="number"
                      inputMode="decimal"
                      autoComplete="off"
                      min={0}
                      value={amountPaid}
                      onChange={(e) => {
                        setAmountPaid(Number(e.target.value));
                        setAmountEdited(true);
                      }}
                      aria-describedby={quantity > 0 ? `${uid}-amount-help` : undefined}
                      className={`${INPUT_BASE} ${INPUT_OK} pl-7 tabular-nums`}
                    />
                  </div>
                  {quantity > 0 && (
                    <p id={`${uid}-amount-help`} className="mt-1 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      Total for {quantity} ticket{quantity === 1 ? '' : 's'}
                      {taxSettings?.gstScheme === 'regular' ? ', incl. GST' : ''}
                      {selectedTiers.length > 1 ? '. Split across tickets by price' : ''}
                      {amountEdited ? ' (edited)' : ''}
                    </p>
                  )}
                </div>
              </Section>

              {customFields.length > 0 && (
                <Section title="Additional details">
                  {customFields.map((field) => {
                    const value = customAnswers[field.id] ?? '';
                    const fieldId = `${uid}-cf-${field.id}`;
                    const requiredMark = field.required ? (
                      <span className="text-red-600 dark:text-red-400" aria-hidden="true"> *</span>
                    ) : null;
                    if (field.type === 'checkbox') {
                      return (
                        <label key={field.id} className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-800 dark:text-slate-200">
                          <input
                            type="checkbox"
                            required={field.required}
                            checked={value === 'true'}
                            onChange={(e) => setCustomAnswers((p) => ({ ...p, [field.id]: e.target.checked ? 'true' : 'false' }))}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 bg-white accent-[#007A78] [color-scheme:light]"
                          />
                          <span>{field.label}{requiredMark}</span>
                        </label>
                      );
                    }
                    return (
                      <div key={field.id}>
                        <label htmlFor={fieldId} className={LABEL_CLASS}>
                          {field.label}{requiredMark}
                        </label>
                        {field.type === 'select' ? (
                          <select
                            id={fieldId}
                            name={field.id}
                            required={field.required}
                            value={value}
                            onChange={(e) => setCustomAnswers((p) => ({ ...p, [field.id]: e.target.value }))}
                            className={`${INPUT_BASE} ${INPUT_OK}`}
                          >
                            <option value="">Select…</option>
                            {(field.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input
                            id={fieldId}
                            name={field.id}
                            type="text"
                            autoComplete="off"
                            required={field.required}
                            value={value}
                            onChange={(e) => setCustomAnswers((p) => ({ ...p, [field.id]: e.target.value }))}
                            className={`${INPUT_BASE} ${INPUT_OK}`}
                          />
                        )}
                      </div>
                    );
                  })}
                </Section>
              )}

              <section className="px-4 py-3.5">
                <label
                  className={`flex items-center justify-between gap-3 rounded-sm focus-within:ring-2 focus-within:ring-[#007A78]/40 ${isFutureEvent ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold ${isFutureEvent ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                      Check in now
                    </span>
                    <span className={`block text-xs ${isFutureEvent ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                      {isFutureEvent
                        ? 'Check-in opens on the event date. They will be added as not arrived.'
                        : 'Mark them as arrived as soon as they are added.'}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={checkedInNow}
                    disabled={isFutureEvent}
                    onChange={(e) => setMarkCheckedIn(e.target.checked)}
                    className="sr-only"
                  />
                  <span className={isFutureEvent ? 'opacity-50' : undefined}>
                    <SwitchVisual checked={checkedInNow} />
                  </span>
                </label>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-900">
          {step === 'form' && quantity > 0 && (
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">
                {ticketSummary}
              </span>
              <span className="shrink-0 text-base font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatINR(amountPaid)}
              </span>
            </div>
          )}
          <div className="flex gap-2">
            {step === 'payment' ? (
              <>
                <button type="button" onClick={() => setStep('form')} disabled={isSubmitting} className={BTN_SECONDARY}>
                  <ArrowLeft size={14} aria-hidden="true" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!paymentConfirmReady || isSubmitting}
                  className={BTN_PRIMARY}
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                  {isSubmitting ? 'Adding…' : quantity > 1 ? `Confirm & add ${quantity}` : 'Confirm & add'}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={handleClose} disabled={isSubmitting} className={BTN_SECONDARY}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  disabled={!formComplete || isSubmitting}
                  className={BTN_PRIMARY}
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                  {isSubmitting ? 'Adding…' : primaryLabel}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddWalkInAttendeeModal;
