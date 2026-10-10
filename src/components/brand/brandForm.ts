// Shared field styles for the storefront forms (Checkout and manual QR
// payment): label above, 48px input, error text below.

export const brandLabelClass = 'mb-2 block text-[13px] font-semibold leading-[18px] text-[var(--brand-black)]';

export const brandInputClass = (invalid = false) =>
  `w-full rounded-lg border bg-[var(--brand-surface)] px-3.5 text-[15px] leading-[22px] text-[var(--brand-black)] outline-none placeholder:text-[var(--brand-muted)] [color-scheme:light] focus:ring-1 ${
    invalid
      ? 'border-[var(--brand-danger)] focus:border-[var(--brand-danger)] focus:ring-[var(--brand-danger)]'
      : 'border-[var(--brand-line-strong)] focus:border-[var(--brand-teal)] focus:ring-[var(--brand-teal)]'
  }`;

// Single-line inputs and selects get the fixed 48px height; textareas pad instead.
export const brandFieldHeight = 'h-12';

export const brandErrorClass = 'mt-2 flex items-center gap-1.5 text-[13px] font-medium leading-[18px] text-[var(--brand-danger)]';

export const brandHelpClass = 'mt-2 text-[13px] font-medium leading-[18px] text-[var(--brand-muted)]';

export const brandPanelClass = 'rounded-xl border border-[var(--brand-line)] bg-[var(--brand-surface)] p-4 lg:p-6';
