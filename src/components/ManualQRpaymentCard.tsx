import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Upload, Copy, Check, Loader2, AlertCircle } from 'lucide-react';
import { collection, doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { compressImageToTargetSize } from '../lib/imageCompression';
import { stripHtmlTags } from '../lib/utils';
import type { AccessCodeEntry, PublicEvent } from '../data/events';
import QRCode from 'qrcode';
import { loadImageAsCoverBanner } from '../lib/imageBanner';
import TicketConfirmation from './TicketConfirmation';
import { buildEventSlugId } from '../data/events';
import { getShareBaseUrl } from '../lib/shareLinks';

const PDF_BANNER_WIDTH = 760;
const PDF_BANNER_HEIGHT = 220;

interface PurchasedTicket {
  ticketId: string;
  tierName: string;
  attendeeName: string;
  accessCode?: string;
  attendeeEmail?: string;
  attendeePhone?: string;
  amountPaid?: number;
  paymentMode?: string;
  purchasedAt?: number;
}

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
  accessCode?: string;
  onClose: () => void;
  onSuccess: () => void;
}
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
const isValidPhone = (phone: string): boolean => /^[6-9]\d{9}$/.test(phone);
const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
// Same scheme as CheckoutPage's getEventInitials — kept identical so
// gateway and manual-QR tickets look consistent to the organizer.
const getEventInitials = (title: string): string => {
  const words = stripHtmlTags(title).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'EV';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
};

interface AttendeeFormEntry {
  name: string;
  email: string;
  phone: string;
}

