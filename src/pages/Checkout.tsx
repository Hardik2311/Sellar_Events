import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Ticket, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';
import { collection, doc, getDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { usePublicEvent } from '../hooks/usePublicEvents';
import { formatTime, type AccessCodeEntry } from '../data/events';
import { formatRupees, formatShortDateRange } from '../lib/storefrontFormat';
import { useDomainResolution } from '../hooks/useDomainResolution';
import { useCompanySettings } from '../hooks/useSettings';
import { getSubdomain } from '../lib/subdomain';
import { buildEventSlugId } from '../data/events';
import { getShareBaseUrl } from '../lib/shareLinks';
import TicketConfirmation from '../components/TicketConfirmation';
import PaymentProcessingOverlay from '../components/brand/PaymentProcessingOverlay';
import { stripHtmlTags } from '../lib/utils';
import { assignBookingGroups, formatTicketId, getEventInitials, nextTicketNumbers } from '../lib/ticketing';
import { checkoutErrorMessage, payWithRazorpay, PaymentCancelledError } from '../lib/razorpay';
import { loadTicketPdfHero } from '../lib/ticketPdf';
import BrandNavHeader from '../components/brand/BrandNavHeader';
import SectionLabel from '../components/brand/SectionLabel';
import TicketOrderSummary from '../components/brand/TicketOrderSummary';
import CheckoutStepPills from '../components/brand/CheckoutStepPills';
import BrandCheckbox from '../components/brand/BrandCheckbox';
import MobileCheckoutBar from '../components/brand/MobileCheckoutBar';
import MobileOrderSummary from '../components/brand/MobileOrderSummary';
import BrandButton from '../components/brand/BrandButton';
import BrandEmptyState from '../components/brand/BrandEmptyState';
import {
  brandErrorClass,
  brandFieldHeight,
  brandHelpClass,
  brandInputClass,
  brandLabelClass,
  brandPanelClass,
} from '../components/brand/brandForm';

const RAZORPAY_THEME_COLOR = '#007a78'; // --brand-teal

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

const CheckoutPage: React.FC = () => {
  const { id, companyId } = useParams<{ id: string; companyId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { resolvedCompanyId, loading: domainLoading, error: domainError } = useDomainResolution(companyId);
  const { event, loading: eventLoading } = usePublicEvent(id, resolvedCompanyId);
  const { settings } = useCompanySettings(resolvedCompanyId);
  const loading = domainLoading || eventLoading;
  const locationState = location.state as { quantities?: Record<string, number>; accessCode?: string } | null;
  const quantities: Record<string, number> = locationState?.quantities ?? {};
  const accessCode = locationState?.accessCode;

  interface AttendeeFormEntry {
    name: string;
    email: string;
    phone: string;
    customAnswers: Record<string, string>;
  }

  // Ek ticket = ek attendee slot, tier order me flatten kiya — hooks se pehle chahiye isliye
  // yaha `event` null-safe rakha hai (early return se pehle hi call hoga)
  const ticketSlots = useMemo(() => {
    if (!event) return [] as { tierId: string; tierName: string }[];
    return event.tiers.flatMap((t) => {
      const rawQty = quantities[t.id] ?? 0;
      const qty = Number.isInteger(rawQty) && rawQty > 0 ? rawQty : 0;
      return Array.from({ length: qty }, () => ({ tierId: t.id, tierName: t.name }));
    });
  }, [event, quantities]);

  const [attendeeDetails, setAttendeeDetails] = useState<AttendeeFormEntry[]>([]);
  const [sameForAll, setSameForAll] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [step, setStep] = useState<'details' | 'processing' | 'success'>('details');
  // True between Razorpay's success callback and the tickets coming back.
  const [confirmingPayment, setConfirmingPayment] = useState(false);
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
    status?: 'valid' | 'checked_in' | 'cancelled';
    bookingGroupId?: string | null;
  }

  const [purchasedTickets, setPurchasedTickets] = useState<PurchasedTicket[]>([]);

  useEffect(() => {
    setAttendeeDetails((prev) => {
      if (prev.length === ticketSlots.length) return prev;
      return Array.from(
        { length: ticketSlots.length },
        (_, i) => prev[i] ?? { name: '', email: '', phone: '', customAnswers: {} }
      );
    });
  }, [ticketSlots.length]);

  // When "same for all" is on, editing ticket 1 mirrors the change to every
  // other slot so a single set of details covers the whole bulk booking.
  const updateAttendee = (index: number, field: keyof AttendeeFormEntry, value: string) => {
    setAttendeeDetails((prev) =>
      prev.map((a, i) => (i === index || (sameForAll && index === 0) ? { ...a, [field]: value } : a))
    );
  };

  const updateCustomAnswer = (index: number, fieldId: string, value: string) => {
    setAttendeeDetails((prev) =>
      prev.map((a, i) =>
        i === index || (sameForAll && index === 0)
          ? { ...a, customAnswers: { ...a.customAnswers, [fieldId]: value } }
          : a
      )
    );
  };

  // Flip the toggle on: immediately copy ticket 1's current details onto every slot.
  const handleToggleSameForAll = (checked: boolean) => {
    setSameForAll(checked);
    if (checked) {
      setAttendeeDetails((prev) => (prev.length > 0 ? prev.map(() => ({ ...prev[0] })) : prev));
    }
  };

  const [taxSettings, setTaxSettings] = useState<TaxSettings | null>(null);

  useEffect(() => {
    if (!event?.companyId) return;
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
  }, [event?.companyId]);

  const [pdfBannerDataUrl, setPdfBannerDataUrl] = useState<string | null>(null);

  // On-screen ticket hero: the portrait (mobile) poster first.
  const bannerSrc =
    event?.coverImageMobile ||
    event?.coverImageDesktop ||
    event?.coverImage ||
    event?.images?.[0] ||
    null;
  // PDF hero is wide, so the desktop cover looks better there; portrait is the fallback.
  const pdfHeroSrc =
    event?.coverImageDesktop ||
    event?.coverImageMobile ||
    event?.coverImage ||
    event?.images?.[0] ||
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
  const eventCompanyId = event?.companyId;
  const eventIdForLink = event?.id;
  const eventTitleForLink = event?.title;
  const eventStatusForLink = event?.status;
  useEffect(() => {
    let cancelled = false;
    setBookMoreTicketsUrl(null);
    if (!eventIdForLink || !eventTitleForLink || eventStatusForLink !== 'published') return;

    const slug = buildEventSlugId(eventTitleForLink, eventIdForLink);
    const resolveBase = eventCompanyId
      ? getShareBaseUrl(eventCompanyId)
      : Promise.resolve(window.location.origin);

    resolveBase
      .catch(() => window.location.origin)
      .then((baseUrl) => {
        if (!cancelled) setBookMoreTicketsUrl(`${baseUrl}/e/${slug}`);
      });

    return () => { cancelled = true; };
  }, [eventCompanyId, eventIdForLink, eventTitleForLink, eventStatusForLink]);

  if (loading) {
    return (
      <div className="brand-theme flex min-h-screen w-full flex-col bg-[var(--brand-cream)]" aria-busy="true" aria-label="Loading checkout">
        <div className="h-16 border-b border-[var(--brand-line)] bg-[var(--brand-surface)]" />
        <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-6 px-4 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10 lg:px-12">
          <div className="flex flex-col gap-4">
            <div className="h-10 w-56 animate-pulse rounded-lg bg-[var(--brand-skeleton)] motion-reduce:animate-none" />
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-xl bg-[var(--brand-skeleton)] motion-reduce:animate-none" />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-xl bg-[var(--brand-skeleton)] motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  if (domainError || (!loading && !event)) {
    return (
      <div className="brand-theme flex min-h-screen w-full items-center justify-center bg-[var(--brand-cream)] p-4">
        <BrandEmptyState
          icon={Ticket}
          title="This order isn't available"
          body="The event may have been removed, or the link might be wrong."
          className="w-full max-w-md"
          action={
            <BrandButton
              onClick={() =>
                navigate(
                  getSubdomain() ? '/' : resolvedCompanyId ? `/public/${resolvedCompanyId}` : '/'
                )
              }
            >
              All events
            </BrandButton>
          }
        />
      </div>
    );
  }

  // Fallback to satisfy typescript
  if (!event) return null;

  const lineItems = event.tiers
    .map((t) => {
      const rawQty = quantities[t.id] ?? 0;
      const qty = Number.isInteger(rawQty) && rawQty > 0 ? rawQty : 0;
      return { tier: t, qty };
    })
    .filter((item) => item.qty > 0);

  const scheme = (taxSettings?.gstScheme || 'none').toLowerCase();
  const taxType = (taxSettings?.taxType || 'inclusive').toLowerCase();
  const taxRate = taxSettings?.defaultTaxRate || 0;

  const lineItemsWithTax = lineItems.map((item) => {
    const qty = item.qty;
    const price = item.tier.price;

    let itemBaseAmount = 0;
    let itemTaxAmount = 0;
    let itemTotalAmount = 0;

    if (scheme === 'regular') {
      if (taxType === 'exclusive') {
        itemBaseAmount = price * qty;
        itemTaxAmount = itemBaseAmount * (taxRate / 100);
        itemTotalAmount = itemBaseAmount + itemTaxAmount;
      } else {
        itemTotalAmount = price * qty;
        itemBaseAmount = itemTotalAmount / (1 + taxRate / 100);
        itemTaxAmount = itemTotalAmount - itemBaseAmount;
      }
    } else {
      itemBaseAmount = price * qty;
      itemTaxAmount = 0;
      itemTotalAmount = itemBaseAmount;
    }

    return { ...item, itemBaseAmount, itemTaxAmount, itemTotalAmount };
  });

  const totalTaxAmount = lineItemsWithTax.reduce((s, it) => s + it.itemTaxAmount, 0);
  const subtotal = lineItemsWithTax.reduce((s, it) => s + it.itemTotalAmount, 0);

  const total = taxSettings?.enableRounding
    ? roundToInterval(subtotal, taxSettings.roundingInterval || 1)
    : subtotal;

  const roundOffAmt = Number((total - subtotal).toFixed(2));

  // The platform's fee is deducted from the organizer's payout (see
  // functions/payments/pricing.js computeDeductions), not added on top of
  // what the buyer pays — so the buyer's total is just the ticket price.
  const isGatewayEvent = event.paymentCollectionMode === 'gateway';
  const grandTotal = total;
  const totalQty = lineItems.reduce((s, item) => s + item.qty, 0);
  const isValidPhone = (value: string) => /^[6-9]\d{9}$/.test(value.trim());
  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  // Drop questions the organizer never actually labeled — otherwise an
  // empty custom field still renders as a blank, pointless input at checkout.
  const customFields = (event.customFields ?? []).filter((f) => f.label?.trim());

  // Split so the step pills can tick "Details" and "Questions" separately.
  const contactComplete =
    attendeeDetails.length === totalQty &&
    totalQty > 0 &&
    attendeeDetails.every(
      (a) => a.name.trim().length > 0 && isValidEmail(a.email) && isValidPhone(a.phone)
    );
  const questionsComplete = attendeeDetails.every((a) =>
    customFields.every((f) => {
      if (!f.required) return true;
      const val = a.customAnswers[f.id] ?? '';
      return f.type === 'checkbox' ? val === 'true' : val.trim().length > 0;
    })
  );
  const detailsComplete = contactComplete && questionsComplete;

  // Gateway events are priced, held and issued entirely by Cloud Functions
  // (functions/payments/*) — the browser never writes their tickets.

  const initiatePayment = () => {
    if (!detailsComplete || lineItems.length === 0) return;

    const oversold = lineItems.find((item) => {
      const remaining = item.tier.quantity - (item.tier.sold ?? 0);
      return item.qty > remaining;
    });
    if (oversold) {
      setCheckoutError(`Not enough tickets left for "${oversold.tier.name}". Try a smaller quantity.`);
      return;
    }

    if (isGatewayEvent) {
      handleGatewayPay();
      return;
    }
    if (total > 0) {
      // Nothing can take money for a non-gateway event on this page.
      setCheckoutError("Online payment isn't set up for this event yet. Please contact the organizer.");
      return;
    }
    handleFreeBooking();
  };

  const handleGatewayPay = async () => {
    if (!event.companyId) return;
    setStep('processing');
    setCheckoutError(null);
    try {
      const tickets = await payWithRazorpay(
        {
          companyId: event.companyId,
          eventId: event.id,
          quantities: Object.fromEntries(lineItems.map((li) => [li.tier.id, li.qty])),
          attendees: attendeeDetails.map((a) => ({
            name: a.name.trim(),
            email: a.email.trim(),
            phone: a.phone.trim(),
            customAnswers: a.customAnswers ?? {},
          })),
          accessCode,
        },
        {
          organizationName: settings.organizationName,
          eventTitle: stripHtmlTags(event.title),
          themeColor: RAZORPAY_THEME_COLOR,
          onPaid: () => setConfirmingPayment(true),
        }
      );
      setPurchasedTickets(tickets);
      setStep('success');
    } catch (err) {
      if (!(err instanceof PaymentCancelledError)) console.error('Razorpay checkout failed:', err);
      setCheckoutError(checkoutErrorMessage(err));
      setStep('details'); // let them retry
    } finally {
      setConfirmingPayment(false);
    }
  };

  // ₹0 bookings on events that don't use the gateway.
  const handleFreeBooking = async () => {
    if (!detailsComplete || lineItems.length === 0) return;

    const oversold = lineItems.find((item) => {
      const remaining = item.tier.quantity - (item.tier.sold ?? 0);
      return item.qty > remaining;
    });
    if (oversold) {
      console.error(`Not enough tickets left for "${oversold.tier.name}".`);
      return;
    }

    const companyId = event.companyId;
    if (!companyId) {
      console.error('Missing companyId on event — cannot create attendee records.');
      return;
    }

    setStep('processing');
    setCheckoutError(null);
    try {
      const eventRef = doc(db, 'companies', companyId, 'events', event.id);

      const attendeeWrites: {
        ref: ReturnType<typeof doc>;
        tierName: string;
        tierId: string;
        price: number;
        amountCollected: number;
        baseAmount: number;
        taxAmount: number;
        attendeeName: string;
        attendeeEmail: string;
        attendeePhone: string;
        customFieldAnswers: Record<string, string>;
      }[] = [];

      let slotIndex = 0;
      for (const item of lineItems) {
        const unitPrice = item.tier.price;
        let unitBase = unitPrice;
        let unitTax = 0;

        if (scheme === 'regular') {
          if (taxType === 'exclusive') {
            unitTax = unitPrice * (taxRate / 100);
          } else {
            unitBase = unitPrice / (1 + taxRate / 100);
            unitTax = unitPrice - unitBase;
          }
        }

        // unitTotal = actual amount collected per ticket (base + tax when
        // exclusive; equals unitPrice again when inclusive/exempt).
        const unitTotal = unitBase + unitTax;

        for (let i = 0; i < item.qty; i++) {
          const attendeeRef = doc(collection(db, 'companies', companyId, 'events', event.id, 'attendees'));
          const attendee = attendeeDetails[slotIndex] ?? { name: '', email: '', phone: '' };
          attendeeWrites.push({
            ref: attendeeRef,
            tierName: item.tier.name,
            tierId: item.tier.id,
            price: item.tier.price,
            amountCollected: Number(unitTotal.toFixed(2)),
            baseAmount: Number(unitBase.toFixed(2)),
            taxAmount: Number(unitTax.toFixed(2)),
            attendeeName: attendee.name,
            attendeeEmail: attendee.email,
            attendeePhone: attendee.phone,
            customFieldAnswers: attendee.customAnswers ?? {},
          });
          slotIndex += 1;
        }
      }
      const initials = getEventInitials(stripHtmlTags(event.title));
      // Same-name tickets in this order share one QR / group check-in
      const bookingGroupIds = assignBookingGroups(
        attendeeWrites.map((w) => w.attendeeName),
        attendeeWrites.map((w) => w.ref.id)
      );
      // Ties this booking's tickets together so functions/email/autoSendTicketEmail.js
      // emails them as one message (gateway orders use orderId instead).
      const bookingId = attendeeWrites[0]?.ref.id ?? null;
      let created: PurchasedTicket[] = [];

      await runTransaction(db, async (transaction) => {
        created = []; // a retried transaction must not double-append
        const eventSnap = await transaction.get(eventRef);
        if (!eventSnap.exists()) throw new Error('Event no longer exists.');

        // Re-check sold-out state against the freshly-read doc, not stale
        // client state — closes the gap for someone who had Checkout open
        // (or bookmarked/cached) from before the organizer marked the event
        // sold out. Same "best-effort, client-enforced" model the capacity
        // check below already uses, not a hard server-side guarantee — see
        // firestore.rules' own note on this.
        const freshEventData = eventSnap.data();
        if (freshEventData.manuallySoldOut) {
          throw new Error('This event is marked sold out and is no longer accepting bookings.');
        }

        const currentTiers = (eventSnap.data().tiers || []) as {
          id: string;
          name: string;
          price: number;
          quantity: number;
          sold: number;
        }[];

        const updatedTiers = currentTiers.map((tier) => {
          const purchased = lineItems.find((li) => li.tier.id === tier.id)?.qty ?? 0;
          if (purchased === 0) return tier;

          const currentSold = Number.isFinite(tier.sold) ? tier.sold : 0; // heal bad/NaN data
          const remaining = tier.quantity - currentSold;
          if (purchased > remaining) {
            throw new Error(`Not enough tickets left for "${tier.name}".`);
          }
          return { ...tier, sold: currentSold + purchased };
        });

        const { numbers: ticketNumbers, ticketSeq } = nextTicketNumbers(eventSnap.data(), attendeeWrites.length);

        // Atomically enforce + consume the access code inside the same
        // transaction that sells the tickets, so two simultaneous checkouts
        // sharing one code can't both slip through. A code is single-use —
        // once it's bought tickets once, it's dead for any further purchase.
        let updatedAccessCodes: AccessCodeEntry[] | undefined;
        if (accessCode) {
          const currentAccessCodes = (eventSnap.data().accessCodes || []) as AccessCodeEntry[];
          const cleaned = accessCode.trim().toUpperCase();
          const entryIndex = currentAccessCodes.findIndex((e) => e.code.trim().toUpperCase() === cleaned);
          if (entryIndex !== -1) {
            const entry = currentAccessCodes[entryIndex];
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

        transaction.update(eventRef, {
          tiers: updatedTiers,
          ticketSeq,
          ...(updatedAccessCodes ? { accessCodes: updatedAccessCodes } : {}),
        });

        attendeeWrites.forEach(
          (
            {
              ref,
              tierName,
              tierId,
              price,
              amountCollected,
              baseAmount,
              taxAmount,
              attendeeName,
              attendeeEmail,
              attendeePhone,
              customFieldAnswers,
            },
            index
          ) => {
            const ticketId = formatTicketId(initials, ticketNumbers[index]);

            transaction.set(ref, {
              name: attendeeName,
              email: attendeeEmail,
              phone: attendeePhone,
              tierName,
              customFieldAnswers,
              ticketTierId: tierId,
              amountPaid: amountCollected,
              tierPrice: price,
              baseAmount,
              taxAmount,
              taxRate,
              taxType: scheme === 'regular' ? (taxType === 'exclusive' ? 'Exclusive' : 'Inclusive') : scheme,
              ticketId,
              status: 'valid',
              checkedInAt: null,
              createdAt: serverTimestamp(),
              purchasedAt: serverTimestamp(),
              paymentMode: 'Free',
              paymentMethod: 'gateway', // distinguishes from manual_qr / walk-in flows
              accessCode: accessCode || null,
              bookingGroupId: bookingGroupIds[index],
              bookingId,
            });

            created.push({
              ticketId,
              tierName,
              attendeeName,
              accessCode,
              attendeeEmail,
              attendeePhone,
              amountPaid: amountCollected,
              paymentMode: 'Free',
              purchasedAt: Date.now(), // approx — serverTimestamp() nahi resolve hua client pe abhi
              status: 'valid',
              bookingGroupId: bookingGroupIds[index],
            });
          }
        );
      });

      setPurchasedTickets(created);
      setStep('success');
    } catch (err) {
      console.error('Payment/ticket creation failed:', err);
      const code = (err as Error)?.message;
      setCheckoutError(
        code === 'CODE_ALREADY_USED'
          ? 'This access code has already been used to book tickets and can\'t be used again.'
          : code === 'CODE_LIMIT_REACHED'
            ? 'This access code allows fewer tickets than you selected. Try a smaller quantity.'
            : 'Something went wrong while booking your tickets. Please try again.'
      );
      setStep('details'); // let them retry
    }
  };

  if (step === 'success') {
    return (
      <div className="brand-theme flex min-h-screen w-full flex-col bg-[var(--brand-cream)]">
        <BrandNavHeader organizationName={settings.organizationName} variant="minimal" rightSlot={<span />} />
        <TicketConfirmation
        eventTitle={event.title}
        eventCategory={event.category}
        eventDate={event.date}
        eventTime={event.time}
        eventVenue={event.venue}
        tickets={purchasedTickets}
        onDone={() =>
          navigate(getSubdomain() ? '/' : resolvedCompanyId ? `/public/${resolvedCompanyId}` : '/')
        }
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
        emailedTo={Array.from(
          new Set(purchasedTickets.map((t) => t.attendeeEmail?.trim().toLowerCase()).filter((e): e is string => !!e))
        )}
        />
      </div>
    );
  }

  const payCtaLabel =
    step === 'processing'
      ? 'Processing…'
      : total === 0
        ? 'Confirm registration'
        : `Pay ${formatRupees(grandTotal, { zeroAsFree: false })}`;
  const payCtaDisabled = !detailsComplete || lineItems.length === 0 || step === 'processing';
  const totalLabel = formatRupees(grandTotal);
  const showMobileBar = lineItems.length > 0;

  const steps = [
    { id: 'checkout-details', label: 'Details', complete: contactComplete },
    ...(customFields.length > 0 ? [{ id: 'checkout-questions', label: 'Questions', complete: questionsComplete }] : []),
    // Paying is the final action itself, so this step is never "done" here.
    { id: 'checkout-payment', label: 'Payment', complete: false },
  ];

  const ticketRows = lineItemsWithTax.map(({ tier, qty, itemTotalAmount }) => ({
    id: tier.id,
    label: `${qty} × ${tier.name}`,
    amountLabel: formatRupees(tier.price === 0 ? 0 : itemTotalAmount),
  }));
  const taxRow =
    totalTaxAmount > 0
      ? { id: 'tax', label: taxType === 'inclusive' ? 'Tax (included in price)' : 'Tax', amountLabel: formatRupees(totalTaxAmount, { zeroAsFree: false }), muted: true }
      : null;
  const roundOffRow =
    roundOffAmt !== 0
      ? { id: 'round-off', label: 'Round off', amountLabel: `${roundOffAmt < 0 ? '−' : ''}${formatRupees(Math.abs(roundOffAmt), { zeroAsFree: false })}`, muted: true }
      : null;

  const summaryLineItems = [...ticketRows, ...(taxRow ? [taxRow] : []), ...(roundOffRow ? [roundOffRow] : [])];

  const orderSummary = (
    <TicketOrderSummary
      eventTitle={stripHtmlTags(event.title)}
      dateLabel={`${formatShortDateRange(event.date, event.endDate)}, ${formatTime(event.time)}`}
      venueLabel={event.isOnline ? 'Online' : event.venue}
      lineItems={summaryLineItems}
      totalTitle="Total"
      totalLabel={totalLabel}
      ctaLabel={payCtaLabel}
      onCta={initiatePayment}
      ctaDisabled={payCtaDisabled}
    />
  );
  const orderItemsLabel = lineItems.length === 1 ? `${lineItems[0].qty} × ${lineItems[0].tier.name}` : `${totalQty} tickets`;

  return (
    <div className={`brand-theme flex min-h-screen w-full flex-col bg-[var(--brand-cream)] text-[var(--brand-black)] ${showMobileBar ? 'pb-24 lg:pb-0' : ''}`}>
      <BrandNavHeader organizationName={settings.organizationName} variant="minimal" />

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="grow overflow-y-auto px-4 py-6 pb-10 sm:px-8">
        <div className="mx-auto w-full max-w-[1440px] lg:px-12">
          {/* Title row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <BrandButton variant="link" onClick={() => navigate(-1)} className="mb-3 !text-[var(--brand-black)]">
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

          {lineItems.length === 0 && (
            <div className="mt-6 rounded-xl border-[1.5px] border-dashed border-[var(--brand-line-strong)] bg-[var(--brand-surface)] p-4 text-center text-[15px] text-[var(--brand-muted)]">
              No tickets selected. Go back to the event and pick a ticket first.
            </div>
          )}

          {lineItems.length > 0 && (
            <MobileOrderSummary className="mt-6" itemsLabel={orderItemsLabel} totalLabel={totalLabel}>
              {orderSummary}
            </MobileOrderSummary>
          )}

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10">
            {/* ── Left: form sections ──────────────────────────────────── */}
            <div className="flex min-w-0 flex-col gap-8">
              {/* Your details */}
              <section id="checkout-details" className="scroll-mt-6">
                <SectionLabel className="mb-4">Your details</SectionLabel>
                <div className={`${brandPanelClass} flex flex-col gap-5`}>
                  {totalQty > 1 && (
                    <BrandCheckbox checked={sameForAll} onChange={handleToggleSameForAll}>
                      Use the same details for all {totalQty} tickets
                    </BrandCheckbox>
                  )}

                  <div className="flex flex-col gap-6">
                    {attendeeDetails.map((entry, index) => {
                      if (sameForAll && index > 0) return null;
                      const phoneInvalid = entry.phone.length > 0 && !isValidPhone(entry.phone);
                      const emailInvalid = entry.email.length > 0 && !isValidEmail(entry.email);
                      return (
                        <div key={index} className="flex flex-col gap-4">
                          {totalQty > 1 && !sameForAll && (
                            <p className="text-[15px] font-semibold text-[var(--brand-black)]">
                              Ticket {index + 1}, {ticketSlots[index]?.tierName}
                            </p>
                          )}
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <label htmlFor={`attendee-${index}-name`} className={brandLabelClass}>Full name</label>
                              <input
                                id={`attendee-${index}-name`}
                                value={entry.name}
                                onChange={(e) => updateAttendee(index, 'name', e.target.value)}
                                placeholder="As on your ID"
                                autoComplete="name"
                                spellCheck={false}
                                className={`${brandInputClass()} ${brandFieldHeight}`}
                              />
                            </div>
                            <div>
                              <label htmlFor={`attendee-${index}-phone`} className={brandLabelClass}>Phone</label>
                              <div className="flex">
                                <span className="inline-flex shrink-0 items-center rounded-l-lg border border-r-0 border-[var(--brand-line-strong)] bg-[var(--brand-cream)] px-3 text-[15px] font-semibold text-[var(--brand-muted)]">
                                  +91
                                </span>
                                <input
                                  id={`attendee-${index}-phone`}
                                  type="tel"
                                  inputMode="numeric"
                                  value={entry.phone}
                                  onChange={(e) => updateAttendee(index, 'phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                                  maxLength={10}
                                  placeholder="10-digit mobile number"
                                  autoComplete="tel-national"
                                  aria-invalid={phoneInvalid || undefined}
                                  className={`${brandInputClass(phoneInvalid)} ${brandFieldHeight} rounded-l-none`}
                                />
                              </div>
                              {phoneInvalid && (
                                <p className={brandErrorClass}>
                                  <AlertCircle size={14} aria-hidden="true" />
                                  {entry.phone.length < 10
                                    ? 'Enter a 10-digit mobile number.'
                                    : 'Mobile numbers start with 6, 7, 8 or 9.'}
                                </p>
                              )}
                            </div>
                            <div>
                              <label htmlFor={`attendee-${index}-email`} className={brandLabelClass}>Email</label>
                              <input
                                id={`attendee-${index}-email`}
                                type="email"
                                value={entry.email}
                                onChange={(e) => updateAttendee(index, 'email', e.target.value)}
                                placeholder="you@example.com"
                                autoComplete="email"
                                spellCheck={false}
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

                          {!sameForAll && index < attendeeDetails.length - 1 && <hr className="border-[var(--brand-line)]" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* A few questions */}
              {customFields.length > 0 && (
                <section id="checkout-questions" className="scroll-mt-6">
                  <SectionLabel className="mb-4">A few questions</SectionLabel>
                  <div className={`${brandPanelClass} flex flex-col gap-6`}>
                    {attendeeDetails.map((entry, index) => {
                      if (sameForAll && index > 0) return null;
                      return (
                        <div key={index} className="flex flex-col gap-4">
                          {totalQty > 1 && !sameForAll && (
                            <p className="text-[15px] font-semibold text-[var(--brand-black)]">
                              Ticket {index + 1}, {ticketSlots[index]?.tierName}
                            </p>
                          )}
                          {customFields.map((field) => {
                            const value = entry.customAnswers[field.id] ?? '';
                            const fieldId = `attendee-${index}-q-${field.id}`;

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
                                    onChange={(e) => updateCustomAnswer(index, field.id, e.target.value)}
                                    className={`${brandInputClass()} py-3`}
                                  />
                                )}

                                {field.type === 'select' && (
                                  <select
                                    id={fieldId}
                                    value={value}
                                    onChange={(e) => updateCustomAnswer(index, field.id, e.target.value)}
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
                                    onChange={(checked) => updateCustomAnswer(index, field.id, checked ? 'true' : 'false')}
                                  >
                                    {field.label}{field.required ? ' *' : ''}
                                  </BrandCheckbox>
                                )}

                                {field.type === 'text' && (
                                  <input
                                    id={fieldId}
                                    type="text"
                                    value={value}
                                    onChange={(e) => updateCustomAnswer(index, field.id, e.target.value)}
                                    className={`${brandInputClass()} ${brandFieldHeight}`}
                                  />
                                )}
                              </div>
                            );
                          })}
                          {!sameForAll && index < attendeeDetails.length - 1 && <hr className="border-[var(--brand-line)]" />}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Payment — Razorpay's own window handles method choice */}
              <section id="checkout-payment" className="scroll-mt-6">
                <SectionLabel className="mb-4">Payment</SectionLabel>
                <div className={`${brandPanelClass} flex items-start gap-3`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-teal-soft)] text-[var(--brand-teal)]">
                    <ShieldCheck size={20} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    {total === 0 ? (
                      <>
                        <span className="block text-[15px] font-semibold leading-[22px] text-[var(--brand-black)]">No payment needed</span>
                        <span className="block text-[13px] leading-[18px] text-[var(--brand-muted)]">Confirm to get your tickets right away.</span>
                      </>
                    ) : (
                      <>
                        <span className="block text-[15px] font-semibold leading-[22px] text-[var(--brand-black)]">Pay securely online</span>
                        <span className="block text-[13px] leading-[18px] text-[var(--brand-muted)]">
                          UPI, cards, net banking or wallets. You choose how to pay in the next step. Your tickets are issued as soon as the payment goes through.
                        </span>
                      </>
                    )}
                  </span>
                </div>
              </section>

              {checkoutError && (
                <p className="flex items-start gap-2 rounded-lg border border-[var(--brand-danger)] bg-[var(--brand-surface)] px-4 py-3 text-[15px] font-medium text-[var(--brand-danger)]">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                  {checkoutError}
                </p>
              )}
            </div>

            {/* ── Right: sticky order summary ─────────────────────────── */}
            <div className="hidden lg:sticky lg:top-6 lg:block lg:self-start">
              {orderSummary}
            </div>
          </div>
        </div>
      </main>

      {/* ── Floating total + pay bar — mobile only ───────────────────── */}
      {showMobileBar && (
        <MobileCheckoutBar
          countLabel={`${totalQty} ticket${totalQty === 1 ? '' : 's'}`}
          totalLabel={totalLabel}
          ctaLabel={payCtaLabel}
          onCta={initiatePayment}
          ctaDisabled={payCtaDisabled}
        />
      )}

      {/* ── Paid → issuing tickets smoke screen ─────────────────────── */}
      <PaymentProcessingOverlay open={confirmingPayment} eventTitle={stripHtmlTags(event.title)} />
    </div>
  );
};

export default CheckoutPage;
