import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { ExternalLink, Loader2, RotateCcw } from 'lucide-react';
import BackButton from '../components/ui/BackButton';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { useCompanySettings, type CompanySettings } from '../hooks/useSettings';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import {
  STOREFRONT_POLICY_KEYS,
  STOREFRONT_POLICY_LABELS,
  getPolicyTemplate,
  resolvePolicyText,
  type StorefrontPolicyKey,
} from '../lib/storefrontPolicies';

const BIO_MAX = 160;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass =
  'w-full rounded-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-[#007A78] focus:ring-1 focus:ring-[#007A78]';

type PolicyDrafts = Record<StorefrontPolicyKey, string>;

// Settings → Storefront & policies: what buyers see in the storefront footer
// (short description, contact email) and the organizer's own refund policy,
// terms and privacy policy, shown on /policies/:policy.
const StorefrontSettings: React.FC = () => {
  const { settings, loading } = useCompanySettings();

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-100 dark:bg-[#0F172A]">
        <Loader2 className="animate-spin text-[#007A78] dark:text-[#2DD4BF]" size={24} />
      </div>
    );
  }
  // Mounted only once settings have loaded, so the form starts from them.
  return <StorefrontSettingsForm settings={settings} />;
};

const StorefrontSettingsForm: React.FC<{ settings: CompanySettings }> = ({ settings }) => {
  const { profile } = useAuth();

  const [bio, setBio] = useState(settings.storefront.bio);
  const [contactEmail, setContactEmail] = useState(settings.storefront.contactEmail);
  // Policies the organizer hasn't written yet start from the template with their name filled in.
  const [policies, setPolicies] = useState<PolicyDrafts>(() => ({
    refund: resolvePolicyText('refund', settings.storefront.policies.refund, settings.organizationName),
    terms: resolvePolicyText('terms', settings.storefront.policies.terms, settings.organizationName),
    privacy: resolvePolicyText('privacy', settings.storefront.policies.privacy, settings.organizationName),
  }));
  const [activePolicy, setActivePolicy] = useState<StorefrontPolicyKey>('refund');

  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const template = getPolicyTemplate(activePolicy, settings.organizationName);
  const isTemplate = (key: StorefrontPolicyKey) =>
    policies[key].trim() === getPolicyTemplate(key, settings.organizationName).trim();

  const handleSave = async () => {
    if (!profile?.companyId) {
      setSaveError('Company not found. Please try again.');
      return;
    }
    const trimmedEmail = contactEmail.trim();
    if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
      setEmailError('Enter a valid email, like hello@yourbrand.in.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const settingsRef = doc(db, 'companies', profile.companyId, 'settings', 'general');
      // A policy left exactly as the template is saved empty, so the storefront
      // keeps showing the template (and picks up a renamed organization).
      const savedPolicies = Object.fromEntries(
        STOREFRONT_POLICY_KEYS.map((key) => [key, isTemplate(key) ? '' : policies[key].trim()])
      ) as PolicyDrafts;
      await setDoc(
        settingsRef,
        {
          storefront: {
            bio: bio.trim(),
            contactEmail: trimmedEmail,
            policies: savedPolicies,
            policiesUpdatedAt: new Date().toISOString().slice(0, 10),
          },
        },
        { merge: true }
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save storefront settings:', err);
      setSaveError('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const previewUrl = profile?.companyId ? `/public/${profile.companyId}/policies/${activePolicy}` : null;

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-16">
      <header className="relative sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-4 py-3 shadow-xs">
        <BackButton title="Back" />
        <div className="absolute left-1/2 -translate-x-1/2 text-center flex flex-col items-center justify-center max-w-[70%]">
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate">Storefront &amp; policies</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">What buyers see in your store footer</p>
        </div>
        <div className="w-[38px]"></div>
      </header>

      <main className="grow overflow-y-auto p-2">
        <div className="mx-auto max-w-3xl flex flex-col gap-3">
          {/* Footer details */}
          <Card className="shadow-sm border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Footer details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 py-2">
                <div>
                  <label htmlFor="storefront-bio" className="mb-1 block text-sm font-medium text-slate-800 dark:text-slate-100">
                    Short description
                  </label>
                  <textarea
                    id="storefront-bio"
                    rows={2}
                    maxLength={BIO_MAX}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Live music, food walks and workshops across Jaipur, most weekends."
                    className={`${inputClass} resize-none`}
                  />
                  <p className="mt-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Shown under your name in the store footer.</span>
                    <span>{bio.length}/{BIO_MAX}</span>
                  </p>
                </div>
                <div>
                  <label htmlFor="storefront-email" className="mb-1 block text-sm font-medium text-slate-800 dark:text-slate-100">
                    Contact email
                  </label>
                  <input
                    id="storefront-email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => {
                      setContactEmail(e.target.value);
                      setEmailError(null);
                    }}
                    placeholder="hello@yourbrand.in"
                    className={inputClass}
                  />
                  {emailError ? (
                    <p className="text-red-500 text-[11px] font-bold mt-1.5 mb-0">{emailError}</p>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Shown publicly under Contact. Leave empty to hide it.
                    </p>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Website and social links in the footer come from Edit Profile.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Policies */}
          <Card className="shadow-sm border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Policies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 py-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Buyers open these from the Help links in your store footer. Each one starts from a template with your name in it: change
                  anything that doesn&apos;t match how you run your events. The templates are a starting point, not legal advice.
                </p>

                <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Policy">
                  {STOREFRONT_POLICY_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={activePolicy === key}
                      onClick={() => setActivePolicy(key)}
                      className={`min-h-[42px] px-2 py-2 rounded-sm text-xs sm:text-sm font-semibold border transition-colors ${
                        activePolicy === key
                          ? 'bg-[#007A78] text-white border-[#007A78]'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {STOREFRONT_POLICY_LABELS[key]}
                    </button>
                  ))}
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label htmlFor="storefront-policy" className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                      {STOREFRONT_POLICY_LABELS[activePolicy]}
                    </label>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {isTemplate(activePolicy) ? 'Using the template' : 'Your own text'}
                    </span>
                  </div>
                  <textarea
                    id="storefront-policy"
                    rows={16}
                    value={policies[activePolicy]}
                    onChange={(e) => setPolicies((prev) => ({ ...prev, [activePolicy]: e.target.value }))}
                    className={`${inputClass} font-mono leading-relaxed`}
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Leave a blank line between paragraphs. A short line on its own, without a full stop, becomes a heading.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isTemplate(activePolicy)}
                    onClick={() => setPolicies((prev) => ({ ...prev, [activePolicy]: template }))}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-sm border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40"
                  >
                    <RotateCcw size={14} /> Reset to template
                  </button>
                  {previewUrl && (
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-sm text-[#007A78] dark:text-[#2DD4BF] hover:underline"
                    >
                      <ExternalLink size={14} /> View saved version
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] shadow-2xl md:static md:inset-auto md:z-auto md:border-0 md:bg-transparent md:shadow-none md:mt-1">
        <div className="max-w-3xl mx-auto px-4 py-3.5 md:px-0">
          {saveError && <p className="text-red-500 text-xs font-bold mb-2 text-center">{saveError}</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`w-full py-3.5 rounded-sm text-white dark:text-slate-950 text-sm font-extrabold flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50 ${
              saveSuccess
                ? 'bg-emerald-600 dark:bg-emerald-400'
                : 'bg-[#007A78] hover:bg-[#006361] dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5]'
            }`}
          >
            {isSaving ? 'Saving…' : saveSuccess ? 'Saved' : 'Save storefront & policies'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StorefrontSettings;
