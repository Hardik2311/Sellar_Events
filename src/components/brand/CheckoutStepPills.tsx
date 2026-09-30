import React, { useEffect, useState } from 'react';

interface Step {
  id: string;
  label: string;
}

interface CheckoutStepPillsProps {
  steps: Step[];
  className?: string;
}

// Scroll-spied "1 DETAILS / 2 QUESTIONS / 3 PAYMENT" pills — the active
// section (closest to the top of the viewport) lights up yellow, the rest
// stay teal. Clicking a pill scrolls its section into view.
const CheckoutStepPills: React.FC<CheckoutStepPillsProps> = ({ steps, className = '' }) => {
  const [activeId, setActiveId] = useState(steps[0]?.id);

  useEffect(() => {
    const elements = steps
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          const topMost = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
          setActiveId(topMost.target.id);
        }
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [steps]);

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {steps.map((step, i) => (
        <button
          key={step.id}
          type="button"
          onClick={() => document.getElementById(step.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className={`brand-mono rounded-sm px-2.5 py-1 text-[10px] font-bold transition-colors ${
            activeId === step.id ? 'bg-[var(--brand-yellow)] text-black' : 'bg-[var(--brand-teal)] text-white'
          }`}
        >
          {i + 1} {step.label}
        </button>
      ))}
    </div>
  );
};

export default CheckoutStepPills;
