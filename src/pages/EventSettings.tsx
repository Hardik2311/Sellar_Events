import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import ThemeToggle from '../components/ui/ThemeToggle';
import { useCompanySettings, type EventFieldRequirements } from '../hooks/useSettings';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';

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

const FIELD_LABELS: { key: keyof EventFieldRequirements; label: string; hint: string }[] = [
  { key: 'title', label: 'Event title', hint: 'Name of the event' },
  { key: 'description', label: 'Description', hint: 'Details shown on the event page' },
  { key: 'date', label: 'Start date', hint: '' },
  { key: 'endDate', label: 'End date', hint: '' },
  { key: 'time', label: 'Time', hint: '' },
  { key: 'venue', label: 'Venue', hint: 'Only applies to in-person events' },
  { key: 'images', label: 'At least one photo', hint: '' },
];

const EventFieldSettings: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { settings, loading } = useCompanySettings();

  type DraftEventSettings = Pick<typeof settings, 'rsvpEnabled' | 'eventFieldRequirements'>;
  const [draft, setDraft] = useState<DraftEventSettings>({
    rsvpEnabled: settings.rsvpEnabled,
    eventFieldRequirements: settings.eventFieldRequirements,
  });
  const [initialized, setInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Seed the draft from Firestore once loading finishes. Guarded by
  // `initialized` so a live onSnapshot update doesn't clobber unsaved edits.
  useEffect(() => {
    if (!loading && !initialized) {
      setDraft({
        rsvpEnabled: settings.rsvpEnabled,
        eventFieldRequirements: settings.eventFieldRequirements,
      });
      setInitialized(true);
    }
  }, [loading, initialized, settings]);

  const toggleField = (key: keyof EventFieldRequirements) => {
    setDraft((prev) => ({
      ...prev,
      eventFieldRequirements: {
        ...prev.eventFieldRequirements,
        [key]: !prev.eventFieldRequirements[key],
      },
    }));
  };

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
      console.error('Failed to save event settings:', err);
      setSaveError('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

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
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">Event Settings</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">RSVP and required fields for Create Event</p>
        </div>
        <ThemeToggle />
      </header>

      <main className="grow overflow-y-auto p-2">
        <div className="mx-auto max-w-3xl flex flex-col gap-3">
          <Card className="shadow-sm border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Registration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Enable RSVP registration</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Let organizers create events with an external RSVP link instead of ticket tiers.
                  </p>
                </div>
                <SettingToggle
                  checked={draft.rsvpEnabled}
                  disabled={loading}
                  onChange={() => setDraft((prev) => ({ ...prev, rsvpEnabled: !prev.rsvpEnabled }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Required fields</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {FIELD_LABELS.map(({ key, label, hint }) => (
                  <div key={key} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</p>
                      {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>}
                    </div>
                    <SettingToggle
                      checked={draft.eventFieldRequirements[key]}
                      disabled={loading}
                      onChange={() => toggleField(key)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
            className={`w-full py-3.5 rounded-xl text-white dark:text-slate-950 text-sm font-extrabold flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50 ${saveSuccess
                ? 'bg-emerald-600 dark:bg-emerald-400'
                : 'bg-[#007A78] hover:bg-[#006361] dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5]'
              }`}
          >
            {isSaving ? 'Saving Settings…' : saveSuccess ? 'Settings Saved' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventFieldSettings;