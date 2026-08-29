import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Monitor, MessageCircle } from 'lucide-react';
import BackButton from '../components/ui/BackButton';
import { useTheme } from '../context/ThemeContext';
import { useCompanySettings } from '../hooks/useSettings'; // NEW
import { ROUTES } from '../constants/routes.constants';

const AppSettings: React.FC = () => {
    const navigate = useNavigate();
    const { theme, setTheme } = useTheme();
    const { settings, updateSetting } = useCompanySettings(); // NEW
    const [whatsappTemplate, setWhatsappTemplate] = useState(''); // NEW
    const [isSaved, setIsSaved] = useState(false); // NEW

    useEffect(() => {
        setWhatsappTemplate(settings.whatsappShareTemplate);
    }, [settings.whatsappShareTemplate]);

    const handleSaveTemplate = async () => {
        await updateSetting('whatsappShareTemplate', whatsappTemplate.trim());
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    const themeOptions = [
        { value: 'light', label: 'Light Mode', icon: Sun },
        { value: 'dark', label: 'Dark Mode', icon: Moon },
        { value: 'system', label: 'System Mode', icon: Monitor },
    ] as const;

    return (
        <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-16">
            <header className="relative sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-4 py-3 shadow-xs">
                <BackButton title="Back" />
                <div className="absolute left-1/2 -translate-x-1/2 text-center flex flex-col items-center justify-center max-w-[70%]">
                    <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">App Settings</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">App-wide preferences</p>
                </div>
                <div className="w-[38px]"></div>
            </header>

            <main className="grow overflow-y-auto p-4">
                <div className="mx-auto max-w-3xl space-y-4">
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

                    {/* NEW — WhatsApp share message template */}
                    <div className="rounded-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-4 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <MessageCircle size={13} /> WhatsApp Share Message
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
                            This text will be used when sharing the event link on WhatsApp.c
                        </p>
                        <textarea
                            value={whatsappTemplate}
                            onChange={(e) => setWhatsappTemplate(e.target.value)}
                            rows={3}
                            placeholder="Check out {{eventTitle}} on Sellar Events! {{link}}"
                            className="w-full rounded-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]"
                        />
                        <div className="mt-2 flex items-center gap-3">
                            <button
                                onClick={handleSaveTemplate}
                                className="rounded-sm bg-[#007A78] hover:bg-[#006361] dark:bg-[#2DD4BF] dark:text-slate-950 text-white text-xs font-bold py-2 px-4 transition-colors"
                            >
                                Save
                            </button>
                            {isSaved && <span className="text-xs font-semibold text-green-600">Saved!</span>}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AppSettings;