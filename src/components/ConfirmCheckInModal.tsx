import React from 'react';
import { X, UserCheck, Mail, Phone, Ticket } from 'lucide-react';
import type { Attendee } from '../types/attendee.types';

interface ConfirmCheckInModalProps {
  attendee: Attendee | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmCheckInModal: React.FC<ConfirmCheckInModalProps> = ({ attendee, onConfirm, onCancel }) => {
  if (!attendee) return null;

  const alreadyCheckedIn = attendee.status === 'checked_in';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white dark:bg-[#1E293B] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 px-4 py-3">
          <div className="flex items-center gap-2">
            <UserCheck size={18} className="text-[#007A78] dark:text-[#2DD4BF]" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Confirm check-in</h2>
          </div>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          <div>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{attendee.name}</p>
            <p className="text-xs font-semibold text-[#007A78] dark:text-[#2DD4BF]">{attendee.tierName}</p>
          </div>

          <div className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-slate-400" /> {attendee.email}
            </div>
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-slate-400" /> {attendee.phone}
            </div>
            <div className="flex items-center gap-2">
              <Ticket size={14} className="text-slate-400" /> {attendee.ticketId}
            </div>
          </div>

          {alreadyCheckedIn && (
            <div className="rounded-sm bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
              This attendee is already checked in. Confirming will undo the check-in.
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-gray-200 dark:border-slate-700 px-4 py-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-sm border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-sm bg-[#007A78] dark:bg-[#2DD4BF] px-3 py-2 text-sm font-semibold text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
          >
            {alreadyCheckedIn ? 'Undo check-in' : 'Confirm check-in'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmCheckInModal;