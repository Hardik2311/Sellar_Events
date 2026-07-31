import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import FormField from '../components/ui/FormField';
import {
  FloatingLabelInput,
  FloatingLabelSelect,
  FloatingLabelTextArea,
} from '../components/ui/AuthUIComponents'
import ImageUploadBox from '../components/ui/ImageUploadBox';
import ThemeToggle from '../components/ui/ThemeToggle';
import TicketTierEditor from '../components/TicketTierEditor';
import { EVENT_CATEGORIES, type EventFormState, type TicketTierDraft } from '../types/event.types';
import { compressImageToTargetSize } from '../lib/imageCompression'
import { useCompanySettings } from '../hooks/useSettings';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../lib/firebase';

const createEmptyTier = (): TicketTierDraft => ({
  id: `tier-${Date.now()}`,
  name: 'General',
  price: 0,
  quantity: 100,
});

const INITIAL_STATE: EventFormState = {
  title: '',
  category: 'Music',
  customCategory: '',
  description: '',
  date: '',
  endDate: '',
  time: '',
  venue: '',
  isOnline: false,
  coverImagePreview: null,
  tiers: [createEmptyTier()],
  promoCode: '',
  promoDiscountPercent: 0,
  registrationMode: 'tickets',
  rsvpLink: '',
  rsvpButtonLabel: 'RSVP Now',
};

