import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
//import ThemeToggle from '../components/ui/ThemeToggle';
import { useCompanySettings } from '../hooks/useSettings';
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

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { settings, loading, updateSetting } = useCompanySettings();

  const [showGstModal, setShowGstModal] = useState(false);
  const [pendingScheme, setPendingScheme] = useState<'regular' | 'composition' | null>(null);
  const [gstInput, setGstInput] = useState('');
  const [gstError, setGstError] = useState<string | null>(null);
  const [savingGst, setSavingGst] = useState(false);

  type DraftSettings = Pick<typeof settings, 'gstScheme' | 'taxType' | 'defaultTaxRate' | 'enableRounding' | 'roundingInterval'>;
  const [draft, setDraft] = useState<DraftSettings>({
    gstScheme: settings.gstScheme,
    taxType: settings.taxType,
    defaultTaxRate: settings.defaultTaxRate,
    enableRounding: settings.enableRounding,
    roundingInterval: settings.roundingInterval,
  });
  const [initialized, setInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Seed the draft from Firestore once loading finishes. Guarded by
  // `initialized` so a live onSnapshot update doesn't clobber unsaved edits.
  React.useEffect(() => {
    if (!loading && !initialized) {
      setDraft({
        gstScheme: settings.gstScheme,
        taxType: settings.taxType,
        defaultTaxRate: settings.defaultTaxRate,
        enableRounding: settings.enableRounding,
        roundingInterval: settings.roundingInterval,
      });
      setInitialized(true);
    }
  }, [loading, initialized, settings]);

  const handleSchemeSelect = (value: 'none' | 'regular' | 'composition') => {
    const needsGstin = (value === 'regular' || value === 'composition') && !profile?.gstinNumber;
    if (needsGstin) {
      setPendingScheme(value);
      setGstInput('');
      setGstError(null);
      setShowGstModal(true);
      return;
    }
    setDraft((prev) => ({ ...prev, gstScheme: value }));
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
      console.error('Failed to save settings:', err);
      setSaveError('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  const handleGstCancel = () => {
    setShowGstModal(false);
    setPendingScheme(null);
    setGstError(null);
  };

  const handleGstSave = async () => {
    const value = gstInput.trim().toUpperCase();
    if (!GSTIN_REGEX.test(value)) {
      setGstError('Please enter a valid 15-character GSTIN.');
      return;
    }
    if (!profile?.companyId) {
      setGstError('Company not found. Please try again.');
      return;
    }
    setSavingGst(true);
    setGstError(null);
    try {
      const businessRef = doc(db, 'companies', profile.companyId, 'business_info', 'profile');
      await setDoc(businessRef, { gstinNumber: value }, { merge: true });
      if (pendingScheme) {
        setDraft((prev) => ({ ...prev, gstScheme: pendingScheme }));
      }
      setShowGstModal(false);
      setPendingScheme(null);
    } catch (err) {
      console.error('Failed to save GSTIN:', err);
      setGstError('Failed to save GST number. Please try again.');
    } finally {
      setSavingGst(false);
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
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">Company Settings</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tax and pricing rules</p>
        </div>
        {/* <ThemeToggle /> */}
      </header>

      <main className="grow overflow-y-auto p-2">
        <div className="mx-auto max-w-3xl flex flex-col gap-3">
          <Card className="shadow-sm border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Tax & Pricing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-2">GST scheme</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { label: 'None', value: 'none' as const },
                        { label: 'Regular GST', value: 'regular' as const },
                        { label: 'Composition', value: 'composition' as const },
                      ]
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={loading}
                        onClick={() => handleSchemeSelect(opt.value)}
                        className={`min-h-[42px] px-2 py-2 rounded-md text-xs sm:text-sm font-semibold border transition-colors ${draft.gstScheme === opt.value
                          ? 'bg-[#007A78] text-white border-[#007A78]'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {draft.gstScheme === 'regular' && (
                  <>
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-2">Tax calculation</p>
                      <select
                        value={draft.taxType}
                        disabled={loading}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, taxType: e.target.value as 'inclusive' | 'exclusive' }))
                        }
                        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-[#007A78] focus:ring-1 focus:ring-[#007A78]"
                      >
                        <option value="exclusive">Tax exclusive (ticket price excludes GST)</option>
                        <option value="inclusive">Tax inclusive (ticket price includes GST)</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-800 dark:text-slate-100">Tax rate (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={draft.defaultTaxRate}
                        disabled={loading}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, defaultTaxRate: parseFloat(e.target.value) || 0 }))
                        }
                        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-[#007A78] focus:ring-1 focus:ring-[#007A78]"
                      />
                    </div>
                  </>
                )}

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
                          className={`px-2 py-1.5 rounded-md border text-xs font-semibold ${Number(draft.roundingInterval) === value
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
            className={`w-full py-3.5 rounded-xl text-white dark:text-slate-950 text-sm font-extrabold flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50 ${saveSuccess
                ? 'bg-emerald-600 dark:bg-emerald-400'
                : 'bg-[#007A78] hover:bg-[#006361] dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5]'
              }`}
          >
            {isSaving ? 'Saving Settings…' : saveSuccess ? 'Settings Saved' : 'Save Settings'}
          </button>
        </div>
      </div>

      {showGstModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 shadow-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Enter GST Number</h2>
              <button
                type="button"
                onClick={handleGstCancel}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              A GSTIN is required to enable this GST scheme. Please enter your 15-character GSTIN to continue.
            </p>
            <input
              type="text"
              value={gstInput}
              maxLength={15}
              disabled={savingGst}
              onChange={(e) => setGstInput(e.target.value.toUpperCase())}
              placeholder="15-character GSTIN"
              className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm uppercase text-slate-800 dark:text-slate-100 outline-none focus:border-[#007A78] focus:ring-1 focus:ring-[#007A78]"
            />
            {gstError && <p className="text-red-500 text-[11px] font-bold mt-1.5 mb-0">{gstError}</p>}
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={handleGstCancel}
                disabled={savingGst}
                className="flex-1 py-2.5 rounded-md text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGstSave}
                disabled={savingGst}
                className="flex-1 py-2.5 rounded-md text-sm font-semibold text-white bg-[#007A78] hover:bg-[#006361] disabled:opacity-50"
              >
                {savingGst ? 'Saving…' : 'Save & Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;