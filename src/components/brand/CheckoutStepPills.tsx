import React from 'react';
import { Check } from 'lucide-react';

interface Step {
  id: string;
  label: string;
  /** True once the buyer has filled in everything this step requires. */
  complete?: boolean;
}

interface CheckoutStepPillsProps {
  steps: Step[];
  className?: string;
}

// "Details / Questions / Payment" pills driven by form completion: the first
// incomplete step is the current one (ink), every step before it is done
// (teal with a tick), the rest are upcoming (outlined). Clicking a pill
// scrolls its section into view.
//
// Deliberately not scroll-spied — on a short checkout page the sections never
// scroll far enough to move a spy, so it sat on "Details" forever.
const CheckoutStepPills: React.FC<CheckoutStepPillsProps> = ({ steps, className = '' }) => {
  const firstIncomplete = steps.findIndex((s) => !s.complete);
  // Everything complete (e.g. screenshot uploaded) — all steps read as done.
  const activeIndex = firstIncomplete === -1 ? steps.length : firstIncomplete;

  return (
    <ol className={`flex flex-wrap items-center gap-2 ${className}`}>
      {steps.map((step, i) => {
        const state = i < activeIndex ? 'done' : i === activeIndex ? 'current' : 'upcoming';
        return (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => document.getElementById(step.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              aria-current={state === 'current' ? 'step' : undefined}
              className={`inline-flex h-8 items-center gap-1.5 rounded-sm border px-3.5 text-[13px] font-semibold leading-[18px] transition-colors ${
                state === 'current'
                  ? 'border-[var(--brand-black)] bg-[var(--brand-black)] text-[var(--brand-cream)]'
                  : state === 'done'
                    ? 'border-[var(--brand-teal)] bg-[var(--brand-teal-soft)] text-[var(--brand-teal)]'
                    : 'border-[var(--brand-line-strong)] bg-[var(--brand-surface)] text-[var(--brand-muted)]'
              }`}
            >
              {state === 'done' && <Check size={14} aria-hidden="true" />}
              {step.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
};

export default CheckoutStepPills;
