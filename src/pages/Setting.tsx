import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import ThemeToggle from '../components/ui/ThemeToggle';
import { useCompanySettings } from '../hooks/useSettings';

const SettingToggle: React.FC<{ checked: boolean; onChange: () => void; disabled?: boolean }> = ({
  checked,
  onChange,
  disabled,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={onChange}
    className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition-colors disabled:opacity-40 ${
      checked ? 'bg-[#007A78]' : 'bg-gray-300'
    }`}
  >
    <span
      className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { settings, loading, updateSetting } = useCompanySettings();

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-16">
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-4 py-3 shadow-xs">
        <button
          onClick={() => navigate(-1)}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
          title="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 text-center flex flex-col items-center justify-center">
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">Settings</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Configure how your events work</p>
        </div>
        <ThemeToggle />
      </header>

      <main className="grow overflow-y-auto p-2">
        <div className="mx-auto max-w-3xl flex flex-col gap-3">
          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-900">Registration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">Enable RSVP registration</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Let organizers create events with an external RSVP link instead of ticket tiers.
                  </p>
                </div>
                <SettingToggle
                  checked={settings.rsvpEnabled}
                  disabled={loading}
                  onChange={() => updateSetting('rsvpEnabled', !settings.rsvpEnabled)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Future settings go here */}
        </div>
      </main>
    </div>
  );
};

export default Settings;