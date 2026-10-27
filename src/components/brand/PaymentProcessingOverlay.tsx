import React, { useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';
import TicketDivider from './TicketDivider';
import PoweredByOutsold from './PoweredByOutsold';

interface PaymentProcessingOverlayProps {
  open: boolean;
  eventTitle?: string;
  /** Small caps line in the ink header. */
  label?: string;
  /** Finished step (ticked). */
  doneStep?: string;
  /** Step in progress (spinner). */
  pendingStep?: string;
}

// Full-screen "smoke screen" shown while a booking is being finalised: after
// the buyer pays in Razorpay's window (Checkout) or submits their UPI
// screenshot (ManualQRPaymentCard), until their tickets appear. Same
// ticket-stub look as the order summary.
const PaymentProcessingOverlay: React.FC<PaymentProcessingOverlayProps> = ({
  open,
  eventTitle,
  label = 'Payment received',
  doneStep = 'Payment successful',
  pendingStep = 'Issuing your tickets…',
}) => {
  // Leaving mid-way can abort the booking (manual QR) or hide the issued
  // tickets (gateway — the webhook still issues them), so warn first.
  useEffect(() => {
    if (!open) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="brand-theme fixed inset-0 z-[60] flex items-center justify-center bg-[var(--brand-cream)]/85 px-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-sm">
        <div className="overflow-hidden rounded-xl border border-[var(--brand-line)] bg-[var(--brand-surface)] shadow-[var(--brand-shadow-raise)]">
          <div className="bg-[var(--brand-black)] px-5 py-5 text-[var(--brand-cream)]">
            <p className="brand-label text-[#c9c4b8]">{label}</p>
            <h2 className="brand-display mt-1.5 text-[30px] leading-[1.05]">
              Confirming <span className="text-[var(--brand-teal-light)]">your spot.</span>
            </h2>
            {eventTitle && (
              <p className="mt-1.5 line-clamp-1 text-[13px] leading-[18px] text-[#c9c4b8]">{eventTitle}</p>
            )}
          </div>

          <div className="relative h-6 bg-[var(--brand-surface)]">
            <TicketDivider notchColor="var(--brand-cream)" className="absolute inset-x-0 top-1/2" />
          </div>

          <ul className="flex flex-col gap-3 px-5 pb-5 text-[15px] leading-[22px] text-[var(--brand-black)]">
            <li className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand-teal)] text-[var(--brand-cream)]">
                <Check size={14} strokeWidth={3} aria-hidden="true" />
              </span>
              {doneStep}
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand-teal-soft)] text-[var(--brand-teal)]">
                <Loader2 size={14} strokeWidth={3} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              </span>
              {pendingStep}
            </li>
          </ul>

          <div className="bg-[var(--brand-discover-bg)] px-5 py-3 text-[13px] leading-[18px] text-[var(--brand-black)]">
            This takes a few seconds. Please don&apos;t close or refresh this page.
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <PoweredByOutsold size="sm" />
        </div>
      </div>
    </div>
  );
};

export default PaymentProcessingOverlay;
