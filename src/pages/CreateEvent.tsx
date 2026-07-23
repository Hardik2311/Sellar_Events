import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import FormField from '../components/ui/FormField';
import {
  FloatingLabelInput,
  FloatingLabelSelect,
  FloatingLabelTextArea,
} from '../components/ui/AuthUIComponents'
import ImageUploadBox from '../components/ui/ImageUploadBox';
import TicketTierEditor from '../components/TicketTierEditor';
import { EVENT_CATEGORIES, type EventFormState, type TicketTierDraft } from '../types/event.types';
import { compressImageToTargetSize } from '../lib/imageCompression'

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
};

// TODO — backend wiring:
// Replace handlePublish/handleSaveDraft with real calls once the API
// is ready, e.g. POST /events with status: 'draft' | 'published'.
// This component only manages local form state for now.

const CreateEvent: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<EventFormState>(INITIAL_STATE);
  const [isCompressingImage, setIsCompressingImage] = useState(false);

  const update = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const isOtherCategory = form.category === 'Other';

  const isPublishable =
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

  const handleSaveDraft = () => {
    console.log('Save as draft:', form); // TODO: POST { ...form, status: 'draft' }
    navigate('/events');
  };

  const handlePublish = () => {
    if (!isPublishable) return;
    console.log('Publish event:', form); // TODO: POST { ...form, status: 'published' }
    navigate('/events');
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-100 mb-16">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-300 bg-gray-100 p-2">
        <button
          onClick={() => navigate('/events')}
          className="p-2 rounded-sm border border-slate-400 hover:bg-slate-200 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 text-center flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold text-slate-800">Create Event</h1>
          <p className="text-sm text-slate-500">Fill in the details, add tickets, then publish</p>
        </div>
        <div className="w-9" /> {/* balances the back button so the title stays centered */}
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
                label="Event title"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
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
                      className={`flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors ${
                        !form.isOnline ? 'bg-orange-50 text-[#F97316]' : 'text-gray-500'
                      }`}
                    >
                      In-person
                    </button>
                    <button
                      type="button"
                      onClick={() => update('isOnline', true)}
                      className={`flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors ${
                        form.isOnline ? 'bg-orange-50 text-[#F97316]' : 'text-gray-500'
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
                    label="Custom category"
                    value={form.customCategory}
                    onChange={(e) => update('customCategory', e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">Tell us what kind of event this is</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <FloatingLabelInput
                  id="date"
                  label="Start date"
                  type="date"
                  value={form.date}
                  onChange={(e) => {
                    const value = e.target.value;
                    update('date', value);
                    // keep end date valid if it's now before the new start date
                    if (form.endDate && form.endDate < value) update('endDate', value);
                  }}
                />
                <FloatingLabelInput
                  id="end-date"
                  label="End date"
                  type="date"
                  min={form.date || undefined}
                  value={form.endDate}
                  onChange={(e) => update('endDate', e.target.value)}
                />
              </div>

              <FloatingLabelInput
                id="time"
                label="Time"
                type="time"
                value={form.time}
                onChange={(e) => update('time', e.target.value)}
              />

              {!form.isOnline && (
                <div>
                  <FloatingLabelInput
                    id="venue"
                    label="Venue"
                    value={form.venue}
                    onChange={(e) => update('venue', e.target.value)}
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

          {/* Ticket tiers */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-900">Ticket tiers</CardTitle>
            </CardHeader>
            <CardContent>
              <TicketTierEditor tiers={form.tiers} onChange={(tiers) => update('tiers', tiers)} />
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
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 md:left-48 border-t border-gray-200 bg-white p-3 flex justify-center gap-3 z-30">
        <div className="w-full max-w-3xl flex gap-3">
          <button
            onClick={handleSaveDraft}
            className="flex-1 rounded-md border border-gray-300 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Save as draft
          </button>
          <button
            onClick={handlePublish}
            disabled={!isPublishable}
            className="flex-1 rounded-md bg-[#F97316] py-2 text-sm font-semibold text-white hover:bg-[#ea580c] disabled:opacity-40 disabled:hover:bg-[#F97316] transition-colors"
          >
            Preview & publish
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateEvent;