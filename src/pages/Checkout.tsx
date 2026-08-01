import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Ticket, Smartphone, CreditCard, Landmark, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { collection, doc, getDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { usePublicEvent } from '../hooks/usePublicEvents';
import TicketConfirmation from '../components/TicketConfirmation';

type PaymentMethod = 'upi' | 'card' | 'netbanking';

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

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [step, setStep] = useState<'details' | 'processing' | 'success'>('details');
  const [purchasedTickets, setPurchasedTickets] = useState<{ ticketId: string; tierName: string }[]>([]);

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
    .map((t) => ({ tier: t, qty: quantities[t.id] ?? 0 }))
    .filter((item) => item.qty > 0);

  const scheme = (taxSettings?.gstScheme || 'none').toLowerCase();
  const taxType = (taxSettings?.taxType || 'inclusive').toLowerCase();
  const taxRate = taxSettings?.defaultTaxRate || 0;
  const applyExclusiveTax = scheme === 'regular' && taxType === 'exclusive';

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
  const detailsComplete = name.trim().length > 0 && email.trim().length > 0 && phone.trim().length >= 10;

  const handlePay = async () => {
    if (!detailsComplete || lineItems.length === 0) return;

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
      }[] = [];

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
          attendeeWrites.push({
            ref: attendeeRef,
            tierName: item.tier.name,
            tierId: item.tier.id,
            price: item.tier.price,               // nominal tier list price
            amountCollected: Number(unitTotal.toFixed(2)), // what the customer actually paid for this ticket
            baseAmount: Number(unitBase.toFixed(2)),
            taxAmount: Number(unitTax.toFixed(2)),
          });
        }
      }

      const initials = getEventInitials(event.title);
      const created: { ticketId: string; tierName: string }[] = [];

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

        attendeeWrites.forEach(({ ref, tierName, tierId, price, amountCollected, baseAmount, taxAmount }, index) => {
          const ticketNumber = totalAlreadySold + index + 1;
          const ticketId = `${initials}-${String(ticketNumber).padStart(3, '0')}`;

          transaction.set(ref, {
            name,
            email,
            phone,
            tierName,
            ticketTierId: tierId,
            amountPaid: amountCollected,   // dashboard's revenue totals read this — must be tax-inclusive
            tierPrice: price,              // nominal tier list price, for reference/receipts
            baseAmount,
            taxAmount,
            taxRate,
            taxType: scheme === 'regular' ? (taxType === 'exclusive' ? 'Exclusive' : 'Inclusive') : scheme,
            ticketId,
            status: 'valid',
            checkedInAt: null,
            createdAt: serverTimestamp(),
            purchasedAt: serverTimestamp(),
          });

          created.push({ ticketId, tierName });
        });
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
        attendeeName={name}
        tickets={purchasedTickets}
        onDone={() => navigate('/discover')}
      />
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-100">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-300 bg-white p-3">
        <button onClick={() => navigate(-1)} className="rounded-sm p-1.5 text-slate-600 hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-slate-800">Checkout</h1>
          <p className="line-clamp-1 text-xs text-slate-500">{event.title}</p>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="grow overflow-y-auto p-3 pb-28">
        <div className="mx-auto flex max-w-xl flex-col gap-3">
          {lineItems.length === 0 && (
            <div className="rounded-md border border-dashed border-gray-300 bg-white p-4 text-center text-sm text-slate-500">
              No tickets selected. Go back and pick a ticket tier first.
            </div>
          )}

          {/* Order summary */}
          <Card className="shadow-sm border-gray-200">
            <CardContent className="pt-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Order summary</h2>
              <div className="flex flex-col divide-y divide-gray-100">
                {lineItems.map(({ tier, qty }) => (
                  <div key={tier.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-slate-600">
                      {tier.name} <span className="text-slate-400">× {qty}</span>
                    </span>
                    <span className="font-medium text-slate-800">
                      {tier.price === 0 ? 'Free' : `\u20B9${(tier.price * qty).toLocaleString('en-IN')}`}
                    </span>
                  </div>
                ))}
              </div>
              {totalTaxAmount > 0 && (
                <div className="flex items-center justify-between py-1 text-sm">
                  <span className="text-slate-500">Tax</span>
                  <span className="font-medium text-slate-700">{`\u20B9${totalTaxAmount.toFixed(2)}`}</span>
                </div>
              )}
              {roundOffAmt !== 0 && (
                <div className="flex items-center justify-between py-1 text-sm">
                  <span className="text-slate-500">Round off</span>
                  <span className="font-medium text-slate-700">{`\u20B9${roundOffAmt.toFixed(2)}`}</span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-sm font-semibold">
                <span className="text-slate-800">Total</span>
                <span className="text-[#007A78]">{total === 0 ? 'Free' : `\u20B9${total.toLocaleString('en-IN')}`}</span>
              </div>
            </CardContent>
          </Card>

          {/* Attendee details */}
          <Card className="shadow-sm border-gray-200">
            <CardContent className="pt-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Attendee details</h2>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Full name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="As it should appear on the ticket"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#007A78] focus:ring-1 focus:ring-[#007A78]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#007A78]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#007A78]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment method */}
          <Card className="shadow-sm border-gray-200">
            <CardContent className="pt-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Payment method</h2>
              <div className="flex flex-col gap-2">
                {(
                  [
                    { id: 'upi' as const, label: 'UPI', icon: <Smartphone size={16} /> },
                    { id: 'card' as const, label: 'Credit / Debit card', icon: <CreditCard size={16} /> },
                    { id: 'netbanking' as const, label: 'Net banking', icon: <Landmark size={16} /> },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setMethod(opt.id)}
                    className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm font-medium transition-colors ${method === opt.id
                      ? 'border-[#007A78] bg-orange-50 text-[#007A78]'
                      : 'border-gray-300 text-slate-600 hover:bg-gray-50'
                      }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${method === opt.id ? 'border-[#007A78]' : 'border-gray-300'
                        }`}
                    >
                      {method === opt.id && <span className="h-2 w-2 rounded-full bg-[#007A78]" />}
                    </span>
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* ── Sticky pay bar ───────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-3 flex justify-center z-30">
        <div className="flex w-full max-w-xl items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-slate-500">{totalQty} ticket{totalQty === 1 ? '' : 's'}</p>
            <p className="text-base font-bold text-slate-800">
              {total === 0 ? 'Free' : `\u20B9${total.toLocaleString('en-IN')}`}
            </p>
          </div>
          <button
            onClick={handlePay}
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
    </div>
  );
};

export default CheckoutPage;