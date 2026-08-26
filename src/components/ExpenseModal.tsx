import { useState, useEffect } from 'react';
import { EventListCard } from './EventListCard';
import type { EventSummary } from '../types/event.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  events: EventSummary[];
  eventsLoading?: boolean;
  preselectedEventId?: string | null;
  onSave: (data: {
    eventId: string;
    title: string;
    description: string;
    amount: number;
    date: number;
  }) => Promise<void>;
}

export const ExpenseModal = ({ isOpen, onClose, events = [], eventsLoading = false, onSave, preselectedEventId = null }: Props) => {
  const today = new Date().toISOString().split('T')[0];
  const [selectedEventId, setSelectedEventId] = useState<string | null>(preselectedEventId);
  const [eventSearch, setEventSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedEventId(preselectedEventId);
    }
  }, [isOpen, preselectedEventId]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!selectedEventId) return setError('Please select an event.');
    if (!title.trim()) return setError('Title is required.');
    if (!description.trim()) return setError('Description is required.');
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
      return setError('Enter a valid amount.');
    setError('');
    setSaving(true);
    try {
      await onSave({
        eventId: selectedEventId,
        title: title.trim(),
        description: description.trim(),
        amount: Number(amount),
        date: new Date(date).getTime(),
      });
      setTitle('');
      setDescription('');
      setAmount('');
      setDate(today);
      setSelectedEventId(null);
      setEventSearch('');
      onClose();
    } catch {
      setError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[8000] flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-[#1E293B] w-full max-w-sm rounded-sm shadow-xl p-5 border border-slate-200 dark:border-slate-800">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Add Expense</h2>

        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Event</label>
        <div className="mb-3">
          <EventListCard
            events={events}
            selectedEventId={selectedEventId}
            onSelect={setSelectedEventId}
            searchValue={eventSearch}
            onSearchChange={setEventSearch}
            loading={eventsLoading}
          />
        </div>

        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Title</label>
        <input
          type="text"
          placeholder="e.g. Venue Rent, Decoration"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full border border-slate-200 dark:border-slate-700 rounded-sm p-2 text-sm mb-3 bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007A78] dark:focus:ring-[#2DD4BF]"
        />

        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Description</label>
        <input
          type="text"
          placeholder="e.g. Payment for ...."
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="w-full border border-slate-200 dark:border-slate-700 rounded-sm p-2 text-sm mb-3 bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007A78] dark:focus:ring-[#2DD4BF]"
        />

        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Amount (₹)</label>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={e => {
            const val = e.target.value;
            if (val === '' || /^\d*\.?\d*$/.test(val)) setAmount(val);
          }}
          className="w-full border border-slate-200 dark:border-slate-700 rounded-sm p-2 text-sm mb-3 bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007A78] dark:focus:ring-[#2DD4BF]"
        />

        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Date</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full border border-slate-200 dark:border-slate-700 rounded-sm p-2 text-sm mb-4 bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007A78] dark:focus:ring-[#2DD4BF]"
        />

        {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-sm border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-sm text-white dark:text-slate-950 text-sm font-semibold disabled:opacity-50 bg-[#007A78] hover:bg-[#006361] dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5]"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};