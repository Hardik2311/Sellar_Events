import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Ticket, Loader2 } from 'lucide-react';
import BackButton from '../components/ui/BackButton';
import { Card, CardContent } from '../components/ui/card';
import { collection, doc, getDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { usePublicEvent } from '../hooks/usePublicEvents';
import TicketConfirmation from '../components/TicketConfirmation';
import MockPGModal from '../components/MockPGModal';

type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'free';

const PAYMENT_MODE_LABELS: Record<PaymentMethod, 'UPI' | 'Card' | 'Netbanking' | 'Free'> = {
  upi: 'UPI',
  card: 'Card',
  netbanking: 'Netbanking',
  free: 'Free',
};

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

// Turns an event title into short initials for ticket IDs.
// "Party Popper" -> "PP", "Sunburn Festival" -> "SF", "Diwali" (single word) -> "DI"
const getEventInitials = (title: string): string => {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'EV';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 3) // cap at 3 words so long titles don't produce long codes
    .map((w) => w[0])
    .join('')
    .toUpperCase();
};
const CheckoutPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { event, loading } = usePublicEvent(id);
  const quantities: Record<string, number> = (location.state as { quantities?: Record<string, number> })?.quantities ?? {};

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
  const [step, setStep] = useState<'details' | 'processing' | 'success'>('details');
  const [showPGPopup, setShowPGPopup] = useState(false);
  interface PurchasedTicket {
    ticketId: string;
    tierName: string;
    attendeeName: string;
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

  const updateAttendee = (index: number, field: keyof AttendeeFormEntry, value: string) => {
    setAttendeeDetails((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  };

  const updateCustomAnswer = (index: number, fieldId: string, value: string) => {
    setAttendeeDetails((prev) =>
      prev.map((a, i) =>
        i === index ? { ...a, customAnswers: { ...a.customAnswers, [fieldId]: value } } : a
      )
    );
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

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-100">
        <Loader2 className="animate-spin text-slate-400" size={24} />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-3 bg-gray-100 p-6 text-center">
        <Ticket size={28} className="text-gray-300" />
        <p className="text-sm font-medium text-slate-700">We couldn&rsquo;t find this order.</p>
        <button
          onClick={() => navigate('/discover')}
          className="rounded-md bg-[#007A78] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2DD4BF]"
        >
          Back to events
        </button>
      </div>
    );
  }

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

  let baseSubtotal = 0;
  let totalTaxAmount = 0;

  const subtotal = lineItems.reduce((acc, item) => {
    const qty = item.qty;
    const price = item.tier.price;

    let itemBaseAmount = 0;
    let itemTaxAmount = 0;
    let itemTotalAmount = 0;

    if (scheme === 'regular') {
      if (taxType === 'exclusive') {
        // EXCLUSIVE: tax is added on top of the ticket price
        itemBaseAmount = price * qty;
        itemTaxAmount = itemBaseAmount * (taxRate / 100);
        itemTotalAmount = itemBaseAmount + itemTaxAmount;
      } else {
        // INCLUSIVE: tax is already inside the ticket price, extract it
        itemTotalAmount = price * qty;
        itemBaseAmount = itemTotalAmount / (1 + taxRate / 100);
        itemTaxAmount = itemTotalAmount - itemBaseAmount;
      }
    } else {
      // EXEMPT / COMPOSITION: no tax
      itemBaseAmount = price * qty;
      itemTaxAmount = 0;
      itemTotalAmount = itemBaseAmount;
    }

    baseSubtotal += itemBaseAmount;
    totalTaxAmount += itemTaxAmount;
    return acc + itemTotalAmount;
  }, 0);

  const total = taxSettings?.enableRounding
    ? roundToInterval(subtotal, taxSettings.roundingInterval || 1)
    : subtotal;

  const roundOffAmt = Number((total - subtotal).toFixed(2));
  const totalQty = lineItems.reduce((s, item) => s + item.qty, 0);
  const isValidPhone = (value: string) => /^[6-9]\d{9}$/.test(value.trim());
  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const customFields = event.customFields ?? [];

  const detailsComplete =
    attendeeDetails.length === totalQty &&
    totalQty > 0 &&
    attendeeDetails.every(
      (a) =>
        a.name.trim().length > 0 &&
        isValidEmail(a.email) &&
        isValidPhone(a.phone) &&
        customFields.every((f) => {
          if (!f.required) return true;
          const val = a.customAnswers[f.id] ?? '';
          return f.type === 'checkbox' ? val === 'true' : val.trim().length > 0;
        })
    );

  const initiatePayment = () => {
    if (!detailsComplete || lineItems.length === 0) return;

    const oversold = lineItems.find((item) => {
      const remaining = item.tier.quantity - (item.tier.sold ?? 0);
      return item.qty > remaining;
    });
    if (oversold) {
      console.error(`Not enough tickets left for "${oversold.tier.name}".`);
      return;
    }

    if (total === 0) {
      handlePay();
    } else {
      setShowPGPopup(true);
    }
  };

  const handlePay = async (method: PaymentMethod = 'free') => {
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
      const initials = getEventInitials(event.title);
      const created: PurchasedTicket[] = [];

      await runTransaction(db, async (transaction) => {
        const eventSnap = await transaction.get(eventRef);
        if (!eventSnap.exists()) throw new Error('Event no longer exists.');

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

        const totalAlreadySold = currentTiers.reduce(
          (sum, tier) => sum + (Number.isFinite(tier.sold) ? tier.sold : 0),
          0
        );

        transaction.update(eventRef, { tiers: updatedTiers });

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
            const ticketNumber = totalAlreadySold + index + 1;
            const ticketId = `${initials}-${String(ticketNumber).padStart(3, '0')}`;

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
              paymentMode: PAYMENT_MODE_LABELS[method],
              paymentMethod: 'gateway', // distinguishes from manual_qr / walk-in flows
            });

            created.push({ ticketId, tierName, attendeeName });
          }
        );
      });

      setPurchasedTickets(created);
      setStep('success');
    } catch (err) {
      console.error('Payment/ticket creation failed:', err);
      setStep('details'); // let them retry
    }
  };

  if (step === 'success') {
    return (
      <TicketConfirmation
        eventTitle={event.title}
        eventDate={event.date}
        tickets={purchasedTickets}
        onDone={() => navigate('/discover')}
      />
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-100 dark:bg-slate-900">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="relative sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <BackButton />
        <div className="absolute left-1/2 -translate-x-1/2 text-center min-w-0 max-w-[65%]">
          <h1 className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">Checkout</h1>
          <p className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{event.title}</p>
        </div>
        <div className="w-9" />
      </header>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="grow overflow-y-auto p-3 pb-28">
        <div className="mx-auto flex max-w-xl flex-col gap-3">
          {lineItems.length === 0 && (
            <div className="rounded-md border border-dashed border-gray-300 bg-white p-4 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
              No tickets selected. Go back and pick a ticket tier first.
            </div>
          )}

          {/* Order summary */}
          <Card className="shadow-sm border-gray-200">
            <CardContent className="pt-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-slate-100">Order summary</h2>
              <div className="flex flex-col divide-y divide-gray-100 dark:divide-slate-700">
                {lineItems.map(({ tier, qty }) => (
                  <div key={tier.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-slate-600 dark:text-slate-300">
                      {tier.name} <span className="text-slate-400 dark:text-slate-500">× {qty}</span>
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {tier.price === 0 ? 'Free' : `\u20B9${(tier.price * qty).toLocaleString('en-IN')}`}
                    </span>
                  </div>
                ))}
              </div>
              {totalTaxAmount > 0 && (
                <div className="flex items-center justify-between py-1 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Tax</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{`\u20B9${totalTaxAmount.toFixed(2)}`}</span>
                </div>
              )}
              {roundOffAmt !== 0 && (
                <div className="flex items-center justify-between py-1 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Round off</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{`\u20B9${roundOffAmt.toFixed(2)}`}</span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-sm font-semibold dark:border-slate-700">
                <span className="text-slate-800 dark:text-slate-100">Total</span>
                <span className="text-[#007A78]">{total === 0 ? 'Free' : `\u20B9${total.toLocaleString('en-IN')}`}</span>
              </div>
            </CardContent>
          </Card>

          {/* Attendee details — ek form per ticket */}
          <Card className="shadow-sm border-gray-200">
            <CardContent className="pt-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-slate-100">
                Attendee details{totalQty > 1 ? ` · ${totalQty} tickets` : ''}
              </h2>
              <div className="flex flex-col gap-5">
                {attendeeDetails.map((entry, index) => (
                  <div key={index} className="flex flex-col gap-3">
                    {totalQty > 1 && (
                      <p className="text-xs font-bold text-[#007A78]">
                        Ticket {index + 1} · {ticketSlots[index]?.tierName}
                      </p>
                    )}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Full name</label>
                      <input
                        value={entry.name}
                        onChange={(e) => updateAttendee(index, 'name', e.target.value)}
                        placeholder="As it should appear on the ticket"
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#007A78] focus:ring-1 focus:ring-[#007A78] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
                      <input
                        type="email"
                        value={entry.email}
                        onChange={(e) => updateAttendee(index, 'email', e.target.value)}
                        placeholder="you@example.com"
                        className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-1 ${entry.email.length > 0 && !isValidEmail(entry.email)
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-400'
                            : 'border-gray-300 focus:border-[#2DD4BF] focus:ring-[#007A78]'
                          }`}
                      />
                      {entry.email.length > 0 && !isValidEmail(entry.email) && (
                        <p className="mt-1 text-xs font-medium text-red-500">Enter a valid email address.</p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Phone</label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={entry.phone}
                        onChange={(e) => updateAttendee(index, 'phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                        maxLength={10}
                        placeholder="10-digit mobile number"
                        className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-1 ${entry.phone.length > 0 && !isValidPhone(entry.phone)
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-400'
                            : 'border-gray-300 focus:border-[#2DD4BF] focus:ring-[#007A78]'
                          }`}
                      />
                      {entry.phone.length > 0 && !isValidPhone(entry.phone) && (
                        <p className="mt-1 text-xs font-medium text-red-500">
                          {entry.phone.length < 10
                            ? 'Enter a 10-digit mobile number.'
                            : 'Must start with 6, 7, 8, or 9.'}
                        </p>
                      )}
                    </div>

                    {customFields.map((field) => {
                      const value = entry.customAnswers[field.id] ?? '';
                      const baseClass =
                        'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#007A78]';

                      return (
                        <div key={field.id}>
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            {field.label}{field.required ? ' *' : ''}
                          </label>

                          {field.type === 'textarea' && (
                            <textarea
                              rows={3}
                              value={value}
                              onChange={(e) => updateCustomAnswer(index, field.id, e.target.value)}
                              placeholder={field.label}
                              className={baseClass}
                            />
                          )}

                          {field.type === 'select' && (
                            <select
                              value={value}
                              onChange={(e) => updateCustomAnswer(index, field.id, e.target.value)}
                              className={baseClass}
                            >
                              <option value="">Select…</option>
                              {(field.options ?? []).map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          )}

                          {field.type === 'checkbox' && (
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={value === 'true'}
                                onChange={(e) => updateCustomAnswer(index, field.id, e.target.checked ? 'true' : 'false')}
                                className="h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border-2 border-gray-300 bg-white checked:border-[#007A78] checked:bg-white bg-no-repeat bg-center [background-size:14px] checked:bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%23007A78%22%3E%3Cpath%20d%3D%22M16.7%205.3a1%201%200%200%201%200%201.4l-7%207a1%201%200%200%201-1.4%200l-3-3a1%201%200%200%201%201.4-1.4L9%2011.6l6.3-6.3a1%201%200%200%201%201.4%200z%22%2F%3E%3C%2Fsvg%3E')] focus:ring-1 focus:ring-[#007A78] focus:outline-none"
                              />
                              {field.label}
                            </label>
                          )}

                          {field.type === 'text' && (
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => updateCustomAnswer(index, field.id, e.target.value)}
                              placeholder={field.label}
                              className={baseClass}
                            />
                          )}
                        </div>
                      );
                    })}

                    {index < attendeeDetails.length - 1 && <hr className="border-gray-100 dark:border-slate-700" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* ── Sticky pay bar ───────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-3 flex justify-center z-30 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex w-full max-w-xl items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">{totalQty} ticket{totalQty === 1 ? '' : 's'}</p>
            <p className="text-base font-bold text-slate-800 dark:text-slate-100">
              {total === 0 ? 'Free' : `\u20B9${total.toLocaleString('en-IN')}`}
            </p>
          </div>
          <button
            onClick={initiatePayment}
            disabled={!detailsComplete || lineItems.length === 0 || step === 'processing'}
            className="flex-1 rounded-md bg-[#007A78] py-2.5 text-sm font-semibold text-white hover:bg-[#ea580c] disabled:opacity-40 disabled:hover:bg-[#2DD4BF] transition-colors"
          >
            {step === 'processing'
              ? 'Processing…'
              : total === 0
                ? 'Confirm registration'
                : `Pay \u20B9${total.toLocaleString('en-IN')}`}
          </button>
        </div>
      </div>

      {showPGPopup && (
        <MockPGModal
          amount={total}
          onSuccess={(method) => {
            setShowPGPopup(false);
            handlePay(method);
          }}
          onCancel={() => setShowPGPopup(false)}
        />
      )}
    </div>
  );
};

export default CheckoutPage;