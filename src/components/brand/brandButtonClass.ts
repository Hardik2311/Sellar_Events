export type BrandButtonVariant = 'primary' | 'onInk' | 'secondary' | 'link';

interface BrandButtonClassOptions {
  block?: boolean;
  size?: 'md' | 'sm';
}

const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-semibold transition-[background-color,color,transform] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] motion-reduce:transform-none disabled:cursor-not-allowed disabled:active:scale-100';

const SIZES = {
  md: 'h-12 px-5 text-[15px] leading-5 lg:h-11',
  sm: 'h-10 px-4 text-sm leading-5',
};

const VARIANTS: Record<BrandButtonVariant, string> = {
  // Main action on cream / surface: Book tickets, Pay, Download.
  primary:
    'bg-[var(--brand-black)] text-[var(--brand-cream)] hover:bg-[#2b2925] focus-visible:outline-[var(--brand-teal)] disabled:bg-[var(--brand-skeleton)] disabled:text-[var(--brand-muted)]',
  // The only yellow button: sits on ink surfaces (mobile bar, ticket stub, carousel).
  onInk:
    'bg-[var(--brand-yellow)] text-[var(--brand-black)] hover:bg-[#ffd333] focus-visible:outline-[var(--brand-teal-light)] disabled:bg-white/15 disabled:text-white/50',
  secondary:
    'border border-[var(--brand-black)] bg-[var(--brand-surface)] text-[var(--brand-black)] hover:bg-[var(--brand-cream)] focus-visible:outline-[var(--brand-teal)] disabled:border-transparent disabled:bg-[var(--brand-skeleton)] disabled:text-[var(--brand-muted)]',
  link: 'text-[var(--brand-teal)] underline-offset-4 hover:underline focus-visible:outline-[var(--brand-teal)]',
};

// Class string for anything that should look like a storefront button
// (also used on <a> tags, e.g. RSVP and directions links).
export const brandButtonClass = (variant: BrandButtonVariant = 'primary', { block = false, size = 'md' }: BrandButtonClassOptions = {}) =>
  [BASE, variant === 'link' ? 'text-[15px] leading-5' : SIZES[size], VARIANTS[variant], block ? 'w-full' : ''].join(' ');
