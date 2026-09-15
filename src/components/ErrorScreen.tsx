import React from 'react';

interface ErrorScreenProps {
  heading?: string;
  message?: string;
  icon?: string;
}

// Shared by ErrorBoundary (unexpected crashes) and the catch-all 404 route —
// same simple "go home or reload" recovery for either case.
const ErrorScreen: React.FC<ErrorScreenProps> = ({
  heading = 'Something went wrong',
  message = 'Please refresh the page. If the problem continues, try again in a moment.',
  icon = '⚠️',
}) => (
  <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-slate-100 p-4 text-center dark:bg-[#0F172A]">
    <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center">
      <span className="text-2xl">{icon}</span>
    </div>
    <h2 className="text-xl font-bold text-slate-800 dark:text-white">{heading}</h2>
    <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">{message}</p>
    <div className="mt-2 flex items-center gap-3">
      {/* Plain <a> (not client-side routing) — safest way to get back to a
          known-good page when the app itself may be the thing that's broken. */}
      <a
        href="/"
        className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700"
      >
        Go home
      </a>
      <button
        onClick={() => window.location.reload()}
        className="rounded-md bg-[#007A78] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#006361] dark:bg-[#2DD4BF] dark:text-slate-900 dark:hover:bg-[#22b8a5]"
      >
        Reload
      </button>
    </div>
  </div>
);

export default ErrorScreen;
