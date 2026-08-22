import React, { useState } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import FormField from './ui/FormField';
import {
  FloatingLabelInput,
  FloatingLabelSelect,
  FloatingLabelTextArea,
} from './ui/AuthUIComponents';
import CoverPhotoUpload from './ui/CoverPhotoUpload';
import PastEventsGallery from './ui/PastEventsGallery';
import TicketTierEditor from './TicketTierEditor';
import { EVENT_CATEGORIES, type EventCategory, type EventFormState, type TicketTierDraft } from '../types/event.types';
import { useCompanySettings } from '../hooks/useSettings';
import type { PublicEvent } from '../data/events';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import TimeSelect from './ui/Timeselect';

type EventItem = PublicEvent;

interface EditEventModalProps {
  event: EventItem;
  onClose: () => void;
  onSave: (updated: EventFormState) => void;
}

const toFormState = (event: EventItem): EventFormState => ({
  title: event.title,
  category: EVENT_CATEGORIES.includes(event.category as EventCategory)
    ? (event.category as EventCategory)
    : 'Other',
  customCategory: EVENT_CATEGORIES.includes(event.category as EventCategory)
    ? ''
    : event.category,
  description: event.description,
  date: event.date,
  endDate: event.endDate ?? event.date,
  time: event.time,
  venue: event.venue ?? '',
  isOnline: event.isOnline,
  images: event.images ?? (event.coverImage ? [event.coverImage] : []),
  // NEW
  coverImageDesktop: event.coverImageDesktop ?? null,
  coverImageMobile: event.coverImageMobile ?? null,
  pastEventsGallery: event.pastEventsGallery ?? [],
  tiers: event.tiers.map((t): TicketTierDraft => ({
    id: t.id,
    name: t.name,
    price: t.price,
    quantity: t.quantity,
    dummyRemaining: t.dummyRemaining ?? undefined,
    tierEndDate: t.tierEndDate ?? undefined,
    tierEndTime: t.tierEndTime ?? undefined,
  })),
  promoCode: '',
  promoDiscountPercent: 0,
  // Existing legacy events with no registrationMode field default to ticketed
  registrationMode: event.registrationMode ?? 'tickets',
  rsvpLink: event.rsvpLink ?? '',
  rsvpButtonLabel: event.rsvpButtonLabel ?? 'RSVP Now',
});

const EditEventModal: React.FC<EditEventModalProps> = ({ event, onClose, onSave }) => {
  const { settings: companySettings } = useCompanySettings();
  const [form, setForm] = useState<EventFormState>(() => toFormState(event));

  const update = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toDate = (s: string) => (s ? new Date(`${s}T00:00:00`) : null);
  const toDateStr = (d: Date | null) => {
    if (!d) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  React.useEffect(() => {
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

  const isSavable =
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

  const handleSave = () => {
    if (!isSavable) return;
    console.log('Save edited event:', form); // TODO: PATCH /events/:id
    onSave(form);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-sm bg-gray-100 dark:bg-[#0F172A] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-300 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-3">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Edit event</h2>
          <button
            onClick={onClose}
            className="rounded-sm p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="grow overflow-y-auto p-3">
          <div className="flex flex-col gap-3">
            <Card className="shadow-sm border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Event details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cover photo</p>
                  <CoverPhotoUpload
                    desktopSrc={form.coverImageDesktop}
                    mobileSrc={form.coverImageMobile}
                    onChangeDesktop={(src) => update('coverImageDesktop', src)}
                    onChangeMobile={(src) => update('coverImageMobile', src)}
                  />
                </div>

                <FloatingLabelInput
                  id="edit-title"
                  label="Event title *"
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  required
                />

                {/*
                  Layout rule:
                  - When category is "Other": Category + Custom category sit side by side
                    (2-col grid), and Format moves below taking the full width.
                  - When category is NOT "Other": Category takes the full width by itself,
                    and Format also takes the full width below it (both stacked, full width).
                */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className={isOtherCategory ? '' : 'sm:col-span-2'}>
                    <FloatingLabelSelect
                      id="edit-category"
                      label="Category"
                      value={form.category}
                      options={EVENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
                      onChange={(e) => {
                        const value = e.target.value as EventFormState['category'];
                        update('category', value);
                        if (value !== 'Other') update('customCategory', '');
                      }}
                    />
                  </div>

                  {isOtherCategory && (
                    <FloatingLabelInput
                      id="edit-custom-category"
                      label="Custom category *"
                      value={form.customCategory}
                      onChange={(e) => update('customCategory', e.target.value)}
                      required
                    />
                  )}
                </div>

                <FormField label="Format" htmlFor="edit-format">
                  <div className="flex rounded-sm border border-gray-300 dark:border-slate-700 p-1 bg-white dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => update('isOnline', false)}
                      className={`flex-1 rounded-sm py-1.5 text-xs font-bold transition-all ${!form.isOnline ? 'bg-orange-50 dark:bg-[#2DD4BF]/10 text-[#007A78] dark:text-[#2DD4BF]' : 'text-slate-500 dark:text-slate-400'
                        }`}
                    >
                      In-person
                    </button>
                    <button
                      type="button"
                      onClick={() => update('isOnline', true)}
                      className={`flex-1 rounded-sm py-1.5 text-xs font-bold transition-all ${form.isOnline ? 'bg-orange-50 dark:bg-[#2DD4BF]/10 text-[#007A78] dark:text-[#2DD4BF]' : 'text-slate-500 dark:text-slate-400'
                        }`}
                    >
                      Online
                    </button>
                  </div>
                </FormField>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Start date *" htmlFor="edit-date">
                    <div className="relative">
                      <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" />
                      <DatePicker
                        id="edit-date"
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

                  <FormField label={req.endDate ? 'End date *' : 'End date'} htmlFor="edit-end-date">
                    <div className="relative">
                      <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" />
                      <DatePicker
                        id="edit-end-date"
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

                <FormField label="Time *" htmlFor="edit-time">
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
                      id="edit-venue"
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

                <FloatingLabelTextArea
                  id="edit-description"
                  label={req.description ? 'Description *' : 'Description'}
                  rows={4}
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  required={req.description}
                />
              </CardContent>
            </Card>

            <Card className="shadow-sm border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
                  {form.registrationMode === 'tickets' ? 'Ticket tiers' : 'RSVP details'}
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
                      id="edit-rsvp-link"
                      label="Registration link (Google Form, Typeform, etc.) *"
                      value={form.rsvpLink}
                      onChange={(e) => update('rsvpLink', e.target.value)}
                      required
                    />
                    {form.rsvpLink.trim().length > 0 && !isValidUrl(form.rsvpLink) && (
                      <p className="text-xs text-red-500 dark:text-red-400">Enter a valid link starting with http:// or https://</p>
                    )}
                    <FloatingLabelInput
                      id="edit-rsvp-button-label"
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

            <Card className="shadow-sm border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Past events gallery</CardTitle>
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
        </div>

        {/* Footer actions */}
        <div className="flex shrink-0 justify-end gap-3 border-t border-slate-300 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-3">
          <button
            onClick={onClose}
            className="rounded-sm border border-gray-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isSavable}
            className="rounded-sm bg-[#007A78] dark:bg-[#2DD4BF] px-4 py-2 text-sm font-semibold text-white dark:text-slate-950 hover:bg-[#006361] dark:hover:bg-[#22b8a5] disabled:opacity-40"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditEventModal;