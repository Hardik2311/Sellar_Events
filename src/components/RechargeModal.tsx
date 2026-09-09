import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Zap, PhoneCall, ArrowLeft, Check } from 'lucide-react';
import BackButton from '../components/ui/BackButton';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { useEventCredits } from '../hooks/useEventCredits';

const PLANS = [
  {
    events: 1,
    price: 500,
    tag: null,
    features: [
      '1 event credit',
      'Full ticketing & check-in tools',
      'Real-time sales dashboard',
      'QR-based attendee check-in',
      'Manual UPI QR payment option',
    ],
  },
  {
    events: 10,
    price: 5000,
    tag: 'Most Popular',
    features: [
      '10 event credits',
      'Everything in the 1-event plan',
      'Priority email support',
      'Bulk attendee import (Excel)',
      'Sales, Expense & P&L reports',
      'Custom attendee questions',
    ],
  },
  {
    events: 20,
    price: 9999,
    tag: 'Best Value',
    features: [
      '20 event credits',
      'Everything in the 10-event plan',
      'Lowest cost per event (₹500/event)',
      'RSVP-based event support',
      'Ticket tier scheduling & dummy stock display',
      'Dedicated onboarding call',
    ],
  },
];

const RechargePage: React.FC = () => {
  const navigate = useNavigate();
  const { credits, loading } = useEventCredits();
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[number] | null>(null);
  const [showContactPopup, setShowContactPopup] = useState(false);

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-16">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-6 py-4 relative">
        <div className="absolute left-6 top-1/2 -translate-y-1/2">
          <BackButton />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Event Credits</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Recharge to create more events</p>
        </div>
      </header>

      <main className="grow overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto max-w-6xl flex flex-col gap-4">
          {/* Current balance */}
          <Card className="shadow-sm border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
            <CardContent className="pt-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-sm bg-[#007A78]/10 dark:bg-[#2DD4BF]/15 text-[#007A78] dark:text-[#2DD4BF]">
                  <Wallet size={20} />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Current balance</p>
                  <p className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {loading ? '…' : `${credits} event${credits === 1 ? '' : 's'}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plans / Contact admin */}
          <Card className="shadow-sm border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
                {selectedPlan ? 'Confirm your plan' : 'Choose a recharge plan'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedPlan ? (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {PLANS.map((plan) => (
                      <button
                        key={plan.events}
                        onClick={() => setSelectedPlan(plan)}
                        className="relative flex flex-col gap-3 rounded-md border border-slate-200 dark:border-slate-700 bg-[#F9FAFB] dark:bg-slate-800 px-4 py-4 hover:border-[#007A78] dark:hover:border-[#2DD4BF] hover:shadow-md transition-all text-left h-full"
                      >
                        {plan.tag && (
                          <span className="absolute -top-2 right-3 rounded-full bg-[#007A78] dark:bg-[#2DD4BF] px-2 py-0.5 text-[10px] font-bold text-white dark:text-slate-950">
                            {plan.tag}
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          <Zap size={16} className="text-[#007A78] dark:text-[#2DD4BF]" />
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {plan.events} Event{plan.events > 1 ? 's' : ''}
                          </span>
                        </div>
                        <span className="text-xl font-bold text-[#007A78] dark:text-[#2DD4BF]">
                          ₹{plan.price.toLocaleString('en-IN')}
                        </span>
                        <div className="h-px bg-slate-200 dark:bg-slate-700" />
                        <ul className="flex flex-col gap-1.5">
                          {plan.features.map((feature) => (
                            <li key={feature} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                              <Check size={12} className="text-[#007A78] dark:text-[#2DD4BF] shrink-0 mt-0.5" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Credits never expire. Each event you create uses 1 credit; deleting an event does not refund it.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center gap-3 py-4">
                  <div className="p-3 rounded-full bg-[#007A78]/10 dark:bg-[#2DD4BF]/15 text-[#007A78] dark:text-[#2DD4BF]">
                    <PhoneCall size={22} />
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {selectedPlan.events} Event plan — ₹{selectedPlan.price.toLocaleString('en-IN')}
                  </p>
                  <ul className="flex flex-col gap-1 items-start">
                    {selectedPlan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <Check size={12} className="text-[#007A78] dark:text-[#2DD4BF] shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1">
                    Online payment isn't available yet. Contact our team to activate this plan — we'll manually add credits to your account.
                  </p>
                  <div className="flex gap-2 w-full max-w-xs mt-1">
                    <button
                      onClick={() => setSelectedPlan(null)}
                      className="flex-1 flex items-center justify-center gap-1 rounded-sm border border-slate-300 dark:border-slate-700 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <ArrowLeft size={13} /> Back
                    </button>
                    <button
                      onClick={() => setShowContactPopup(true)}
                      className="flex-1 rounded-sm bg-[#007A78] dark:bg-[#2DD4BF] py-2 text-xs font-semibold text-white dark:text-slate-950 hover:bg-[#006361] dark:hover:bg-[#22b8a5]"
                    >
                      Contact Admin
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* ── Contact Admin Popup ─────────────────────────────────────── */}
      {showContactPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowContactPopup(false)}
        >
          <div
            className="w-full max-w-xs rounded-md bg-white dark:bg-[#1E293B] p-5 flex flex-col items-center gap-3 text-center shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 rounded-full bg-[#007A78]/10 dark:bg-[#2DD4BF]/15 text-[#007A78] dark:text-[#2DD4BF]">
              <PhoneCall size={22} />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Contact Admin
            </p>
            <a
              href="tel:9818815838"
              className="text-lg font-bold text-[#007A78] dark:text-[#2DD4BF]"
            >
              98188 15838
            </a>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Call or WhatsApp us to activate your plan.
            </p>
            <button
              onClick={() => setShowContactPopup(false)}
              className="mt-1 w-full rounded-sm border border-slate-300 dark:border-slate-700 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RechargePage;