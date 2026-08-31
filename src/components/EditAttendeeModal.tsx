import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Attendee } from '../types/attendee.types';

interface EditAttendeeModalProps {
  attendee: Attendee | null;
  onSave: (id: string, updates: Pick<Attendee, 'name' | 'email' | 'phone' | 'tierName'>) => void;
  onCancel: () => void;
}

const EditAttendeeModal: React.FC<EditAttendeeModalProps> = ({ attendee, onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [tierName, setTierName] = useState('');

  // Reset the form whenever a new attendee is opened for editing
  useEffect(() => {
    if (attendee) {
      setName(attendee.name);
      setEmail(attendee.email);
      setPhone(attendee.phone);
      setTierName(attendee.tierName);
    }
  }, [attendee]);

  if (!attendee) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim()) return;
    onSave(attendee.id, { name: name.trim(), email: email.trim(), phone: phone.trim(), tierName: tierName.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-sm bg-white dark:bg-slate-900 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Edit Attendee</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-sm border border-slate-200 dark:border-slate-700 bg-[#F9FAFB] dark:bg-slate-800 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-sm border border-slate-200 dark:border-slate-700 bg-[#F9FAFB] dark:bg-slate-800 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-sm border border-slate-200 dark:border-slate-700 bg-[#F9FAFB] dark:bg-slate-800 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Tier Name</label>
            <input
              value={tierName}
              onChange={(e) => setTierName(e.target.value)}
              className="mt-1 w-full rounded-sm border border-slate-200 dark:border-slate-700 bg-[#F9FAFB] dark:bg-slate-800 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-sm border border-slate-200 dark:border-slate-700 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-sm bg-[#007A78] hover:bg-[#006361] dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5] py-2.5 text-xs font-bold text-white dark:text-slate-950"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditAttendeeModal;