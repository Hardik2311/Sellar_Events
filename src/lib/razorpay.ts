import { httpsCallable } from 'firebase/functions';
import { paymentFunctions } from './firebase';

// Browser side of the gateway checkout (the platform's Razorpay account).
// Prices, platform fee, seat holds and ticket issuing all happen in Cloud
// Functions (functions/payments/*); this file only opens the payment window
// and relays its result back to the server.

const CHECKOUT_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

// Razorpay window closes itself after this long. Kept shorter than the
// 15-minute seat hold in createRazorpayOrder.js so a payment can't start
// after the seats have been released.
const MODAL_TIMEOUT_SECONDS = 10 * 60;

export interface PurchasedTicketResult {
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

export interface CreateOrderInput {
  companyId: string;
  eventId: string;
  quantities: Record<string, number>;
  attendees: { name: string; email: string; phone: string; customAnswers: Record<string, string> }[];
  accessCode?: string;
}

type CreateOrderResult =
  | { free: true; orderId: string; tickets: PurchasedTicketResult[] }
  | {
      free: false;
      orderId: string;
      razorpayOrderId: string;
      keyId: string;
      amount: number;
      currency: string;
      total: number;
    };

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, cb: (resp: { error?: { description?: string } }) => void) => void;
    };
  }
}

/** Thrown when the buyer closes the Razorpay window without paying. */
export class PaymentCancelledError extends Error {
  constructor() {
    super('PAYMENT_CANCELLED');
  }
}

let scriptPromise: Promise<void> | null = null;

export const loadRazorpayScript = (): Promise<void> => {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null; // allow a retry on the next click
      reject(new Error('RAZORPAY_SCRIPT_FAILED'));
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
};

const createRazorpayOrder = httpsCallable<CreateOrderInput, CreateOrderResult>(
  paymentFunctions,
  'createRazorpayOrder'
);
const verifyRazorpayPayment = httpsCallable<
  RazorpaySuccess & { companyId: string; eventId: string; orderId: string },
  { tickets: PurchasedTicketResult[] }
>(paymentFunctions, 'verifyRazorpayPayment');

/**
 * Opens Razorpay's payment window for an order the server already created.
 * Resolves with Razorpay's signed result; rejects with PaymentCancelledError
 * when the buyer closes the window.
 */
const openRazorpayWindow = (options: Record<string, unknown>): Promise<RazorpaySuccess> =>
  new Promise<RazorpaySuccess>((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error('RAZORPAY_SCRIPT_FAILED'));
      return;
    }
    const rzp = new window.Razorpay({
      timeout: MODAL_TIMEOUT_SECONDS,
      retry: { enabled: true },
      ...options,
      handler: (resp: RazorpaySuccess) => resolve(resp),
      modal: {
        ondismiss: () => reject(new PaymentCancelledError()),
        confirm_close: true,
      },
    });
    // Failed attempts keep the window open so the buyer can retry another
    // method; we only give up when they dismiss it (ondismiss above).
    rzp.on('payment.failed', (resp) => {
      console.warn('Razorpay payment attempt failed:', resp.error?.description);
    });
    rzp.open();
  });

// ── Event credits (Account → Recharge), paid to the platform ────────────────
const createCreditOrder = httpsCallable<
  { companyId: string; credits: number },
  { purchaseId: string; razorpayOrderId: string; keyId: string; amount: number; currency: string }
>(paymentFunctions, 'createCreditOrder');
const verifyCreditPayment = httpsCallable<RazorpaySuccess & { purchaseId: string }, { credits: number }>(
  paymentFunctions,
  'verifyCreditPayment'
);

/**
 * Buy an event-credit plan online. The price is set on the server
 * (functions/payments/creditPurchases.js); credits are added only after the
 * payment is verified. Resolves with the number of credits added.
 */
export async function buyEventCredits(
  companyId: string,
  credits: number,
  prefill: { name?: string; email?: string; contact?: string },
  themeColor?: string
): Promise<number> {
  const [{ data: order }] = await Promise.all([createCreditOrder({ companyId, credits }), loadRazorpayScript()]);
  const success = await openRazorpayWindow({
    key: order.keyId,
    order_id: order.razorpayOrderId,
    amount: order.amount,
    currency: order.currency,
    name: 'Outsold',
    description: `${credits} event credit${credits === 1 ? '' : 's'}`,
    prefill,
    notes: { type: 'credits', companyId, purchaseId: order.purchaseId },
    theme: themeColor ? { color: themeColor } : undefined,
  });
  const { data } = await verifyCreditPayment({ ...success, purchaseId: order.purchaseId });
  return data.credits;
}

