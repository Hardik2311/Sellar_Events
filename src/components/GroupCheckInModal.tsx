import React, { useEffect, useId, useRef, useState } from 'react';
import { X, Users, CheckCircle2, ChevronDown } from 'lucide-react';
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

// Check-in for tickets bought together. The list is split in two so staff
// never confuse who is already inside with who is arriving now:
//   - "Not checked in yet": checkboxes; the scanned QR's tickets start ticked.
//   - "Already checked in": green, ticked; untick someone to check them out.
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

  const total = members.length;
  const alreadyIn = members.filter((m) => m.status === 'checked_in');
  const pending = members.filter((m) => m.status !== 'checked_in');

  // Pending tickets to check in now, and already-in tickets to check out.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(pending.filter((m) => focusSet.has(m.id)).map((m) => m.id))
  );
  const [checkOut, setCheckOut] = useState<Set<string>>(() => new Set());
  // Collapsed while there are people to check in, so the list stays about them.
  const [showCheckedIn, setShowCheckedIn] = useState(pending.length === 0);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const toggleIn = (set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    set((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toCheckIn = selected.size;
  const toCheckOut = checkOut.size;
  const allPendingSelected = pending.length > 0 && toCheckIn === pending.length;
  const allDone = pending.length === 0 && toCheckOut === 0;

  const confirm = () =>
    onConfirm(new Set([...alreadyIn.filter((m) => !checkOut.has(m.id)).map((m) => m.id), ...selected]));

  const confirmLabel =
    toCheckIn === 0 && toCheckOut === 0
      ? 'Select who is here'
      : [toCheckIn > 0 && `Check in ${toCheckIn}`, toCheckOut > 0 && `Check out ${toCheckOut}`].filter(Boolean).join(', ');

  const sectionHeading = 'text-[11px] font-bold uppercase tracking-wide';

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
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 pt-3 pb-3 dark:border-slate-800">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <Users size={18} className="mt-0.5 shrink-0 text-[#007A78] dark:text-[#2DD4BF]" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 id={`${uid}-title`} className="text-base font-semibold text-slate-900 dark:text-white">
                Booked together
              </h2>
              <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">{alreadyIn.length} of {total}</span> checked in
                {pending.length > 0 && ` · ${pending.length} still to come`}
              </p>
              <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={alreadyIn.length}
                aria-label="Checked in"
              >
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(alreadyIn.length / total) * 100}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-3">
          {pending.length > 0 ? (
            <fieldset aria-labelledby={`${uid}-pending`}>
              <div className="flex items-center justify-between gap-3 pb-1.5">
                <p id={`${uid}-pending`} className={`${sectionHeading} text-slate-700 dark:text-slate-300`}>
                  Not checked in yet · {pending.length}
                </p>
                <button
                  type="button"
                  onClick={() => setSelected(allPendingSelected ? new Set() : new Set(pending.map((m) => m.id)))}
                  className={`rounded-sm px-1.5 py-1 text-xs font-semibold text-[#007A78] hover:bg-[#007A78]/5 dark:text-[#2DD4BF] dark:hover:bg-[#2DD4BF]/10 ${FOCUS_RING}`}
                >
                  {allPendingSelected ? 'Clear' : `Select all ${pending.length}`}
                </button>
              </div>
              <p className="pb-2 text-xs text-slate-500 dark:text-slate-400">Tick everyone who is here now.</p>
              <ul className="flex flex-col gap-1.5">
                {pending.map((m) => {
                  const checked = selected.has(m.id);
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
                          onChange={() => toggleIn(setSelected, m.id)}
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
                          </span>
                        </span>
                        <span className={`max-w-[40%] shrink-0 truncate rounded-sm border px-2 py-1 text-xs font-bold ${tierStyle(m.tierName)}`}>
                          {m.tierName}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ) : (
            <div className="flex items-center gap-2.5 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-400/30 dark:bg-emerald-400/10">
              <CheckCircle2 size={20} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                All {total} in this booking are already checked in.
              </p>
            </div>
          )}

          {alreadyIn.length > 0 && (
            <section className={pending.length > 0 ? 'mt-4' : 'mt-3'}>
              <button
                type="button"
                onClick={() => setShowCheckedIn((v) => !v)}
                aria-expanded={showCheckedIn}
                className={`flex w-full items-center justify-between gap-2 rounded-sm py-1 text-emerald-700 dark:text-emerald-400 ${FOCUS_RING}`}
              >
                <span className={sectionHeading}>
                  Already checked in · {alreadyIn.length}
                  {toCheckOut > 0 && <span className="ml-1 text-amber-700 dark:text-amber-400">({toCheckOut} to check out)</span>}
                </span>
                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className={`shrink-0 transition-transform ${showCheckedIn ? 'rotate-180' : ''}`}
                />
              </button>
              {showCheckedIn && (
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {alreadyIn.map((m) => {
                    const checkingOut = checkOut.has(m.id);
                    const time = formatTime(m.checkedInAt);
                    return (
                      <li key={m.id}>
                        <label
                          className={`flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-emerald-500/30 ${checkingOut
                            ? 'border-amber-300 bg-amber-50 dark:border-amber-400/40 dark:bg-amber-400/10'
                            : 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-400/25 dark:bg-emerald-400/10'
                            }`}
                        >
                          {/* Ticked = checked in; untick to check this person out. */}
                          <input
                            type="checkbox"
                            checked={!checkingOut}
                            onChange={() => toggleIn(setCheckOut, m.id)}
                            className="h-4 w-4 shrink-0 rounded border-gray-300 bg-white accent-emerald-600 [color-scheme:light]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-sm font-medium ${checkingOut ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>
                              {m.name || 'Unnamed'}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                              <span className="font-mono">{m.ticketId}</span>
                              <span
                                className={`shrink-0 text-[11px] font-semibold tabular-nums ${checkingOut ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}
                              >
                                {checkingOut ? 'Will check out' : time ? `In at ${time}` : 'Checked in'}
                              </span>
                            </span>
                          </span>
                          <span className={`max-w-[40%] shrink-0 truncate rounded-sm border px-2 py-1 text-xs font-bold ${tierStyle(m.tierName)}`}>
                            {m.tierName}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-200 px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-800">
          {allDone ? (
            <button
              type="button"
              onClick={onCancel}
              className={`flex-1 rounded-sm bg-[#007A78] py-2 text-sm font-semibold text-white transition-colors hover:bg-[#006361] dark:bg-[#2DD4BF] dark:text-slate-950 dark:hover:bg-[#22b8a5] ${FOCUS_RING}`}
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onCancel}
                className={`flex-1 rounded-sm border border-slate-300 bg-white py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ${FOCUS_RING}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={toCheckIn === 0 && toCheckOut === 0}
                className={`flex-[1.4] whitespace-nowrap rounded-sm bg-[#007A78] py-2 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-[#006361] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 dark:bg-[#2DD4BF] dark:text-slate-950 dark:hover:bg-[#22b8a5] ${FOCUS_RING}`}
              >
                {confirmLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupCheckInModal;
