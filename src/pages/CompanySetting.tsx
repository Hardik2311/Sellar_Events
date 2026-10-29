import React, { useState } from 'react';

import BackButton from '../components/ui/BackButton';
import { doc, setDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
//import ThemeToggle from '../components/ui/ThemeToggle';
import { useCompanySettings } from '../hooks/useSettings';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { db } from '../lib/firebase';
import EventSubdomainModal from '../components/SubDomainModal';
import { GST_EXEMPTION_THRESHOLD, GST_RATE } from '../data/events';

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
    className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition-colors disabled:opacity-40 ${checked ? 'bg-[#007A78]' : 'bg-gray-300'
      }`}
  >
    <span
      className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'
        }`}
    />
  </button>
);

const Settings: React.FC = () => {
  const { profile } = useAuth();
  const { isOwner } = usePermissions();
  const { settings, loading } = useCompanySettings();

  const [showSubdomainModal, setShowSubdomainModal] = useState(false);

  // GST isn't configured here any more: 18% on tickets ≥ ₹500 is fixed by
  // law, and inclusive/exclusive is chosen per event (see TaxTypeSelector).
  type DraftSettings = Pick<typeof settings, 'enableRounding' | 'roundingInterval'>;
  const [draft, setDraft] = useState<DraftSettings>({
    enableRounding: settings.enableRounding,
    roundingInterval: settings.roundingInterval,
  });
  const [initialized, setInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!loading && !initialized) {
      setDraft({
        enableRounding: settings.enableRounding,
        roundingInterval: settings.roundingInterval,
      });
      setInitialized(true);
    }
  }, [loading, initialized, settings]);

  const handleSaveSettings = async () => {
    if (!profile?.companyId) {
      setSaveError('Company not found. Please try again.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const settingsRef = doc(db, 'companies', profile.companyId, 'settings', 'general');
      await setDoc(settingsRef, { ...draft }, { merge: true });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setSaveError('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-16">
      <header className="relative sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-4 py-3 shadow-xs">
        <BackButton title="Back" />
        <div className="absolute left-1/2 -translate-x-1/2 text-center flex flex-col items-center justify-center max-w-[70%]">
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">Company Settings</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Pricing rules</p>
        </div>
        <div className="w-[38px]"></div>
      </header>

      <main className="grow overflow-y-auto p-2">
        <div className="mx-auto max-w-3xl flex flex-col gap-3">
          <Card className="shadow-sm border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Pricing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 py-2">
                <div className="rounded-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">GST on tickets</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {GST_RATE}% GST is applied automatically to every ticket priced ₹{GST_EXEMPTION_THRESHOLD} and above; tickets below ₹{GST_EXEMPTION_THRESHOLD} are tax-free. You choose whether each event&apos;s ticket price includes GST when you create the event.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Enable rounding off</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Round the final payable total to the nearest interval.</p>
                  </div>
                  <SettingToggle
                    checked={draft.enableRounding}
                    disabled={loading}
                    onChange={() => setDraft((prev) => ({ ...prev, enableRounding: !prev.enableRounding }))}
                  />
                </div>

                {draft.enableRounding && (
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-2">Rounding precision</p>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {[0.01, 0.1, 0.5, 1, 5, 10].map((value) => (
                        <button
                          key={value}
                          type="button"
                          disabled={loading}
                          onClick={() => setDraft((prev) => ({ ...prev, roundingInterval: value }))}
                          className={`px-2 py-1.5 rounded-sm border text-xs font-semibold ${Number(draft.roundingInterval) === value
                            ? 'bg-[#007A78] text-white border-[#007A78]'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                            }`}
                        >
                          {value.toFixed(2)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {isOwner && (
            <Card className="shadow-sm border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Event Link</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Event Link</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Claim a unique URL for your public event page.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSubdomainModal(true)}
                    className="px-4 py-2 text-sm font-semibold rounded-sm border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Manage Link
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Future settings go here */}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] shadow-2xl md:static md:inset-auto md:z-auto md:border-0 md:bg-transparent md:shadow-none md:mt-1">
        <div className="max-w-3xl mx-auto px-4 py-3.5 md:px-0">
          {saveError && (
            <p className="text-red-500 text-xs font-bold mb-2 text-center">{saveError}</p>
          )}
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={isSaving}
            className={`w-full py-3.5 rounded-sm text-white dark:text-slate-950 text-sm font-extrabold flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50 ${saveSuccess
              ? 'bg-emerald-600 dark:bg-emerald-400'
              : 'bg-[#007A78] hover:bg-[#006361] dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5]'
              }`}
          >
            {isSaving ? 'Saving Settings…' : saveSuccess ? 'Settings Saved' : 'Save Settings'}
          </button>
        </div>
      </div>

      {profile?.companyId && (
        <EventSubdomainModal
          companyId={profile.companyId}
          forceOpen={showSubdomainModal}
          onClose={() => setShowSubdomainModal(false)}
        />
      )}
    </div>
  );
};

export default Settings;