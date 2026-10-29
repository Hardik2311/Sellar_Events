import React from 'react';
import FormField from './ui/FormField';
import type { TicketTaxTypeOption } from '../types/event.types';
import { GST_EXEMPTION_THRESHOLD, GST_RATE } from '../data/events';

interface Props {
  id: string;
  value: TicketTaxTypeOption | null;
  onChange: (taxType: TicketTaxTypeOption) => void;
  showError?: boolean;
}

const optionClass = (active: boolean) =>
  `flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors ${active
    ? 'bg-orange-50 dark:bg-[#2DD4BF]/10 text-[#007A78] dark:text-[#2DD4BF]'
    : 'text-gray-500 dark:text-slate-400'
  }`;

/**
 * "Ticket price & GST" toggle shared by Create Event and Edit Event.
 * GST itself isn't optional — tickets priced ₹500 and above always carry
 * GST_RATE — the organizer only picks whether their price already includes it.
 */
const TaxTypeSelector: React.FC<Props> = ({ id, value, onChange, showError }) => (
  <FormField label="Ticket price & GST *" htmlFor={id}>
    <div
      id={id}
      className={`flex rounded-sm border p-1 bg-white dark:bg-slate-800 ${showError ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-slate-700'}`}
    >
      <button type="button" onClick={() => onChange('exclusive')} className={optionClass(value === 'exclusive')}>
        Add GST on top
      </button>
      <button type="button" onClick={() => onChange('inclusive')} className={optionClass(value === 'inclusive')}>
        Price includes GST
      </button>
    </div>
    <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
      {value === 'inclusive'
        ? `Attendees pay the ticket price as listed; ${GST_RATE}% GST is taken out of it.`
        : value === 'exclusive'
          ? `${GST_RATE}% GST is added to the ticket price at checkout.`
          : 'Choose how GST is shown on your ticket price.'}{' '}
      By law, GST applies only to tickets priced ₹{GST_EXEMPTION_THRESHOLD} and above; cheaper tickets are tax-free.
    </p>
    {showError && (
      <p className="text-xs text-red-500 dark:text-red-400 mt-1">Pick how GST applies to your tickets.</p>
    )}
  </FormField>
);

export default TaxTypeSelector;
