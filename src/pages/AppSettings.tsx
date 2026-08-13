import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { ROUTES } from '../constants/routes.constants';

const AppSettings: React.FC = () => {
    const navigate = useNavigate();
    const { theme, setTheme } = useTheme();

    const themeOptions = [
        { value: 'light', label: 'Light Mode', icon: Sun },
        { value: 'dark', label: 'Dark Mode', icon: Moon },
        { value: 'system', label: 'System Mode', icon: Monitor },
    ] as const;

    return (
        <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-16">
            <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-4 py-3 shadow-xs">
                <button
                    onClick={() => navigate(`/${ROUTES.EVENTS}/${ROUTES.EVENTS_SETTINGS}`.replace('//', '/'))}
                    className="p-2.5 rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
                    title="Back"
                >
                    <ArrowLeft size={18} />
                </button>
                <div className="flex-1 text-center flex flex-col items-center justify-center">
                    <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">App Settings</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">App-wide preferences</p>
                </div>
                <div className="w-10" />
            </header>

            <main className="grow overflow-y-auto p-4">
                <div className="mx-auto max-w-3xl">
                    <div className="rounded-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-4 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Theme Preferences</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {themeOptions.map(({ value, label, icon: Icon }) => (
                                <button
                                    key={value}
                                    onClick={() => setTheme(value)}
                                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-sm text-xs font-bold transition-all border ${theme === value
                                            ? 'bg-[#007A78] text-white dark:bg-[#2DD4BF] dark:text-slate-950 border-transparent shadow-xs'
                                            : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <Icon size={14} />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AppSettings;