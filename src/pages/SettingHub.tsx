import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarCog, Landmark, Settings2 } from 'lucide-react';
//import ThemeToggle from '../components/ui/ThemeToggle';
import { ROUTES } from '../constants/routes.constants';

const SettingsHub: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-16">
            <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-4 py-3 shadow-xs">
                <button
                    onClick={() => navigate(`/${ROUTES.EVENTS}/${ROUTES.EVENTS_ACCOUNT}`.replace('//', '/'))}
                    className="p-2.5 rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
                    title="Back"
                >
                    <ArrowLeft size={18} />
                </button>
                <div className="flex-1 text-center flex flex-col items-center justify-center">
                    <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">Settings</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Choose what you want to configure</p>
                </div>
                {/* <ThemeToggle /> */}
            </header>

            <main className="grow overflow-y-auto p-4">
                <div className="mx-auto max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Link
                        to={`/${ROUTES.EVENTS}/${ROUTES.EVENTS_SETTINGS_EVENT}`.replace('//', '/')}
                        className="flex items-start gap-3 bg-white dark:bg-[#1E293B] p-4 rounded-sm shadow-sm border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:border-[#007A78]/50 dark:hover:border-[#2DD4BF]/50 transition-all"
                    >
                        <div className="p-2.5 rounded-sm bg-[#007A78]/10 text-[#007A78] dark:bg-[#2DD4BF]/15 dark:text-[#2DD4BF] shrink-0">
                            <CalendarCog className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm font-bold">Event Settings</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                RSVP registration and which Create Event fields are mandatory
                            </p>
                        </div>
                    </Link>

                    <Link
                        to={`/${ROUTES.EVENTS}/${ROUTES.EVENTS_SETTINGS_COMPANY}`.replace('//', '/')}
                        className="flex items-start gap-3 bg-white dark:bg-[#1E293B] p-4 rounded-sm shadow-sm border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:border-[#007A78]/50 dark:hover:border-[#2DD4BF]/50 transition-all"
                    >
                        <div className="p-2.5 rounded-sm bg-[#007A78]/10 text-[#007A78] dark:bg-[#2DD4BF]/15 dark:text-[#2DD4BF] shrink-0">
                            <Landmark className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm font-bold">Company Settings</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">GST scheme, tax rate, and rounding</p>
                        </div>
                    </Link>

                    <Link
                        to={`/${ROUTES.EVENTS}/${ROUTES.EVENTS_SETTINGS_APP}`.replace('//', '/')}
                        className="flex items-start gap-3 bg-white dark:bg-[#1E293B] p-4 rounded-sm shadow-sm border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:border-[#007A78]/50 dark:hover:border-[#2DD4BF]/50 transition-all"
                    >
                        <div className="p-2.5 rounded-sm bg-[#007A78]/10 text-[#007A78] dark:bg-[#2DD4BF]/15 dark:text-[#2DD4BF] shrink-0">
                            <Settings2 className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm font-bold">App Settings</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Theme and app-wide preferences</p>
                        </div>
                    </Link>
                </div>
            </main>
        </div>
    );
};

export default SettingsHub;