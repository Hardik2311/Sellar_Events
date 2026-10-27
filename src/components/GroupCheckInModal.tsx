import React, { useEffect, useId, useRef, useState } from 'react';
import { X, Users } from 'lucide-react';
import type { Attendee } from '../types/attendee.types';

interface GroupCheckInModalProps {
  /** Non-cancelled tickets booked together (one order), in display order. */
  members: Attendee[] | null;
  /** Tickets the scanned QR / tapped row admits; pre-ticked and tagged. */
  focusIds: string[];
  /** Event's tier names in order, so each tier keeps the same colour. */
  tierOrder?: string[];
  /** Receives the ids that should end up checked in. */
  onConfirm: (checkedInIds: Set<string>) => void;
  onCancel: () => void;
}

// One colour per tier (by its position in the event), so staff can tell
// General from VIP at a glance. Cycles if an event has more tiers.
const TIER_STYLES = [
  'border-[#007A78]/30 bg-[#007A78]/10 text-[#00605E] dark:border-[#2DD4BF]/30 dark:bg-[#2DD4BF]/15 dark:text-[#5EEAD4]',
  'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-400/30 dark:bg-violet-400/15 dark:text-violet-200',
  'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-200',
  'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-400/30 dark:bg-sky-400/15 dark:text-sky-200',
  'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/15 dark:text-rose-200',
];

const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-[#007A78]/40 dark:focus-visible:ring-[#2DD4BF]/40';

const formatTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null;

// Check-in for tickets bought together: every ticket is listed by name, so
// staff tick exactly who is at the gate (or "Select all") and confirm once.
const GroupCheckInModal: React.FC<GroupCheckInModalProps> = ({ members, ...rest }) => {
  if (!members || members.length === 0) return null;
  return <GroupCheckInBody key={members.map((m) => m.id).join()} members={members} {...rest} />;
};

const GroupCheckInBody: React.FC<GroupCheckInModalProps & { members: Attendee[] }> = ({
  members,
  focusIds,
  tierOrder = [],
  onConfirm,
  onCancel,
}) => {
  // Event order first; tiers missing from it (renamed/old) follow in booking order.
  const tierNames = Array.from(new Set([...tierOrder, ...members.map((m) => m.tierName)]));
  const tierStyle = (name: string) => TIER_STYLES[Math.max(0, tierNames.indexOf(name)) % TIER_STYLES.length];
  const tierCounts = tierNames
    .map((name) => ({ name, count: members.filter((m) => m.tierName === name).length }))
    .filter((t) => t.count > 0);
  const uid = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const focusSet = new Set(focusIds);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(members.filter((m) => m.status === 'checked_in' || focusSet.has(m.id)).map((m) => m.id))
  );

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const total = members.length;
  const alreadyIn = members.filter((m) => m.status === 'checked_in');
  const toCheckIn = members.filter((m) => m.status !== 'checked_in' && selected.has(m.id)).length;
  const toUndo = alreadyIn.filter((m) => !selected.has(m.id)).length;
  const allSelected = selected.size === total;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const confirmLabel =
    toCheckIn === 0 && toUndo === 0
      ? 'No changes'
      : [toCheckIn > 0 && `Check in ${toCheckIn}`, toUndo > 0 && `Undo ${toUndo}`].filter(Boolean).join(', ');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
        className="flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-sm bg-white shadow-[0_24px_64px_-16px_rgba(15,23,42,0.35)] outline-none sm:max-w-sm sm:rounded-sm dark:bg-slate-900"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 pt-3 pb-2.5 dark:border-slate-800">
          <div className="flex min-w-0 items-start gap-2">
            <Users size={18} className="mt-0.5 shrink-0 text-[#007A78] dark:text-[#2DD4BF]" aria-hidden="true" />
            <div className="min-w-0">
              <h2 id={`${uid}-title`} className="text-base font-semibold text-slate-900 dark:text-white">
                Booked together
              </h2>
              <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {total} tickets · {alreadyIn.length} already checked in
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {tierCounts.map((t) => (
                  <span
                    key={t.name}
                    className={`rounded-sm border px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${tierStyle(t.name)}`}
                  >
                    {t.count} × {t.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className={`-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${FOCUS_RING}`}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-3 pb-1.5">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Tick everyone who is here</p>
          <button
            type="button"
            onClick={() => setSelected(allSelected ? new Set(alreadyIn.map((m) => m.id)) : new Set(members.map((m) => m.id)))}
            className={`rounded-sm px-1.5 py-1 text-xs font-semibold text-[#007A78] hover:bg-[#007A78]/5 dark:text-[#2DD4BF] dark:hover:bg-[#2DD4BF]/10 ${FOCUS_RING}`}
          >
            {allSelected ? 'Clear' : `Select all ${total}`}
          </button>
        </div>

        <fieldset className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3">
          <legend className="sr-only">Tickets in this booking</legend>
          <ul className="flex flex-col gap-1.5">
            {members.map((m) => {
              const checked = selected.has(m.id);
              const wasIn = m.status === 'checked_in';
              const time = formatTime(m.checkedInAt);
              return (
                <li key={m.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-[#007A78]/30 ${checked
                      ? 'border-[#007A78] bg-[#007A78]/5 dark:border-[#2DD4BF] dark:bg-[#2DD4BF]/10'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50'
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(m.id)}
                      className="h-4 w-4 shrink-0 rounded border-gray-300 bg-white accent-[#007A78] [color-scheme:light]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{m.name || 'Unnamed'}</span>
                      <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono">{m.ticketId}</span>
                        {focusSet.has(m.id) && (
                          <span className="shrink-0 rounded-sm bg-slate-100 px-1 py-px text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            Scanned
                          </span>
                        )}
                        {wasIn && (
                          <span
                            className={`shrink-0 text-[11px] font-semibold tabular-nums ${checked ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}
                          >
                            {checked ? (time ? `In ${time}` : 'In') : 'Will undo'}
                          </span>
                        )}
                      </span>
                    </span>
                    <span
                      className={`max-w-[40%] shrink-0 truncate rounded-sm border px-2 py-1 text-xs font-bold ${tierStyle(m.tierName)}`}
                    >
                      {m.tierName}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <div className="flex shrink-0 gap-2 border-t border-slate-200 px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className={`flex-1 rounded-sm border border-slate-300 bg-white py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ${FOCUS_RING}`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selected)}
            disabled={toCheckIn === 0 && toUndo === 0}
            className={`flex-[1.4] whitespace-nowrap rounded-sm bg-[#007A78] py-2 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-[#006361] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 dark:bg-[#2DD4BF] dark:text-slate-950 dark:hover:bg-[#22b8a5] ${FOCUS_RING}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupCheckInModal;
