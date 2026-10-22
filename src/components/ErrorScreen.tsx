import React from 'react';
import { ArrowLeft, Home, RotateCw } from 'lucide-react';
import { isMerchantSubdomain } from '../lib/subdomain';

interface ErrorScreenProps {
  /** 'not-found' for the catch-all route, 'crash' for ErrorBoundary. */
  kind?: 'not-found' | 'crash';
}

const COPY = {
  'not-found': {
    code: '404',
    status: 'Not found',
    heading: 'Page not found',
    message: 'The link may be old, or the page may have moved. Check the address or head back home.',
  },
  crash: {
    code: 'Error',
    status: 'Failed to load',
    heading: 'Something went wrong',
    message: 'This page hit a problem while loading. Reloading usually fixes it.',
  },
};

// Customer pages are light only, so the error screen follows suit there even
// when an organizer viewing them has dark mode on.
const STOREFRONT_PATH = /^\/(discover|e|checkout|policies|public)(\/|$)/;

// Shared by ErrorBoundary (unexpected crashes) and the catch-all 404 route.
// Reads window.location rather than router hooks because ErrorBoundary sits
// above the router, and wears the storefront brand look as a voided ticket.
const ErrorScreen: React.FC<ErrorScreenProps> = ({ kind = 'crash' }) => {
  const copy = COPY[kind];
  const path = window.location.pathname;
  const storefront = isMerchantSubdomain() || STOREFRONT_PATH.test(path);
  const canGoBack = kind === 'not-found' && window.history.length > 1;

  const buttonBase =
    'inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-sm px-5 text-[15px] font-semibold leading-5 transition-[background-color,transform] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)] active:scale-[0.98] motion-reduce:transform-none lg:h-11';

  return (
    <main
      className={`error-screen brand-theme ${storefront ? 'error-screen--storefront' : ''} grid min-h-dvh w-full place-items-center bg-[var(--brand-cream)] px-4 py-12 text-[var(--brand-black)] md:px-8`}
    >
      <div className="grid w-full max-w-5xl items-center gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)] md:gap-16 lg:gap-24">
        <div className="order-2 flex flex-col items-start md:order-1">
          <h1 className="brand-display text-5xl leading-[0.95] md:text-6xl lg:text-7xl">{copy.heading}</h1>
          <p className="mt-5 max-w-[42ch] text-base leading-relaxed text-[var(--brand-muted)] md:text-lg">{copy.message}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {/* Plain <a> (not client-side routing): safest way back to a known-good
                page when the app itself may be the thing that's broken. */}
            <a href="/" className={`${buttonBase} error-btn-primary`}>
              <Home size={18} strokeWidth={2} aria-hidden="true" />
              Go home
            </a>
            {kind === 'crash' ? (
              <button type="button" onClick={() => window.location.reload()} className={`${buttonBase} error-btn-secondary`}>
                <RotateCw size={18} strokeWidth={2} aria-hidden="true" />
                Reload
              </button>
            ) : (
              canGoBack && (
                <button type="button" onClick={() => window.history.back()} className={`${buttonBase} error-btn-secondary`}>
                  <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
                  Go back
                </button>
              )
            )}
          </div>
        </div>

        {/* The voided ticket: code up top, a punched perforation, then an ink
            stub naming the page that failed. */}
        <div className="error-ticket order-1 mx-auto w-full max-w-[300px] md:order-2 md:max-w-none">
          <div className="overflow-hidden rounded-xl border border-[var(--brand-line)] bg-[var(--brand-surface)] shadow-[var(--brand-shadow-raise)]">
            <div className="relative px-6 pb-5 pt-6">
              <span className="brand-label text-[var(--brand-muted)]">Admit one</span>
              <p className="brand-display mt-2 text-[88px] leading-[0.9] md:text-[112px]" aria-hidden="true">
                {copy.code}
              </p>
              <span
                className="error-stamp brand-label absolute right-5 top-6 rotate-[14deg] rounded-sm border-2 px-2 py-1 text-[13px]"
                aria-hidden="true"
              >
                Void
              </span>
            </div>

            <div className="relative h-6" aria-hidden="true">
              <div className="absolute inset-x-4 top-1/2 border-t-2 border-dashed border-[var(--brand-line-strong)] opacity-60" />
              <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[var(--brand-cream)]" />
              <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[var(--brand-cream)]" />
            </div>

            <dl className="error-stub grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 px-6 py-5">
              <div className="min-w-0">
                <dt className="brand-label opacity-70">Page</dt>
                <dd className="brand-mono mt-1 truncate text-[13px] normal-case tracking-normal" title={path}>
                  {path}
                </dd>
              </div>
              <div className="text-right">
                <dt className="brand-label opacity-70">Status</dt>
                <dd className="mt-1 text-[13px] font-semibold">{copy.status}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </main>
  );
};

export default ErrorScreen;
