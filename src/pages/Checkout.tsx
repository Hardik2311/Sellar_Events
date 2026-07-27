import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Ticket, Smartphone, CreditCard, Landmark } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { MOCK_EVENTS } from '../data/mockEvents';

type PaymentMethod = 'upi' | 'card' | 'netbanking';

// TODO — backend wiring:
// Replace this with GET /events/:id, and pull the selected quantities from a
// checkout/session id created when "Get tickets" was clicked, instead of
// relying on router state (state is lost on refresh/direct link).
const CheckoutPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const event = useMemo(() => MOCK_EVENTS.find((e) => e.id === id), [id]);
  const quantities: Record<string, number> = (location.state as { quantities?: Record<string, number> })?.quantities ?? {};

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('upi');

  if (!event) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-3 bg-gray-100 p-6 text-center">
        <Ticket size={28} className="text-gray-300" />
        <p className="text-sm font-medium text-slate-700">We couldn&rsquo;t find this order.</p>
        <button
          onClick={() => navigate('/discover')}
          className="rounded-md bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]"
        >
          Back to events
        </button>
      </div>
    );
  }

  const lineItems = event.tiers
    .map((t) => ({ tier: t, qty: quantities[t.id] ?? 0 }))
    .filter((item) => item.qty > 0);

  const subtotal = lineItems.reduce((s, item) => s + item.qty * item.tier.price, 0);
  // TODO — backend wiring: any convenience/platform fee should come from the API, not be hardcoded here.
  const total = subtotal;
  const totalQty = lineItems.reduce((s, item) => s + item.qty, 0);
  const detailsComplete = name.trim().length > 0 && email.trim().length > 0 && phone.trim().length >= 10;

  // TODO — backend wiring:
  // POST /checkout/:eventId { attendee: { name, email, phone }, items: quantities, method }
  // then redirect to a payment gateway / show a success screen based on the response.
  const handlePay = () => {
    console.log('Submit payment:', { eventId: event.id, name, email, phone, method, total });
  };

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
              <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-sm font-semibold">
                <span className="text-slate-800">Total</span>
                <span className="text-[#F97316]">{total === 0 ? 'Free' : `\u20B9${total.toLocaleString('en-IN')}`}</span>
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
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]"
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
                    className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                      method === opt.id
                        ? 'border-[#F97316] bg-orange-50 text-[#F97316]'
                        : 'border-gray-300 text-slate-600 hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                        method === opt.id ? 'border-[#F97316]' : 'border-gray-300'
                      }`}
                    >
                      {method === opt.id && <span className="h-2 w-2 rounded-full bg-[#F97316]" />}
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
            disabled={!detailsComplete || lineItems.length === 0}
            className="flex-1 rounded-md bg-[#F97316] py-2.5 text-sm font-semibold text-white hover:bg-[#ea580c] disabled:opacity-40 disabled:hover:bg-[#F97316] transition-colors"
          >
            {total === 0 ? 'Confirm registration' : `Pay \u20B9${total.toLocaleString('en-IN')}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;