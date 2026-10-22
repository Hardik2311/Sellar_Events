import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Upload, Copy, Check, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { collection, doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { compressImageToTargetSize } from '../lib/imageCompression';
import { stripHtmlTags } from '../lib/utils';
import { formatTime, type AccessCodeEntry, type PublicEvent } from '../data/events';
import { formatRupees, formatShortDateRange } from '../lib/storefrontFormat';
import QRCode from 'qrcode';
import { loadTicketPdfHero } from '../lib/ticketPdf';
import TicketConfirmation from './TicketConfirmation';
import { assignBookingGroups, formatTicketId, getEventInitials, nextTicketNumbers } from '../lib/ticketing';
import { buildEventSlugId } from '../data/events';
import { getShareBaseUrl } from '../lib/shareLinks';
import BrandNavHeader from './brand/BrandNavHeader';
import SectionLabel from './brand/SectionLabel';
import TicketOrderSummary from './brand/TicketOrderSummary';
import BrandCheckbox from './brand/BrandCheckbox';
import MobileCheckoutBar from './brand/MobileCheckoutBar';
import MobileOrderSummary from './brand/MobileOrderSummary';
import CheckoutStepPills from './brand/CheckoutStepPills';
import BrandButton from './brand/BrandButton';
import {
  brandErrorClass,
  brandFieldHeight,
  brandHelpClass,
  brandInputClass,
  brandLabelClass,
  brandPanelClass,
} from './brand/brandForm';


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
  bookingGroupId?: string | null;
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
  organizationName?: string;
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
interface AttendeeFormEntry {
  name: string;
  email: string;
  phone: string;
}

const ManualQRPaymentCard: React.FC<Props> = ({ event, breakdown, quantities, accessCode, organizationName, onClose, onSuccess }) => {
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

  // On-screen ticket hero: the portrait (mobile) poster first.
  const bannerSrc =
    event.coverImageMobile ||
    event.coverImageDesktop ||
    event.coverImage ||
    event.images?.[0] ||
    null;
  // PDF hero is wide, so the desktop cover looks better there; portrait is the fallback.
  const pdfHeroSrc =
    event.coverImageDesktop ||
    event.coverImageMobile ||
    event.coverImage ||
    event.images?.[0] ||
    null;

  useEffect(() => {
    let cancelled = false;
    setPdfBannerDataUrl(null);
    if (!pdfHeroSrc) return;
    loadTicketPdfHero(pdfHeroSrc).then((dataUrl) => {
      if (!cancelled) setPdfBannerDataUrl(dataUrl);
    });
    return () => { cancelled = true; };
  }, [pdfHeroSrc]);

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

        const totalTickets = breakdown.reduce((sum, b) => sum + b.qty, 0);
        const { numbers: ticketNumbers, ticketSeq } = nextTicketNumbers(data, totalTickets);

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
          ticketSeq,
          ...(updatedAccessCodes ? { accessCodes: updatedAccessCodes } : {}),
        });

        // Pre-create every attendee doc ref so same-name tickets in this
        // order can share one QR / group check-in (lead = first doc id).
        const attendeeDocs = Array.from({ length: totalTickets }, () => doc(attendeesRef));
        const bookingGroupIds = assignBookingGroups(
          attendeeDocs.map((_, i) => (attendeeDetails[i]?.name ?? '').trim()),
          attendeeDocs.map((d) => d.id)
        );

        let index = 0;
        const created: PurchasedTicket[] = [];
        taxedBreakdown.forEach((tier) => {
          const unitBase = tier.qty > 0 ? tier.itemBase / tier.qty : 0;
          const unitTax = tier.qty > 0 ? tier.itemTax / tier.qty : 0;
          const unitTotal = unitBase + unitTax;

          for (let i = 0; i < tier.qty; i++) {
            const attendeeDoc = attendeeDocs[index];
            const ticketId = formatTicketId(initials, ticketNumbers[index]);
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
              bookingGroupId: bookingGroupIds[index],
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
              bookingGroupId: bookingGroupIds[index],
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
      <div className="brand-theme fixed inset-0 z-50 overflow-y-auto bg-[var(--brand-cream)]">
        <BrandNavHeader organizationName={organizationName} variant="minimal" rightSlot={<span />} />
        <TicketConfirmation
          eventTitle={event.title}
          eventCategory={event.category}
          eventDate={event.date}
          eventTime={event.time}
          eventVenue={event.venue}
          tickets={purchasedTickets}
          onDone={onClose}
          eventBannerDataUrl={pdfBannerDataUrl}
          eventPosterUrl={bannerSrc}
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

  const submitDisabled =
    !screenshot ||
    !consentChecked ||
    finalTotal <= 0 ||
    !attendeeDetailsComplete ||
    !customFieldsValid ||
    submitting ||
    isCompressing;

  const submitCtaLabel = submitting ? 'Submitting…' : "I've paid, confirm";
  const totalTicketQty = breakdown.reduce((sum, b) => sum + b.qty, 0);
  const totalLabel = formatRupees(finalTotal, { zeroAsFree: false });

  const steps = [
    { id: 'manual-details', label: 'Details', complete: attendeeDetailsComplete },
    ...(customFields.length > 0 ? [{ id: 'manual-questions', label: 'Questions', complete: customFieldsValid }] : []),
    { id: 'manual-payment', label: 'Payment', complete: !!screenshot && consentChecked },
  ];

  const orderSummary = (
    <TicketOrderSummary
      eventTitle={stripHtmlTags(event.title)}
      dateLabel={`${formatShortDateRange(event.date, event.endDate)}, ${formatTime(event.time)}`}
      venueLabel={event.isOnline ? 'Online' : event.venue}
      lineItems={[
        ...taxedBreakdown.map((b) => ({
          id: b.id,
          label: `${b.qty} × ${b.name}`,
          amountLabel: formatRupees(b.itemTotal),
        })),
        ...(totalTaxAmount > 0
          ? [{ id: 'tax', label: taxType === 'inclusive' ? 'Tax (included in price)' : 'Tax', amountLabel: formatRupees(totalTaxAmount, { zeroAsFree: false }), muted: true }]
          : []),
        ...(roundOffAmt !== 0
          ? [{ id: 'round-off', label: 'Round off', amountLabel: `${roundOffAmt < 0 ? '−' : ''}${formatRupees(Math.abs(roundOffAmt), { zeroAsFree: false })}`, muted: true }]
          : []),
      ]}
      totalLabel={totalLabel}
      ctaLabel={submitCtaLabel}
      onCta={handleSubmit}
      ctaDisabled={submitDisabled}
    />
  );
  const orderItemsLabel = breakdown.length === 1 ? `${breakdown[0].qty} × ${breakdown[0].name}` : `${totalTicketQty} tickets`;

  return (
    <div className="brand-theme fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[var(--brand-cream)] pb-24 text-[var(--brand-black)] lg:pb-0">
      <BrandNavHeader organizationName={organizationName} variant="minimal" />

      <div className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <BrandButton variant="link" onClick={onClose} className="mb-3 !text-[var(--brand-black)]">
              <ArrowLeft size={18} /> Back to event
            </BrandButton>
            <h1 className="brand-display text-[32px] leading-none text-[var(--brand-black)] sm:text-[44px]">
              Almost <span className="text-[var(--brand-teal)]">in.</span>
            </h1>
            <p className="mt-2 text-[15px] text-[var(--brand-muted)]">
              {stripHtmlTags(event.title)} &middot; {formatShortDateRange(event.date, event.endDate)}
            </p>
          </div>
          <CheckoutStepPills steps={steps} />
        </div>

        <MobileOrderSummary className="mt-6" itemsLabel={orderItemsLabel} totalLabel={totalLabel}>
          {orderSummary}
        </MobileOrderSummary>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10">
          {/* ── Left: form ─────────────────────────────────────────────── */}
          <div className="flex min-w-0 flex-col gap-8">
            {/* Your details */}
            <section id="manual-details" className="scroll-mt-6">
              <SectionLabel className="mb-4">Your details</SectionLabel>
              <div className={`${brandPanelClass} flex flex-col gap-5`}>
                {ticketSlots.length > 1 && (
                  <BrandCheckbox checked={sameForAll} onChange={handleToggleSameForAll}>
                    Use the same details for all {ticketSlots.length} tickets
                  </BrandCheckbox>
                )}

                {attendeeDetails.map((entry, index) => {
                  if (sameForAll && index > 0) return null;
                  const phoneInvalid = !!entry.phone && !isValidPhone(entry.phone);
                  const emailInvalid = !!entry.email && !isValidEmail(entry.email);
                  return (
                    <div key={index} className="flex flex-col gap-4">
                      {ticketSlots.length > 1 && !sameForAll && (
                        <p className="text-[15px] font-semibold text-[var(--brand-black)]">
                          Ticket {index + 1}, {ticketSlots[index]?.tierName}
                        </p>
                      )}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label htmlFor={`manual-${index}-name`} className={brandLabelClass}>Full name</label>
                          <input
                            id={`manual-${index}-name`}
                            type="text"
                            placeholder="As on your ID"
                            autoComplete="name"
                            value={entry.name}
                            onChange={(e) => updateAttendee(index, 'name', e.target.value)}
                            className={`${brandInputClass()} ${brandFieldHeight}`}
                          />
                        </div>
                        <div>
                          <label htmlFor={`manual-${index}-phone`} className={brandLabelClass}>Phone</label>
                          <div className="flex">
                            <span className="inline-flex shrink-0 items-center rounded-l-lg border border-r-0 border-[var(--brand-line-strong)] bg-[var(--brand-cream)] px-3 text-[15px] font-semibold text-[var(--brand-muted)]">
                              +91
                            </span>
                            <input
                              id={`manual-${index}-phone`}
                              type="tel"
                              inputMode="numeric"
                              placeholder="10-digit mobile number"
                              autoComplete="tel-national"
                              value={entry.phone}
                              onChange={(e) => updateAttendee(index, 'phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                              maxLength={10}
                              aria-invalid={phoneInvalid || undefined}
                              className={`${brandInputClass(phoneInvalid)} ${brandFieldHeight} rounded-l-none`}
                            />
                          </div>
                          {phoneInvalid && (
                            <p className={brandErrorClass}>
                              <AlertCircle size={14} aria-hidden="true" /> Enter a 10-digit mobile number starting with 6 to 9.
                            </p>
                          )}
                        </div>
                        <div>
                          <label htmlFor={`manual-${index}-email`} className={brandLabelClass}>Email</label>
                          <input
                            id={`manual-${index}-email`}
                            type="email"
                            placeholder="you@example.com"
                            autoComplete="email"
                            value={entry.email}
                            onChange={(e) => updateAttendee(index, 'email', e.target.value)}
                            aria-invalid={emailInvalid || undefined}
                            className={`${brandInputClass(emailInvalid)} ${brandFieldHeight}`}
                          />
                          {emailInvalid ? (
                            <p className={brandErrorClass}>
                              <AlertCircle size={14} aria-hidden="true" /> Enter a valid email, like name@example.com.
                            </p>
                          ) : (
                            <p className={brandHelpClass}>Tickets are sent here.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* A few questions */}
            {customFields.length > 0 && (
              <section id="manual-questions" className="scroll-mt-6">
                <SectionLabel className="mb-4">A few questions</SectionLabel>
                <div className={`${brandPanelClass} flex flex-col gap-4`}>
                  {customFields.map((field) => {
                    const value = customAnswers[field.id] ?? '';
                    const fieldId = `manual-q-${field.id}`;

                    return (
                      <div key={field.id}>
                        {field.type !== 'checkbox' && (
                          <label htmlFor={fieldId} className={brandLabelClass}>
                            {field.label}{field.required ? ' *' : ''}
                          </label>
                        )}

                        {field.type === 'textarea' && (
                          <textarea
                            id={fieldId}
                            rows={3}
                            value={value}
                            onChange={(e) => updateCustomAnswer(field.id, e.target.value)}
                            className={`${brandInputClass()} py-3`}
                          />
                        )}

                        {field.type === 'select' && (
                          <select
                            id={fieldId}
                            value={value}
                            onChange={(e) => updateCustomAnswer(field.id, e.target.value)}
                            className={`${brandInputClass()} ${brandFieldHeight}`}
                          >
                            <option value="">Select…</option>
                            {(field.options ?? []).map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}

                        {field.type === 'checkbox' && (
                          <BrandCheckbox
                            checked={value === 'true'}
                            onChange={(checked) => updateCustomAnswer(field.id, checked ? 'true' : 'false')}
                          >
                            {field.label}{field.required ? ' *' : ''}
                          </BrandCheckbox>
                        )}

                        {field.type === 'text' && (
                          <input
                            id={fieldId}
                            type="text"
                            value={value}
                            onChange={(e) => updateCustomAnswer(field.id, e.target.value)}
                            className={`${brandInputClass()} ${brandFieldHeight}`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Pay by UPI */}
            <section id="manual-payment" className="scroll-mt-6">
              <SectionLabel className="mb-4">Pay by UPI</SectionLabel>
              <div className={`${brandPanelClass} flex flex-col gap-5`}>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-start sm:gap-6">
                  {/* QR, payee and amount together */}
                  <div className="flex flex-col items-center gap-2.5 rounded-xl border border-[var(--brand-line)] bg-white p-4 text-center">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="UPI payment QR code" className="h-44 w-44 object-contain" />
                    ) : (
                      <p className="flex items-center gap-1.5 py-10 text-[13px] font-medium text-[var(--brand-danger)]">
                        <AlertCircle size={14} aria-hidden="true" /> The organizer hasn&rsquo;t set up a QR yet.
                      </p>
                    )}
                    {event.payeeName && (
                      <p className="text-[15px] font-semibold leading-[22px] text-[var(--brand-black)]">{event.payeeName}</p>
                    )}
                    <p className="brand-display text-[28px] leading-none tabular-nums text-[var(--brand-black)]">{totalLabel}</p>
                  </div>

                  <div className="flex min-w-0 flex-col gap-4">
                    {event.upiId && (
                      <div>
                        <span className={brandLabelClass}>UPI ID</span>
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--brand-line-strong)] bg-[var(--brand-cream)] py-1.5 pl-3.5 pr-1.5">
                          <span className="min-w-0 truncate text-[15px] font-semibold">{event.upiId}</span>
                          <button
                            type="button"
                            onClick={handleCopyUpi}
                            aria-label={copied ? 'UPI ID copied' : 'Copy UPI ID'}
                            className="flex h-9 shrink-0 items-center gap-1.5 rounded-sm border border-[var(--brand-line-strong)] bg-[var(--brand-surface)] px-3 text-[13px] font-semibold text-[var(--brand-black)] hover:bg-[var(--brand-cream)]"
                          >
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                            {copied ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}

                    <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[15px] leading-[22px] marker:font-semibold">
                      <li>Scan the QR or pay to the UPI ID from any UPI app.</li>
                      <li>
                        Pay exactly <strong className="font-semibold">{totalLabel}</strong>.
                      </li>
                      <li>Upload the payment screenshot below.</li>
                    </ol>
                  </div>
                </div>

                {/* Screenshot upload */}
                <div>
                  <span className={brandLabelClass}>Payment screenshot *</span>
                  {screenshot ? (
                    <div className="flex items-center gap-3 rounded-lg border-[1.5px] border-dashed border-[var(--brand-line-strong)] bg-[var(--brand-surface)] p-3">
                      <img src={screenshot} alt="Payment screenshot preview" className="h-12 w-12 shrink-0 rounded-md border border-[var(--brand-line)] object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--brand-black)]">Screenshot added</p>
                        <label className="cursor-pointer text-[13px] font-semibold text-[var(--brand-teal)] hover:underline">
                          Choose a different one
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={isCompressing}
                            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setScreenshot(null);
                          setScreenshotError(null);
                        }}
                        aria-label="Remove screenshot"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-[var(--brand-line-strong)] bg-[var(--brand-surface)] text-[var(--brand-black)] hover:bg-[var(--brand-cream)]"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <label
                      className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed bg-[var(--brand-surface)] p-5 text-center hover:bg-[var(--brand-cream)] ${
                        screenshotError ? 'border-[var(--brand-danger)]' : 'border-[var(--brand-line-strong)]'
                      }`}
                    >
                      {isCompressing ? (
                        <Loader2 size={20} className="animate-spin text-[var(--brand-muted)] motion-reduce:animate-none" />
                      ) : (
                        <Upload size={20} strokeWidth={1.75} className="text-[var(--brand-black)]" />
                      )}
                      <span className="text-sm font-semibold text-[var(--brand-black)]">
                        {isCompressing ? 'Preparing your image…' : 'Choose a screenshot or drag it here'}
                      </span>
                      <span className="text-[13px] text-[var(--brand-muted)]">PNG or JPG, under 1 MB</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isCompressing}
                        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                      />
                    </label>
                  )}
                  {screenshotError && (
                    <p className={brandErrorClass}>
                      <AlertCircle size={14} aria-hidden="true" /> {screenshotError}
                    </p>
                  )}
                </div>

                <BrandCheckbox checked={consentChecked} onChange={setConsentChecked} className="text-sm">
                  You&rsquo;re added to the guest list as soon as you submit. Final entry and pass allocation are subject to the organizer&rsquo;s approval.
                </BrandCheckbox>

                {error && (
                  <div
                    ref={errorRef}
                    className="flex items-start gap-2 rounded-lg border border-[var(--brand-danger)] bg-[var(--brand-surface)] px-4 py-3 text-sm font-medium text-[var(--brand-danger)]"
                  >
                    <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* ── Right: sticky order summary ───────────────────────────── */}
          <div className="hidden lg:sticky lg:top-6 lg:block lg:self-start">
              {orderSummary}
          </div>
        </div>
      </div>

      {/* ── Floating total + confirm bar — mobile only ───────────────── */}
      <MobileCheckoutBar
        countLabel={`${totalTicketQty} ticket${totalTicketQty === 1 ? '' : 's'}`}
        totalLabel={totalLabel}
        ctaLabel={submitCtaLabel}
        onCta={handleSubmit}
        ctaDisabled={submitDisabled}
      />
    </div>
  );
};

export default ManualQRPaymentCard;