const CreateEvent: React.FC = () => {
  const navigate = useNavigate();
  const { settings: companySettings } = useCompanySettings();
  const { user, profile } = useAuth();
  const [form, setForm] = useState<EventFormState>(INITIAL_STATE);
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const update = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  useEffect(() => {
    if (!companySettings.rsvpEnabled && form.registrationMode === 'rsvp') {
      update('registrationMode', 'tickets');
    }
  }, [companySettings.rsvpEnabled]);
  const isOtherCategory = form.category === 'Other';

  const isValidUrl = (value: string) => {
    try {
      const u = new URL(value.trim());
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const isPublishable =
    form.title.trim().length > 0 &&
    form.date &&
    form.endDate &&
    form.endDate >= form.date &&
    form.time &&
    (form.isOnline || form.venue.trim().length > 0) &&
    (!isOtherCategory || form.customCategory.trim().length > 0) &&
    (form.registrationMode === 'tickets' || isValidUrl(form.rsvpLink));

  const handleCoverImageChange = async (preview: string | null) => {
    if (!preview) {
      update('coverImagePreview', null);
      return;
    }

    setIsCompressingImage(true);
    try {
      // Resize/re-encode so we never store a multi-MB base64 image in state
      // (or, later, send one to the backend). Targets ~500KB.
      const compressed = await compressImageToTargetSize(preview, 500, {
        maxWidth: 1600,
        maxHeight: 1600,
      });
      update('coverImagePreview', compressed);
    } catch (err) {
      console.error('Image compression failed, falling back to original preview:', err);
      update('coverImagePreview', preview);
    } finally {
      setIsCompressingImage(false);
    }
  };

  const saveEvent = async (status: 'draft' | 'published') => {
    if (!user || !profile?.companyId) {
      setSaveError('User session not found. Please log in again.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      // Dashboard queries/sorts on `startDate` as a Firestore Timestamp,
      // built from the separate date + time fields the form collects.
      const startDate = form.date
        ? Timestamp.fromDate(new Date(`${form.date}T${form.time || '00:00'}`))
        : null;

      let coverImageUrl: string | null = null;

      // Cover image abhi base64 preview hai — Storage pe upload karke URL lo
      if (form.coverImagePreview) {

        const tempId = `evt-${Date.now()}`;
        const imageRef = ref(storage, `companies/${profile.companyId}/events/${tempId}/cover.jpg`);
        await uploadString(imageRef, form.coverImagePreview, 'data_url');
        coverImageUrl = await getDownloadURL(imageRef);
      }

      const eventsRef = collection(db, 'companies', profile.companyId, 'events');
      const isRsvp = form.registrationMode === 'rsvp';

      await addDoc(eventsRef, {
        title: form.title,
        category: form.category === 'Other' ? form.customCategory : form.category,
        description: form.description,
        startDate,
        date: form.date,
        endDate: form.endDate,
        time: form.time,
        venue: form.isOnline ? null : form.venue,
        isOnline: form.isOnline,
        coverImageUrl,
        registrationMode: form.registrationMode,
        // Keep tiers empty for RSVP events — no pricing/inventory to track
        tiers: isRsvp ? [] : form.tiers,
        rsvpLink: isRsvp ? form.rsvpLink.trim() : null,
        rsvpButtonLabel: isRsvp ? (form.rsvpButtonLabel.trim() || 'RSVP Now') : null,
        promoCode: form.promoCode || null,
        promoDiscountPercent: form.promoDiscountPercent || 0,
        status,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      navigate('/events');
    } catch (err) {
      console.error('Failed to save event:', err);
      setSaveError('Failed to save event. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = () => saveEvent('draft');
  const handlePublish = () => {
    if (!isPublishable) return;
    saveEvent('published');
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-24 md:mb-16">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-4 py-3 shadow-xs">
        <button
          onClick={() => navigate('/events')}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
          title="Back to Events"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 text-center flex flex-col items-center justify-center">
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">Create Event</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Fill in event details, set ticket tiers, then publish</p>
        </div>
        <ThemeToggle />
      </header>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <main className="grow overflow-y-auto p-2">
        <div className="mx-auto max-w-3xl flex flex-col gap-3">
          {/* Event details */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-900">Event details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Cover image</p>
                <ImageUploadBox
                  preview={form.coverImagePreview}
                  onChange={handleCoverImageChange}
                />
                {isCompressingImage && (
                  <p className="text-xs text-gray-500 mt-1">Compressing image…</p>
                )}
              </div>

              <FloatingLabelInput
                id="title"
                label="Event title *"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FloatingLabelSelect
                  id="category"
                  label="Category"
                  value={form.category}
                  options={EVENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
                  onChange={(e) => {
                    const value = e.target.value as EventFormState['category'];
                    update('category', value);
                    if (value !== 'Other') update('customCategory', '');
                  }}
                />

                <FormField label="Format" htmlFor="format">
                  <div className="flex rounded-md border border-gray-300 p-1 bg-white">
                    <button
                      type="button"
                      onClick={() => update('isOnline', false)}
                      className={`flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors ${!form.isOnline ? 'bg-orange-50 text-[#007A78]' : 'text-gray-500'
                        }`}
                    >
                      In-person
                    </button>
                    <button
                      type="button"
                      onClick={() => update('isOnline', true)}
                      className={`flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors ${form.isOnline ? 'bg-orange-50 text-[#007A78]' : 'text-gray-500'
                        }`}
                    >
                      Online
                    </button>
                  </div>
                </FormField>
              </div>

              {isOtherCategory && (
                <div>
                  <FloatingLabelInput
                    id="custom-category"
                    label="Custom category *"
                    value={form.customCategory}
                    onChange={(e) => update('customCategory', e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Tell us what kind of event this is</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <FloatingLabelInput
                  id="date"
                  label="Start date *"
                  type="date"
                  icon={<Calendar size={16} />}
                  value={form.date}
                  onChange={(e) => {
                    const value = e.target.value;
                    update('date', value);
                    // keep end date valid if it's now before the new start date
                    if (form.endDate && form.endDate < value) update('endDate', value);
                  }}
                  required
                />
                <FloatingLabelInput
                  id="end-date"
                  label="End date *"
                  type="date"
                  icon={<Calendar size={16} />}
                  min={form.date || undefined}
                  value={form.endDate}
                  onChange={(e) => update('endDate', e.target.value)}
                  required
                />
              </div>

              <FloatingLabelInput
                id="time"
                label="Time *"
                type="time"
                icon={<Clock size={16} />}
                value={form.time}
                onChange={(e) => update('time', e.target.value)}
                required
              />

              {!form.isOnline && (
                <div>
                  <FloatingLabelInput
                    id="venue"
                    label="Venue *"
                    value={form.venue}
                    onChange={(e) => update('venue', e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Full address helps attendees find it on the day</p>
                </div>
              )}

              <FloatingLabelTextArea
                id="description"
                label="Description"
                rows={4}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Registration: paid tiers OR external RSVP link */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-900">
                {form.registrationMode === 'tickets' ? 'Ticket tiers' : 'RSVP details'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {companySettings.rsvpEnabled && (
                <FormField label="Registration type" htmlFor="registration-mode">
                  <div className="flex rounded-md border border-gray-300 p-1 bg-white">
                    <button
                      type="button"
                      onClick={() => update('registrationMode', 'tickets')}
                      className={`flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors ${form.registrationMode === 'tickets' ? 'bg-orange-50 text-[#007A78]' : 'text-gray-500'
                        }`}
                    >
                      Ticketed
                    </button>
                    <button
                      type="button"
                      onClick={() => update('registrationMode', 'rsvp')}
                      className={`flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors ${form.registrationMode === 'rsvp' ? 'bg-orange-50 text-[#007A78]' : 'text-gray-500'
                        }`}
                    >
                      RSVP (external link)
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {form.registrationMode === 'rsvp'
                      ? 'Good for online sessions or free events — attendees fill a form instead of buying a ticket.'
                      : 'Attendees pay and get a ticket, tracked with quantity per tier.'}
                  </p>
                </FormField>
              )}

              {form.registrationMode === 'tickets' ? (
                <TicketTierEditor tiers={form.tiers} onChange={(tiers) => update('tiers', tiers)} />
              ) : (
                <div className="space-y-3">
                  <FloatingLabelInput
                    id="rsvp-link"
                    label="Registration link (Google Form, Typeform, etc.) *"
                    value={form.rsvpLink}
                    onChange={(e) => update('rsvpLink', e.target.value)}
                    required
                  />
                  {form.rsvpLink.trim().length > 0 && !isValidUrl(form.rsvpLink) && (
                    <p className="text-xs text-red-500">Enter a valid link starting with http:// or https://</p>
                  )}
                  <FloatingLabelInput
                    id="rsvp-button-label"
                    label="Button text (optional)"
                    value={form.rsvpButtonLabel}
                    onChange={(e) => update('rsvpButtonLabel', e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    Attendees will see this button on the event page and be sent to your form to register.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Promo code (optional) */}
          {/* <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-900">Promo code (optional)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Code" htmlFor="promo-code">
                <TextInput
                  id="promo-code"
                  placeholder="e.g. SAVE10"
                  value={form.promoCode}
                  onChange={(e) => update('promoCode', e.target.value.toUpperCase())}
                />
              </FormField>
              <FormField label="Discount %" htmlFor="promo-discount">
                <TextInput
                  id="promo-discount"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="e.g. 10"
                  value={form.promoDiscountPercent || ''}
                  onChange={(e) => update('promoDiscountPercent', Number(e.target.value) || 0)}
                />
              </FormField>
            </CardContent>
          </Card> */}
        </div>
      </main>

      {/* ── Sticky action bar ──────────────────────────────────────────── */}
      {saveError && (
        <div className="fixed bottom-32 md:bottom-16 left-0 right-0 flex justify-center z-30 px-3">
          <p className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-md px-4 py-2">{saveError}</p>
        </div>
      )}
      <div className="fixed bottom-14 md:bottom-0 left-0 right-0 md:left-56 border-t border-slate-200 dark:border-slate-800 bg-[#F9FAFB] dark:bg-[#1E293B] p-3.5 flex justify-center gap-3 z-30 shadow-2xl">
        <div className="w-full max-w-3xl flex gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-3 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-xs disabled:opacity-40"
          >
            {isSaving ? 'Saving…' : 'Save as Draft'}
          </button>
          <button
            onClick={handlePublish}
            disabled={!isPublishable || isSaving}
            className="flex-1 rounded-xl bg-[#007A78] hover:bg-[#006361] text-white dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5] dark:text-slate-950 py-3 text-xs font-bold transition-all shadow-xs disabled:opacity-40"
          >
            {isSaving ? 'Saving…' : 'Preview & Publish Event'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateEvent;