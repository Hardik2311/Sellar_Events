import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import FormField from './ui/FormField';
import {
  FloatingLabelInput,
  FloatingLabelSelect,
  FloatingLabelTextArea,
} from './ui/AuthUIComponents';
import ImageUploadBox from './ui/ImageUploadBox';
import TicketTierEditor from './TicketTierEditor';
import { EVENT_CATEGORIES,type EventCategory, type EventFormState, type TicketTierDraft } from '../types/event.types';
import { compressImageToTargetSize } from '../lib/imageCompression';
import type { MOCK_EVENTS } from '../data/mockEvents';

type EventItem = (typeof MOCK_EVENTS)[number];

interface EditEventModalProps {
  event: EventItem;
  onClose: () => void;
  onSave: (updated: EventFormState) => void;
}

// TODO — backend wiring:
// onSave currently just hands the edited form back to the parent, which
// updates local state. Replace with PATCH /events/:id once the API is ready.
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
  coverImagePreview: event.coverImage ?? null,
  tiers: event.tiers.map((t): TicketTierDraft => ({
    id: t.id,
    name: t.name,
    price: t.price,
    quantity: t.quantity,
  })),
  promoCode: '',
  promoDiscountPercent: 0,
});

const EditEventModal: React.FC<EditEventModalProps> = ({ event, onClose, onSave }) => {
  const [form, setForm] = useState<EventFormState>(() => toFormState(event));
  const [isCompressingImage, setIsCompressingImage] = useState(false);

  const update = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const isOtherCategory = form.category === 'Other';

  const isSavable =
    form.title.trim().length > 0 &&
    form.date &&
    form.endDate &&
    form.endDate >= form.date &&
    (form.isOnline || form.venue.trim().length > 0) &&
    (!isOtherCategory || form.customCategory.trim().length > 0);

  const handleCoverImageChange = async (preview: string | null) => {
    if (!preview) {
      update('coverImagePreview', null);
      return;
    }
    setIsCompressingImage(true);
    try {
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
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-gray-100 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-300 bg-white p-3">
          <h2 className="text-lg font-bold text-slate-800">Edit event</h2>
          <button
            onClick={onClose}
            className="rounded-sm p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="grow overflow-y-auto p-3">
          <div className="flex flex-col gap-3">
            <Card className="shadow-sm border-gray-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900">Event details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Cover image</p>
                  <ImageUploadBox preview={form.coverImagePreview} onChange={handleCoverImageChange} />
                  {isCompressingImage && (
                    <p className="text-xs text-gray-500 mt-1">Compressing image…</p>
                  )}
                </div>

                <FloatingLabelInput
                  id="edit-title"
                  label="Event title"
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                  <FormField label="Format" htmlFor="edit-format">
                    <div className="flex rounded-md border border-gray-300 p-1 bg-white">
                      <button
                        type="button"
                        onClick={() => update('isOnline', false)}
                        className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                          !form.isOnline ? 'bg-[#007A78]/10 text-[#007A78] dark:bg-[#2DD4BF]/15 dark:text-[#2DD4BF]' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        In-person
                      </button>
                      <button
                        type="button"
                        onClick={() => update('isOnline', true)}
                        className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                          form.isOnline ? 'bg-[#007A78]/10 text-[#007A78] dark:bg-[#2DD4BF]/15 dark:text-[#2DD4BF]' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        Online
                      </button>
                    </div>
                  </FormField>
                </div>

                {isOtherCategory && (
                  <FloatingLabelInput
                    id="edit-custom-category"
                    label="Custom category"
                    value={form.customCategory}
                    onChange={(e) => update('customCategory', e.target.value)}
                  />
                )}

                <div className="grid grid-cols-2 gap-3">
                  <FloatingLabelInput
                    id="edit-date"
                    label="Start date"
                    type="date"
                    value={form.date}
                    onChange={(e) => {
                      const value = e.target.value;
                      update('date', value);
                      if (form.endDate && form.endDate < value) update('endDate', value);
                    }}
                  />
                  <FloatingLabelInput
                    id="edit-end-date"
                    label="End date"
                    type="date"
                    min={form.date || undefined}
                    value={form.endDate}
                    onChange={(e) => update('endDate', e.target.value)}
                  />
                </div>

                <FloatingLabelInput
                  id="edit-time"
                  label="Time"
                  type="time"
                  value={form.time}
                  onChange={(e) => update('time', e.target.value)}
                />

                {!form.isOnline && (
                  <FloatingLabelInput
                    id="edit-venue"
                    label="Venue"
                    value={form.venue}
                    onChange={(e) => update('venue', e.target.value)}
                  />
                )}

                <FloatingLabelTextArea
                  id="edit-description"
                  label="Description"
                  rows={4}
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                />
              </CardContent>
            </Card>

            <Card className="shadow-sm border-gray-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900">Ticket tiers</CardTitle>
              </CardHeader>
              <CardContent>
                <TicketTierEditor tiers={form.tiers} onChange={(tiers) => update('tiers', tiers)} />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex shrink-0 justify-end gap-3 border-t border-slate-300 bg-white p-3">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isSavable}
            className="rounded-md bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c] disabled:opacity-40 disabled:hover:bg-[#F97316]"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditEventModal;