import React, { useState } from 'react';
import { X, Users, Minus, Plus, Mail, Phone, Ticket } from 'lucide-react';
import type { Attendee } from '../types/attendee.types';

interface GroupCheckInModalProps {
  /** Non-cancelled tickets in the booking group, lead ticket first. */
  members: Attendee[] | null;
  /** Pre-selected "arrived" count when the modal opens. */
  initialArrived: number;
  onConfirm: (arrivedCount: number) => void;
  onCancel: () => void;
}

// Partial check-in for a group booking (one QR, several tickets): staff set how
// many people from the group have arrived so far, from 0 up to the group size.
const GroupCheckInModal: React.FC<GroupCheckInModalProps> = ({ members, initialArrived, onConfirm, onCancel }) => {
  if (!members || members.length === 0) return null;
  return <GroupCheckInBody key={members[0].id} members={members} initialArrived={initialArrived} onConfirm={onConfirm} onCancel={onCancel} />;
};

const GroupCheckInBody: React.FC<GroupCheckInModalProps & { members: Attendee[] }> = ({
  members,
  initialArrived,
  onConfirm,
  onCancel,
}) => {
  const total = members.length;
  const alreadyArrived = members.filter((m) => m.status === 'checked_in').length;
  const [arrived, setArrived] = useState(Math.min(Math.max(initialArrived, 0), total));
  const lead = members[0];

  const tierCounts = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.tierName] = (acc[m.tierName] ?? 0) + 1;
    return acc;
  }, {});

  const delta = arrived - alreadyArrived;
  const confirmLabel =
    delta === 0 ? 'No change' : delta > 0 ? `Check in ${delta} more` : `Undo ${Math.abs(delta)} check-in${Math.abs(delta) === 1 ? '' : 's'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-sm bg-white shadow-xl dark:bg-[#1E293B]">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-[#007A78] dark:text-[#2DD4BF]" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Group check-in</h2>
          </div>
          <button onClick={onCancel} className="rounded-sm p-1 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{lead.name}</p>
            <p className="text-xs font-semibold text-[#007A78] dark:text-[#2DD4BF]">
              {Object.entries(tierCounts).map(([tier, n]) => `${tier} × ${n}`).join(' · ')}
            </p>
          </div>

          <div className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
            {lead.email && (
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-slate-400" /> {lead.email}
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-slate-400" /> {lead.phone}
              </div>
            )}
            <div className="flex items-start gap-2">
              <Ticket size={14} className="mt-0.5 shrink-0 text-slate-400" />
              <span className="break-words text-xs">{members.map((m) => m.ticketId).join(', ')}</span>
            </div>
          </div>

          <div className="rounded-sm border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-center text-xs font-bold text-slate-500 dark:text-slate-400">How many have arrived so far?</p>
            <div className="mt-2 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setArrived((n) => Math.max(0, n - 1))}
                disabled={arrived === 0}
                aria-label="One fewer"
                className="flex h-10 w-10 items-center justify-center rounded-sm border border-slate-300 text-slate-700 transition-colors hover:bg-white disabled:opacity-30 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Minus size={16} />
              </button>
              <p className="min-w-[88px] text-center text-2xl font-extrabold text-slate-900 dark:text-white">
                {arrived} <span className="text-base font-bold text-slate-400">/ {total}</span>
              </p>
              <button
                type="button"
                onClick={() => setArrived((n) => Math.min(total, n + 1))}
                disabled={arrived === total}
                aria-label="One more"
                className="flex h-10 w-10 items-center justify-center rounded-sm border border-slate-300 text-slate-700 transition-colors hover:bg-white disabled:opacity-30 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="mt-2 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setArrived(total)}
                className="rounded-sm px-2 py-1 text-[11px] font-bold text-[#007A78] hover:bg-white dark:text-[#2DD4BF] dark:hover:bg-slate-800"
              >
                All {total} arrived
              </button>
            </div>
            <p className="mt-1 text-center text-[11px] text-slate-500 dark:text-slate-400">
              Previously checked in: {alreadyArrived} of {total}
            </p>
          </div>
        </div>

        <div className="flex gap-2 border-t border-gray-200 px-4 py-3 dark:border-slate-700">
          <button
            onClick={onCancel}
            className="flex-1 rounded-sm border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(arrived)}
            disabled={delta === 0}
            className="flex-1 rounded-sm bg-[#007A78] px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-[#2DD4BF] dark:text-slate-900"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupCheckInModal;
