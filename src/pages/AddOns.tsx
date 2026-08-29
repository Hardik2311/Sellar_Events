import React from 'react';
import { Link } from 'react-router-dom';
import { FiMessageCircle } from 'react-icons/fi';
import BackButton from '../components/ui/BackButton';
import { ROUTES } from '../constants/routes.constants';

const AddOns: React.FC = () => {
  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] mb-16">
      <header className="relative sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-4 py-3 shadow-xs">
        <BackButton />
        <div className="absolute left-1/2 -translate-x-1/2 text-center max-w-[65%]">
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate">Edit Profile</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">Update account, organizer & address details</p>
        </div>
        <div className="w-9" />
      </header>

      <main className="p-4 sm:p-6">
        <div className="mx-auto max-w-3xl">
          <Link
            to={`${ROUTES.EVENTS}/${ROUTES.EVENTS_WHATSAPP_INTEGRATION}`}
            className="flex items-center gap-3 bg-white dark:bg-[#1E293B] p-4 rounded-sm shadow-sm border border-slate-200 dark:border-slate-800 hover:border-[#007A78]/50 dark:hover:border-[#2DD4BF]/50 transition-all"
          >
            <div className="p-2.5 rounded-sm bg-green-500/10 text-green-600">
              <FiMessageCircle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">WhatsApp Integration</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Not connected</p>
            </div>
            <span className="text-slate-400 font-bold">→</span>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default AddOns;