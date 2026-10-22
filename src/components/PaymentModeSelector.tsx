import React from 'react';
import { Link } from 'react-router-dom';
import FormField from './ui/FormField';
import type { PaymentCollectionMode } from '../types/event.types';
import { ROUTES } from '../constants/routes.constants';

interface Props {
  id: string;
  value: PaymentCollectionMode;
  onChange: (mode: PaymentCollectionMode) => void;
  allowManualQR: boolean;
  gatewayEnabled: boolean; // platform switched online payments on (Super Admin → Payments)
  payoutReady: boolean; // organizer added a payout bank account
  feeLabel: string; // e.g. "2% + ₹5 per ticket + 18% GST"
}

const optionClass = (active: boolean, disabled = false) =>
  `flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors ${disabled
    ? 'cursor-not-allowed text-gray-400 dark:text-slate-600 opacity-50'
    : active
      ? 'bg-orange-50 dark:bg-[#2DD4BF]/10 text-[#007A78] dark:text-[#2DD4BF]'
      : 'text-gray-500 dark:text-slate-400'
  }`;

const settingsLink = (
  <Link to={`${ROUTES.EVENTS}/${ROUTES.EVENTS_SETTINGS_EVENT}`} className="font-semibold underline">
    Settings → Event
  </Link>
);

/**
 * "Payment collection" toggle shared by Create Event and Edit Event.
 * Payment gateway = paid online into the platform's account, then paid out
 * to the organizer's bank account; the buyer pays the platform fee.
 */
const PaymentModeSelector: React.FC<Props> = ({ id, value, onChange, allowManualQR, gatewayEnabled, payoutReady, feeLabel }) => {
  const gatewayDisabled = !gatewayEnabled && value !== 'gateway';
  return (
    <FormField label="Payment collection" htmlFor={id}>
      <div id={id} className="flex rounded-sm border border-gray-300 dark:border-slate-700 p-1 bg-white dark:bg-slate-800">
        <button
          type="button"
          disabled={gatewayDisabled}
          title={gatewayDisabled ? 'Online payments are not available yet' : undefined}
          onClick={() => onChange('gateway')}
          className={optionClass(value === 'gateway', gatewayDisabled)}
        >
          Payment gateway
        </button>
        {/* Still shown for an existing manual-QR event after the option is switched off */}
        {(allowManualQR || value === 'manual_qr') && (
          <button
            type="button"
            onClick={() => onChange('manual_qr')}
            className={optionClass(value === 'manual_qr')}
          >
            UPI QR (manual)
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
        {value === 'manual_qr' ? (
          'Attendees scan your QR, pay directly, and upload a screenshot. They’re added as attendees immediately — verify payment manually at check-in.'
        ) : !gatewayEnabled ? (
          <span className="text-amber-700 dark:text-amber-300">
            Online payments aren&apos;t available yet. Switch to UPI QR (manual) to collect payment for now.
          </span>
        ) : !payoutReady ? (
          <span className="text-amber-700 dark:text-amber-300">
            Add your payout bank account in {settingsLink} before publishing with the payment gateway.
          </span>
        ) : (
          `Attendees pay online (UPI, cards, net banking, wallets) and tickets are issued automatically. A platform fee (${feeLabel}) is added to the attendee's total; your ticket revenue is paid out to your bank account.`
        )}
      </p>
    </FormField>
  );
};

export default PaymentModeSelector;