interface CheckoutDisplay {
  organizationName: string;
  eventTitle: string;
  themeColor?: string;
  /** Called once Razorpay reports success, before the server issues tickets. */
  onPaid?: () => void;
}

/**
 * Full gateway checkout: create order (server) → Razorpay window → verify
 * (server). Resolves with the issued tickets. Rejects with
 * PaymentCancelledError if the buyer closes the window, or with the server's
 * error code (see checkoutErrorMessage) otherwise.
 */
export async function payWithRazorpay(
  input: CreateOrderInput,
  display: CheckoutDisplay
): Promise<PurchasedTicketResult[]> {
  // Load the script in parallel with creating the order.
  const [{ data: order }] = await Promise.all([createRazorpayOrder(input), loadRazorpayScript()]);
  if (order.free) return order.tickets;

  const lead = input.attendees[0];
  const success = await openRazorpayWindow({
    key: order.keyId,
    order_id: order.razorpayOrderId,
    amount: order.amount,
    currency: order.currency,
    name: display.organizationName || display.eventTitle,
    description: display.eventTitle,
    prefill: lead ? { name: lead.name, email: lead.email, contact: `+91${lead.phone}` } : undefined,
    notes: { companyId: input.companyId, eventId: input.eventId, orderId: order.orderId },
    theme: display.themeColor ? { color: display.themeColor } : undefined,
  });
  display.onPaid?.();

  const { data } = await verifyRazorpayPayment({
    ...success,
    companyId: input.companyId,
    eventId: input.eventId,
    orderId: order.orderId,
  });
  return data.tickets;
}

/** Maps server error codes from functions/payments/* to buyer-facing copy. */
export const checkoutErrorMessage = (err: unknown): string => {
  const message = (err as { message?: string })?.message ?? '';
  switch (message) {
    case 'PAYMENT_CANCELLED':
      return 'Payment was cancelled. Your tickets are not booked yet. You can try again.';
    case 'SOLD_OUT':
    case 'TIER_UNAVAILABLE':
      return 'Sorry, there are not enough tickets left for your selection. Try a smaller quantity.';
    case 'SOLD_OUT_REFUNDED':
      return 'Tickets sold out while your payment was processing. Your payment will be refunded automatically.';
    case 'CODE_ALREADY_USED':
      return 'This access code has already been used to book tickets and can\'t be used again.';
    case 'CODE_LIMIT_REACHED':
      return 'This access code allows fewer tickets than you selected. Try a smaller quantity.';
    case 'CODE_EXPIRED':
      return 'This access code has expired. Ask the organizer for a new one.';
    case 'TOO_MANY_TICKETS':
      return 'That is more tickets than one order allows. Try a smaller quantity.';
    case 'ATTENDEE_DETAILS_INCOMPLETE':
      return 'Some ticket details are missing or invalid. Check the name, email and phone for each ticket.';
    case 'GATEWAY_NOT_CONFIGURED':
    case 'GATEWAY_NOT_ENABLED':
    case 'PAYOUT_ACCOUNT_MISSING':
      return 'Online payment isn\'t set up for this event yet. Please contact the organizer.';
    case 'EVENT_NOT_AVAILABLE':
    case 'EVENT_NOT_FOUND':
      return 'This event is no longer taking bookings.';
    case 'RAZORPAY_SCRIPT_FAILED':
      return 'Couldn\'t load the payment window. Check your connection and try again.';
    case 'PAYMENT_NOT_COMPLETED':
    case 'SIGNATURE_MISMATCH':
    case 'PAYMENT_ORDER_MISMATCH':
    case 'PAYMENT_AMOUNT_MISMATCH':
      return 'We couldn\'t confirm your payment. If money was debited, your tickets will be issued shortly or the amount refunded. Contact the organizer with your payment ID if not.';
    default:
      return 'Something went wrong while booking your tickets. Please try again.';
  }
};