const ManualQRPaymentCard: React.FC<Props> = ({ event, breakdown, quantities, accessCode, onClose, onSuccess }) => {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [consentChecked, setConsentChecked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [purchasedTickets, setPurchasedTickets] = useState<PurchasedTicket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false); // NEW
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null); // NEW

  const [taxSettings, setTaxSettings] = useState<TaxSettings | null>(null);
  const customFields = event.customFields ?? [];
  const errorRef = useRef<HTMLDivElement>(null);

  // Whenever an error appears (upload/validation/submit), pull it into view
  // instead of letting it silently sit below the fold and shift layout.
  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [error]);

  const updateCustomAnswer = (fieldId: string, value: string) => {
    setCustomAnswers((prev) => ({ ...prev, [fieldId]: value }));
  };

  const customFieldsValid = customFields.every((f) => {
    if (!f.required) return true;
    const val = customAnswers[f.id] ?? '';
    return f.type === 'checkbox' ? val === 'true' : val.trim().length > 0;
  });

  // One ticket = one attendee slot, flattened in tier order — same idea as
  // the gateway checkout's ticketSlots.
  const ticketSlots = useMemo(
    () => breakdown.flatMap((b) => Array.from({ length: b.qty }, () => ({ tierId: b.id, tierName: b.name }))),
    [breakdown]
  );

  const [sameForAll, setSameForAll] = useState(true); // default matches the previous "one buyer" behaviour
  const [attendeeDetails, setAttendeeDetails] = useState<AttendeeFormEntry[]>([]);
  useEffect(() => {
    setAttendeeDetails((prev) => {
      if (prev.length === ticketSlots.length) return prev;
      return Array.from({ length: ticketSlots.length }, (_, i) => prev[i] ?? { name: '', email: '', phone: '' });
    });
  }, [ticketSlots.length]);

  // When "same for all" is on, editing ticket 1 mirrors the change to every other slot.
  const updateAttendee = (index: number, field: keyof AttendeeFormEntry, value: string) => {
    setAttendeeDetails((prev) =>
      prev.map((a, i) => (i === index || (sameForAll && index === 0) ? { ...a, [field]: value } : a))
    );
  };

  const handleToggleSameForAll = (checked: boolean) => {
    setSameForAll(checked);
    if (checked) {
      setAttendeeDetails((prev) => (prev.length > 0 ? prev.map(() => ({ ...prev[0] })) : prev));
    }
  };

  const attendeeDetailsComplete =
    attendeeDetails.length === ticketSlots.length &&
    attendeeDetails.length > 0 &&
    attendeeDetails.every(
      (a) => a.name.trim().length > 0 && isValidPhone(a.phone) && (a.email.trim() === '' || isValidEmail(a.email))
    );
  useEffect(() => {
    if (!event.companyId) return;
    const fetchTaxSettings = async () => {
      try {
        const ref = doc(db, 'companies', event.companyId, 'settings', 'general');
        const snap = await getDoc(ref);
        setTaxSettings(snap.exists() ? (snap.data() as TaxSettings) : {});
      } catch (err) {
        console.error('Failed to load tax settings:', err);
        setTaxSettings({});
      }
    };
    fetchTaxSettings();
  }, [event.companyId]);
  const scheme = (taxSettings?.gstScheme || 'none').toLowerCase();
  const taxType = (taxSettings?.taxType || 'inclusive').toLowerCase();
  const taxRate = taxSettings?.defaultTaxRate || 0;

  const [pdfBannerDataUrl, setPdfBannerDataUrl] = useState<string | null>(null);

  const bannerSrc =
    event.coverImageDesktop ||
    event.coverImageMobile ||
    event.coverImage ||
    event.images?.[0] ||
    null;

  useEffect(() => {
    let cancelled = false;
    setPdfBannerDataUrl(null);
    if (!bannerSrc) return;
    loadImageAsCoverBanner(bannerSrc, PDF_BANNER_WIDTH, PDF_BANNER_HEIGHT).then((dataUrl) => {
      if (!cancelled) setPdfBannerDataUrl(dataUrl);
    });
    return () => { cancelled = true; };
  }, [bannerSrc]);

  // "Book more tickets" link inside the ticket PDF — same URL organizer's
  // "Live view" opens (organizer's base URL + /e/<slug-id>) for THIS event only.
  const [bookMoreTicketsUrl, setBookMoreTicketsUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setBookMoreTicketsUrl(null);
    if (event.status !== 'published') return;

    const slug = buildEventSlugId(event.title, event.id);
    const resolveBase = event.companyId
      ? getShareBaseUrl(event.companyId)
      : Promise.resolve(window.location.origin);

    resolveBase
      .catch(() => window.location.origin)
      .then((baseUrl) => {
        if (!cancelled) setBookMoreTicketsUrl(`${baseUrl}/e/${slug}`);
      });

    return () => { cancelled = true; };
  }, [event.companyId, event.id, event.title, event.status]);

  const { taxedBreakdown, totalTaxAmount, finalTotal, roundOffAmt } = React.useMemo(() => {
    let tax = 0;
    const items = breakdown.map((b) => {
      let itemBase = b.subtotal;
      let itemTax = 0;
      let itemTotal = b.subtotal;

      if (scheme === 'regular') {
        if (taxType === 'exclusive') {
          itemBase = b.subtotal;
          itemTax = itemBase * (taxRate / 100);
          itemTotal = itemBase + itemTax;
        } else {
          itemTotal = b.subtotal;
          itemBase = itemTotal / (1 + taxRate / 100);
          itemTax = itemTotal - itemBase;
        }
      }
      tax += itemTax;
      return { ...b, itemBase, itemTax, itemTotal };
    });

    const rawTotal = items.reduce((s, it) => s + it.itemTotal, 0);
    const rounded = taxSettings?.enableRounding
      ? roundToInterval(rawTotal, taxSettings.roundingInterval || 1)
      : rawTotal;

    return {
      taxedBreakdown: items,
      totalTaxAmount: tax,
      finalTotal: rounded,
      roundOffAmt: Number((rounded - rawTotal).toFixed(2)),
    };
  }, [breakdown, scheme, taxType, taxRate, taxSettings?.enableRounding, taxSettings?.roundingInterval]);

  // QR encodes the actual amount owed — regenerated whenever the computed
  // total changes (tax settings finish loading, etc.) so the buyer's UPI app
  // pre-fills the right amount instead of a blank/zero one.
  useEffect(() => {
    if (!event.upiId || finalTotal <= 0) {
      setQrDataUrl(null);
      return;
    }
    const upiString = `upi://pay?pa=${event.upiId}&pn=${encodeURIComponent(event.payeeName || event.title)}&am=${finalTotal.toFixed(2)}&cu=INR`;
    QRCode.toDataURL(upiString, { width: 240, margin: 1, errorCorrectionLevel: 'L' })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [event.upiId, event.payeeName, event.title, finalTotal]);

  const MAX_UPLOAD_BYTES = 1 * 1024 * 1024; // 1 MB hard cap

  const handleFile = async (file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      setScreenshotError('File must be under 1 MB.');
      setScreenshot(null);
      return;
    }
    setScreenshotError(null);
    setIsCompressing(true);
    try {
      // Target 700KB so the base64-encoded output (which is ~33% larger
      // than raw bytes) still lands comfortably under the 1MB cap.
      const compressed = await compressImageToTargetSize(file, 700, {
        maxWidth: 1280,
        maxHeight: 1280,
        mimeType: 'image/jpeg',
      });

      // Safety check: base64 data URL length roughly approximates byte size.
      const approxBytes = compressed.length * 0.75;
      if (approxBytes > MAX_UPLOAD_BYTES) {
        setScreenshotError('Image is still too large after compression. Try a smaller photo.');
        setScreenshot(null);
        return;
      }
      setScreenshot(compressed);
    } catch {
      setScreenshotError('Could not process that image, please try another.');
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
    if (
      !screenshot ||
      !consentChecked ||
      finalTotal <= 0 ||
      !attendeeDetailsComplete ||
      !customFieldsValid
    ) return;
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

      // Returned (not set as state directly) since a transaction callback can
      // retry on contention — setting state inside it could fire more than once.
      const created = await runTransaction(db, async (tx) => {
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

        // Same atomic check-and-consume as the gateway checkout flow — a code
        // is single-use, so once it's bought tickets once it's dead for any
        // further purchase, via manual QR too.
        let updatedAccessCodes: AccessCodeEntry[] | undefined;
        if (accessCode) {
          const currentAccessCodes = (data.accessCodes || []) as AccessCodeEntry[];
          const cleaned = accessCode.trim().toUpperCase();
          const entryIndex = currentAccessCodes.findIndex((e) => e.code.trim().toUpperCase() === cleaned);
          if (entryIndex !== -1) {
            const entry = currentAccessCodes[entryIndex];
            const totalQty = breakdown.reduce((sum, b) => sum + b.qty, 0);
            if (entry.usedAt) {
              throw new Error('CODE_ALREADY_USED');
            }
            if (entry.maxTickets && totalQty > entry.maxTickets) {
              throw new Error('CODE_LIMIT_REACHED');
            }
            updatedAccessCodes = currentAccessCodes.map((e, i) =>
              i === entryIndex ? { ...e, usedCount: totalQty, usedAt: new Date().toISOString() } : e
            );
          }
        }

        tx.update(eventRef, {
          tiers: updatedTiers,
          ...(updatedAccessCodes ? { accessCodes: updatedAccessCodes } : {}),
        });

        let index = 0;
        const created: PurchasedTicket[] = [];
        taxedBreakdown.forEach((tier) => {
          const unitBase = tier.qty > 0 ? tier.itemBase / tier.qty : 0;
          const unitTax = tier.qty > 0 ? tier.itemTax / tier.qty : 0;
          const unitTotal = unitBase + unitTax;

          for (let i = 0; i < tier.qty; i++) {
            const attendeeDoc = doc(attendeesRef);
            const ticketNumber = totalAlreadySold + index + 1;
            const ticketId = `${initials}-${String(ticketNumber).padStart(3, '0')}`;
            const attendee = attendeeDetails[index] ?? { name: '', email: '', phone: '' };

            tx.set(attendeeDoc, {
              name: attendee.name.trim(),
              email: attendee.email.trim(),
              phone: attendee.phone.trim(),
              tierName: tier.name,
              ticketTierId: tier.id,
              ticketId,
              status: 'valid',
              amountPaid: Number(unitTotal.toFixed(2)),
              baseAmount: Number(unitBase.toFixed(2)),
              taxAmount: Number(unitTax.toFixed(2)),
              taxRate,
              taxType: scheme === 'regular' ? (taxType === 'exclusive' ? 'Exclusive' : 'Inclusive') : scheme,
              customFieldAnswers: customAnswers,
              purchasedAt: serverTimestamp(),
              checkedInAt: null,
              paymentMethod: 'manual_qr',
              paymentMode: 'UPI',
              screenshotUrl,
              accessCode: accessCode || null,
            });
            created.push({
              ticketId,
              tierName: tier.name,
              attendeeName: attendee.name.trim(),
              accessCode,
              attendeeEmail: attendee.email.trim(),
              attendeePhone: attendee.phone.trim(),
              amountPaid: Number(unitTotal.toFixed(2)),
              paymentMode: 'UPI',
              purchasedAt: orderStamp,
            });
            index += 1;
          }
        });
        return created;
      });

      setPurchasedTickets(created);
      setSubmitted(true);
      onSuccess();
    } catch (e: any) {
      console.error('Manual QR payment submission failed:', e);
      setError(
        e?.message === 'CODE_ALREADY_USED'
          ? "This access code has already been used to book tickets and can't be used again."
          : e?.message === 'CODE_LIMIT_REACHED'
            ? 'This access code allows fewer tickets than you selected. Try a smaller quantity.'
            : e?.message || 'Something went wrong while submitting. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-white dark:bg-[#0F172A]">
        <TicketConfirmation
          eventTitle={event.title}
          eventDate={event.date}
          eventTime={event.time}
          eventVenue={event.venue}
          tickets={purchasedTickets}
          onDone={onClose}
          eventBannerDataUrl={pdfBannerDataUrl}
          eventConsentText={event.consentText}
          eventGoodToKnowText={event.goodToKnowText}
          eventIsOnline={event.isOnline}
          eventIsPrivate={event.isPrivate}
          eventArriveBy={event.arriveByTime}
          eventAgeLimit={event.ageLimit}
          eventHelplineNumber={event.helplineNumber}
          bookMoreTicketsUrl={bookMoreTicketsUrl}
        />
      </div>
    );
  }

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

        {(
          <div className="grow overflow-y-auto p-4 space-y-4">
            <div className="rounded-sm bg-slate-50 dark:bg-slate-800 p-3 space-y-1">
              {taxedBreakdown.map((b) => (
                <div key={b.id} className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>{b.qty}× {b.name}</span>
                  <span>₹{b.itemBase.toFixed(2)}</span>
                </div>
              ))}
              {totalTaxAmount > 0 && (
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>{taxType === 'inclusive' ? 'Tax (included in price)' : 'Tax'}</span>
                  <span>₹{totalTaxAmount.toFixed(2)}</span>
                </div>
              )}
              {roundOffAmt !== 0 && (
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Round off</span>
                  <span>₹{roundOffAmt.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1.5 text-sm font-bold text-slate-800 dark:text-white">
                <span>Total</span>
                <span>₹{finalTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {event.payeeName || 'Kindly pay the exact amount on the below QR'}
            </p>


            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Payment QR" className="mx-auto w-48 h-48 rounded-sm border border-slate-200 dark:border-slate-700 object-contain bg-white" />
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

            {/* Attendee details — needed so each attendee doc is complete, like a normal ticket */}
            {ticketSlots.length > 1 && (
              <label className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                Use the same details for all {ticketSlots.length} tickets
                <button
                  type="button"
                  role="switch"
                  aria-checked={sameForAll}
                  onClick={() => handleToggleSameForAll(!sameForAll)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${sameForAll ? 'bg-[#007A78] dark:bg-[#2DD4BF]' : 'bg-gray-300 dark:bg-slate-600'
                    }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${sameForAll ? 'translate-x-4' : 'translate-x-1'
                      }`}
                  />
                </button>
              </label>
            )}

            <div className="space-y-4">
              {attendeeDetails.map((entry, index) => {
                if (sameForAll && index > 0) return null;
                return (
                  <div key={index} className="space-y-2">
                    {ticketSlots.length > 1 && !sameForAll && (
                      <p className="text-xs font-bold text-[#007A78]">
                        Ticket {index + 1} · {ticketSlots[index]?.tierName}
                      </p>
                    )}
                    <input
                      type="text"
                      placeholder="Full name *"
                      value={entry.name}
                      onChange={(e) => updateAttendee(index, 'name', e.target.value)}
                      className="w-full rounded-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-[#007A78]"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <input
                          type="tel"
                          inputMode="numeric"
                          placeholder="Phone *"
                          value={entry.phone}
                          onChange={(e) => updateAttendee(index, 'phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                          maxLength={10}
                          className="w-full rounded-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-[#007A78]"
                        />
                        {entry.phone && !isValidPhone(entry.phone) && (
                          <p className="text-[10px] text-red-500 mt-0.5">Enter a valid 10-digit number</p>
                        )}
                      </div>

                      <div>
                        <input
                          type="email"
                          placeholder="Email (optional)"
                          value={entry.email}
                          onChange={(e) => updateAttendee(index, 'email', e.target.value)}
                          className="w-full rounded-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-[#007A78]"
                        />
                        {entry.email && !isValidEmail(entry.email) && (
                          <p className="text-[10px] text-red-500 mt-0.5">Enter a valid email</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {customFields.length > 0 && (
              <div className="space-y-2">
                {customFields.map((field) => {
                  const value = customAnswers[field.id] ?? '';
                  const baseClass =
                    'w-full rounded-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-[#007A78]';

                  return (
                    <div key={field.id}>
                      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                        {field.label}{field.required ? ' *' : ''}
                      </label>

                      {field.type === 'textarea' && (
                        <textarea
                          rows={3}
                          value={value}
                          onChange={(e) => updateCustomAnswer(field.id, e.target.value)}
                          placeholder={field.label}
                          className={baseClass}
                        />
                      )}

                      {field.type === 'select' && (
                        <select
                          value={value}
                          onChange={(e) => updateCustomAnswer(field.id, e.target.value)}
                          className={baseClass}
                        >
                          <option value="">Select…</option>
                          {(field.options ?? []).map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}

                      {field.type === 'checkbox' && (
                        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={value === 'true'}
                            onChange={(e) => updateCustomAnswer(field.id, e.target.checked ? 'true' : 'false')}
                            className="h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300"
                          />
                          {field.label}
                        </label>
                      )}

                      {field.type === 'text' && (
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => updateCustomAnswer(field.id, e.target.value)}
                          placeholder={field.label}
                          className={baseClass}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Screenshot upload */}
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Upload the screenshot once done *</p>
              <label
                className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border-2 border-dashed p-4 text-center hover:bg-slate-50 dark:hover:bg-slate-800 ${screenshotError ? 'border-red-400 dark:border-red-500' : 'border-slate-300 dark:border-slate-600'
                  }`}
              >
                {isCompressing ? (
                  <Loader2 size={18} className="animate-spin text-slate-400" />
                ) : (
                  <Upload size={18} className="text-slate-400" />
                )}
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {isCompressing
                    ? 'Processing image…'
                    : screenshot
                      ? 'Screenshot selected tap to change'
                      : 'Click to choose a file or drag here'}
                </span>
                <span className="text-[10px] text-slate-400">Size limit 1 MB</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isCompressing}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </label>
              {screenshotError && <p className="mt-1 text-xs font-medium text-red-500">{screenshotError}</p>}
              {screenshot && (
                <div className="relative mt-2 w-fit mx-auto">
                  <img src={screenshot} alt="Screenshot preview" className="max-h-32 rounded-sm border border-slate-200 dark:border-slate-700" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setScreenshot(null);
                      setScreenshotError(null);
                    }}
                    className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white shadow hover:bg-slate-900"
                    aria-label="Remove screenshot"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>

            <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 bg-white accent-[#007A78] [color-scheme:light]"
              />
              This confirms the submission of your ticket request. Final entry/pass allocation is subject to the organizer’s approval and discretion. Any further communication will be shared by the organizer.
            </label>

            {error && (
              <div
                ref={errorRef}
                className="flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
              >
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {!submitted && (
          <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3">
            <button
              onClick={handleSubmit}
              disabled={
                !screenshot ||
                !consentChecked ||
                finalTotal <= 0 ||
                !attendeeDetailsComplete ||
                !customFieldsValid ||
                submitting ||
                isCompressing
              }
              className="w-full rounded-sm bg-[#007A78] py-2.5 text-sm font-semibold text-white hover:bg-[#006361] disabled:opacity-40"
            >
              {submitting ? 'Submitting…' : "I've paid confirm my ticket"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualQRPaymentCard;