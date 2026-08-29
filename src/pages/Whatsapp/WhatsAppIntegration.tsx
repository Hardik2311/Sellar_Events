import React from 'react';
import { FiMessageCircle } from 'react-icons/fi';
import BackButton from '../../components/ui/BackButton';

const WhatsAppIntegration: React.FC = () => {
  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] mb-16">
      <header className="relative sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-4 py-3 shadow-xs">
        <BackButton />
        <div className="absolute left-1/2 -translate-x-1/2 text-center max-w-[65%]">
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate">WhatsApp Integration</h1>
        </div>
        <div className="w-9" />
      </header>

      <main className="p-4 sm:p-6 flex flex-col items-center text-center gap-3 mt-10">
        <div className="p-4 rounded-full bg-green-500/10 text-green-600">
          <FiMessageCircle size={32} />
        </div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Not connected yet</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
          WhatsApp Business integration is coming soon. Once connected, you'll be able to send tickets, reminders, and updates directly via WhatsApp.
        </p>
        <button
          disabled
          className="mt-2 rounded-sm bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 font-bold py-2 px-6 text-sm cursor-not-allowed"
        >
          Connect (Coming Soon)
        </button>
      </main>
    </div>
  );
};

export default WhatsAppIntegration;