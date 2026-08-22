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
import CoverPhotoUpload from '../components/ui/CoverPhotoUpload';
import PastEventsGallery from '../components/ui/PastEventsGallery';
import TicketTierEditor from '../components/TicketTierEditor';
import { EVENT_CATEGORIES, type EventFormState, type TicketTierDraft } from '../types/event.types';
import { useCompanySettings } from '../hooks/useSettings';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../lib/firebase';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import TimeSelect from '../components/ui/Timeselect';

const createEmptyTier = (): TicketTierDraft => ({
  id: `tier-${Date.now()}`,
  name: 'General',
  price: 0,
  quantity: 100,
  dummyRemaining: undefined,
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
  images: [],
  coverImageDesktop: null,
  coverImageMobile: null,
  pastEventsGallery: [],
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
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const toDate = (s: string) => (s ? new Date(`${s}T00:00:00`) : null);
  const toDateStr = (d: Date | null) => {
    if (!d) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
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

  const req = companySettings.eventFieldRequirements;

  const isPublishable =
    form.title.trim().length > 0 &&
    Boolean(form.date) &&
    Boolean(form.time) &&
    (form.isOnline || form.venue.trim().length > 0) &&
    (!req.endDate || form.endDate) &&
    (!form.date || !form.endDate || form.endDate >= form.date) &&
    (!req.description || form.description.trim().length > 0) &&
    (!req.images || form.images.length > 0) &&
    (!isOtherCategory || form.customCategory.trim().length > 0) &&
    (form.registrationMode === 'tickets' || isValidUrl(form.rsvpLink));

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

      let coverImageUrls: string[] = [];
      const tempId = `evt-${Date.now()}`;

      // Images abhi base64 previews hain — Storage pe sab upload karke URLs lo,
      // pehli image hi list/cover thumbnail ke liye use hogi.
      if (form.images.length > 0) {
        coverImageUrls = await Promise.all(
          form.images.map(async (preview, i) => {
            const imageRef = ref(storage, `companies/${profile.companyId}/events/${tempId}/photo-${i}.jpg`);
            await uploadString(imageRef, preview, 'data_url');
            return getDownloadURL(imageRef);
          })
        );
      }

      // NEW — dedicated cover slots, uploaded the same way
      const coverImageDesktopUrl = form.coverImageDesktop
        ? await (async () => {
          const r = ref(storage, `companies/${profile.companyId}/events/${tempId}/cover-desktop.jpg`);
          await uploadString(r, form.coverImageDesktop as string, 'data_url');
          return getDownloadURL(r);
        })()
        : null;

      const coverImageMobileUrl = form.coverImageMobile
        ? await (async () => {
          const r = ref(storage, `companies/${profile.companyId}/events/${tempId}/cover-mobile.jpg`);
          await uploadString(r, form.coverImageMobile as string, 'data_url');
          return getDownloadURL(r);
        })()
        : null;

      // NEW — past events gallery (mixed media, uploaded as-is; only plain
      // images were already compressed client-side, GIFs/videos are already <1MB)
      const pastEventsGalleryUploaded = await Promise.all(
        form.pastEventsGallery.map(async (item, i) => {
          const ext = item.type === 'video' ? 'mp4' : item.type === 'gif' ? 'gif' : 'jpg';
          const r = ref(storage, `companies/${profile.companyId}/events/${tempId}/past-${i}.${ext}`);
          await uploadString(r, item.url, 'data_url');
          return { url: await getDownloadURL(r), type: item.type };
        })
      );

      const eventsRef = collection(db, 'companies', profile.companyId, 'events');
      const isRsvp = form.registrationMode === 'rsvp';

      // Firestore rejects `undefined` inside array elements — dummyRemaining
      // and the tier end date/time are all optional and undefined by default
      // until an organizer fills them in.
      const sanitizedTiers = form.tiers.map((tier) => ({
        ...tier,
        dummyRemaining: tier.dummyRemaining ?? null,
        tierEndDate: tier.tierEndDate ?? null,
        tierEndTime: tier.tierEndTime ?? null,
      }));

      const docRef = await addDoc(eventsRef, {
        title: form.title,
        category: form.category === 'Other' ? form.customCategory : form.category,
        description: form.description,
        startDate,
        date: form.date,
        endDate: form.endDate,
        time: form.time,
        venue: form.isOnline ? null : form.venue,
        isOnline: form.isOnline,
        coverImageUrl: coverImageUrls[0] ?? null,
        coverImageUrls,
        coverImageDesktop: coverImageDesktopUrl,
        coverImageMobile: coverImageMobileUrl,
        pastEventsGallery: pastEventsGalleryUploaded,
        registrationMode: form.registrationMode,
        // Keep tiers empty for RSVP events — no pricing/inventory to track
        tiers: isRsvp ? [] : sanitizedTiers,
        rsvpLink: isRsvp ? form.rsvpLink.trim() : null,
        rsvpButtonLabel: isRsvp ? (form.rsvpButtonLabel.trim() || 'RSVP Now') : null,
        promoCode: form.promoCode || null,
        promoDiscountPercent: form.promoDiscountPercent || 0,
        status,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      navigate(`/events/e/${docRef.id}`);
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
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-6 py-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Create Event</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Fill in event details, set ticket tiers, then publish</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/events')}
            className="p-2.5 rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Back to Events"
          >
            <ArrowLeft size={18} />
          </button>
        </div>
      </header>

      <main className="grow overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ── Left column ────────────────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Cover photo — desktop + mobile */}
            <Card className="shadow-sm border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Cover Photo</CardTitle>
              </CardHeader>
              <CardContent>
                <CoverPhotoUpload
                  desktopSrc={form.coverImageDesktop}
                  mobileSrc={form.coverImageMobile}
                  onChangeDesktop={(src) => update('coverImageDesktop', src)}
                  onChangeMobile={(src) => update('coverImageMobile', src)}
                />
              </CardContent>
            </Card>

            {/* Basic Information */}
            <Card className="shadow-sm border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FloatingLabelInput
                  id="title"
                  label="Event title *"
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  required
                />

                <div className={`grid grid-cols-1 ${isOtherCategory ? 'sm:grid-cols-2' : ''} gap-4 items-start`}>
                  <div>
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
                    {/* invisible spacer keeps height identical to the helper text under Custom category */}
                    {isOtherCategory && <p className="text-xs mt-1 invisible select-none">spacer</p>}
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
                    </div>
                  )}
                </div>

                <FormField label="Format" htmlFor="format">
                  <div className="flex rounded-sm border border-gray-300 dark:border-slate-700 p-1 bg-white dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => update('isOnline', false)}
                      className={`flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors ${!form.isOnline ? 'bg-orange-50 dark:bg-[#2DD4BF]/10 text-[#007A78] dark:text-[#2DD4BF]' : 'text-gray-500 dark:text-slate-400'
                        }`}
                    >
                      In-person
                    </button>
                    <button
                      type="button"
                      onClick={() => update('isOnline', true)}
                      className={`flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors ${form.isOnline ? 'bg-orange-50 dark:bg-[#2DD4BF]/10 text-[#007A78] dark:text-[#2DD4BF]' : 'text-gray-500 dark:text-slate-400'
                        }`}
                    >
                      Online
                    </button>
                  </div>
                </FormField>

                <FloatingLabelTextArea
                  id="description"
                  label={req.description ? 'Description *' : 'Description'}
                  rows={4}
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  required={req.description}
                />
              </CardContent>
            </Card>

            {/* Registration: ticket tiers OR RSVP link */}
            <Card className="shadow-sm border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
                  {form.registrationMode === 'tickets' ? 'Ticket Tiers' : 'RSVP details'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {companySettings.rsvpEnabled && (
                  <FormField label="Registration type" htmlFor="registration-mode">
                    <div className="flex rounded-sm border border-gray-300 dark:border-slate-700 p-1 bg-white dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => update('registrationMode', 'tickets')}
                        className={`flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors ${form.registrationMode === 'tickets' ? 'bg-orange-50 dark:bg-[#2DD4BF]/10 text-[#007A78] dark:text-[#2DD4BF]' : 'text-gray-500 dark:text-slate-400'
                          }`}
                      >
                        Ticketed
                      </button>
                      <button
                        type="button"
                        onClick={() => update('registrationMode', 'rsvp')}
                        className={`flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors ${form.registrationMode === 'rsvp' ? 'bg-orange-50 dark:bg-[#2DD4BF]/10 text-[#007A78] dark:text-[#2DD4BF]' : 'text-gray-500 dark:text-slate-400'
                          }`}
                      >
                        RSVP (external link)
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                      {form.registrationMode === 'rsvp'
                        ? 'Good for online sessions or free events — attendees fill a form instead of buying a ticket.'
                        : 'Attendees pay and get a ticket, tracked with quantity per tier.'}
                    </p>
                  </FormField>
                )}

                {form.registrationMode === 'tickets' ? (
                  <TicketTierEditor
                    tiers={form.tiers}
                    onChange={(tiers) => update('tiers', tiers)}
                    showDummyQuantity={
                      companySettings.ticketDisplay.showTicketsRemaining &&
                      companySettings.ticketDisplay.useDummyThreshold
                    }
                    showEndDateTime={companySettings.ticketDisplay.enableTierAvailabilityWindow}
                  />
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
                      <p className="text-xs text-red-500 dark:text-red-400">Enter a valid link starting with http:// or https://</p>
                    )}
                    <FloatingLabelInput
                      id="rsvp-button-label"
                      label="Button text (optional)"
                      value={form.rsvpButtonLabel}
                      onChange={(e) => update('rsvpButtonLabel', e.target.value)}
                    />
                    <p className="text-xs text-gray-500 dark:text-slate-500">
                      Attendees will see this button on the event page and be sent to your form to register.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Past events gallery */}
            <Card className="shadow-sm border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Past Events Gallery</CardTitle>
              </CardHeader>
              <CardContent>
                <PastEventsGallery
                  media={form.pastEventsGallery}
                  onChange={(media) => update('pastEventsGallery', media)}
                  maxItems={6}
                />
              </CardContent>
            </Card>
          </div>

          {/* ── Right column: Logistics + Pro-tips ────────────── */}
          <div className="flex flex-col gap-4">
            <Card className="shadow-sm border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
                  <Calendar size={16} className="text-[#007A78] dark:text-[#2DD4BF]" /> Event Logistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Start date *" htmlFor="date">
                    <div className="relative">
                      <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" />
                      <DatePicker
                        id="date"
                        selected={toDate(form.date)}
                        onChange={(d: Date | null) => {
                          const value = toDateStr(d);
                          update('date', value);
                          if (form.endDate && form.endDate < value) update('endDate', value);
                        }}
                        dateFormat="dd/MM/yyyy"
                        placeholderText="Select date"
                        wrapperClassName="w-full block"
                        popperClassName="react-datepicker-popper-custom"
                        popperPlacement="bottom-start"
                        showPopperArrow={false}
                        className="w-full bg-white dark:bg-slate-800 border border-[#7D7777A3] dark:border-slate-600 rounded-sm shadow-[0_2px_4px_rgba(0,0,0,0.06)] py-3 pl-11 pr-3 text-[15px] text-slate-800 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-[#2DD4BF]"
                        required
                      />
                    </div>
                  </FormField>

                  <FormField label={req.endDate ? 'End date *' : 'End date'} htmlFor="end-date">
                    <div className="relative">
                      <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" />
                      <DatePicker
                        id="end-date"
                        selected={toDate(form.endDate)}
                        onChange={(d: Date | null) => update('endDate', toDateStr(d))}
                        minDate={toDate(form.date) || undefined}
                        dateFormat="dd/MM/yyyy"
                        placeholderText="Select date"
                        wrapperClassName="w-full block"
                        popperClassName="react-datepicker-popper-custom"
                        popperPlacement="bottom-start"
                        showPopperArrow={false}
                        className="w-full bg-white dark:bg-slate-800 border border-[#7D7777A3] dark:border-slate-600 rounded-sm shadow-[0_2px_4px_rgba(0,0,0,0.06)] py-3 pl-11 pr-3 text-[15px] text-slate-800 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-[#2DD4BF]"
                        required={req.endDate}
                      />
                    </div>
                  </FormField>
                </div>

                <FormField label="Time *" htmlFor="time">
                  <div className="flex items-center gap-2 rounded-sm border border-gray-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800">
                    <Clock size={16} className="text-gray-400 shrink-0" />
                    <TimeSelect
                      value={form.time ? form.time.split(':')[0] : '00'}
                      options={Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))}
                      onChange={(h) => update('time', `${h}:${form.time?.split(':')[1] || '00'}`)}
                    />
                    <span className="text-slate-400">:</span>
                    <TimeSelect
                      value={form.time ? form.time.split(':')[1] : '00'}
                      options={Array.from({ length: 60 }, (_, m) => String(m).padStart(2, '0'))}
                      onChange={(m) => update('time', `${form.time?.split(':')[0] || '00'}:${m}`)}
                    />
                  </div>
                </FormField>

                {!form.isOnline && (
                  <div>
                    <FloatingLabelInput
                      id="venue"
                      label="Venue *"
                      value={form.venue}
                      onChange={(e) => update('venue', e.target.value)}
                      required
                    />
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-500 dark:text-slate-500">Full address helps attendees find it on the day</p>
                      {form.venue.trim().length > 2 && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.venue)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-[#007A78] dark:text-[#2DD4BF] hover:underline shrink-0 ml-2"
                        >
                          View on map ↗
                        </a>
                      )}
                    </div>
                    {form.venue.trim().length > 2 && (
                      <iframe
                        title="venue-map-preview"
                        className="w-full h-32 mt-2 rounded-sm border border-gray-200 dark:border-slate-700"
                        loading="lazy"
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(form.venue)}&output=embed`}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
              <CardContent className="pt-4">
                <p className="text-sm font-semibold text-[#007A78] dark:text-[#2DD4BF] mb-2">Organizer Pro-Tips</p>
                <ul className="space-y-2 text-xs text-gray-600 dark:text-slate-300">
                  <li>Use a clear, action-oriented title.</li>
                  <li>Add multiple high-contrast photos — listings with a gallery attract more attendees.</li>
                  <li>Set ticket tiers early so you can track sell-through as you promote.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* ── Sticky action bar ──────────────────────────────────────────── */}
      {saveError && (
        <div className="fixed bottom-32 md:bottom-16 left-0 right-0 flex justify-center z-30 px-3">
          <p className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-sm px-4 py-2">{saveError}</p>
        </div>
      )}
      <div className="fixed bottom-14 md:bottom-0 left-0 right-0 md:left-56 border-t border-slate-200 dark:border-slate-800 bg-[#F9FAFB] dark:bg-[#1E293B] p-3.5 flex justify-center gap-3 z-30 shadow-2xl">
        <div className="w-full max-w-3xl flex gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="flex-1 rounded-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-3 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-xs disabled:opacity-40"
          >
            {isSaving ? 'Saving…' : 'Save as Draft'}
          </button>
          <button
            onClick={handlePublish}
            disabled={!isPublishable || isSaving}
            className="flex-1 rounded-sm bg-[#007A78] hover:bg-[#006361] text-white dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5] dark:text-slate-950 py-3 text-xs font-bold transition-all shadow-xs disabled:opacity-40"
          >
            {isSaving ? 'Publishing…' : 'Publish Event'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateEvent;