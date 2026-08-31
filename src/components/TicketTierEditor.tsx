import React from 'react';
import { Plus, Trash2, Calendar, Clock } from 'lucide-react';
import type { TicketTierDraft } from '../types/event.types';
import { TextInput } from './ui/FormField';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import TimeSelect from './ui/Timeselect';

interface TicketTierEditorProps {
  tiers: TicketTierDraft[];
  onChange: (tiers: TicketTierDraft[]) => void;
  /** When true, shows an editable "dummy remaining" field per tier that is
   *  purely cosmetic and displayed on the public page instead of real quantity. */
  showDummyQuantity?: boolean;
  /** When true, shows End date + End time fields per tier — the tier stops
   *  being shown to customers once that date/time has passed. */
  showEndDateTime?: boolean;
}

const createEmptyTier = (): TicketTierDraft => ({
  id: `tier-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  price: 0,
  quantity: 50,
});

/**
 * Lets an organizer add as many ticket tiers as the event needs
 * (General, VIP, Early Bird, ...). Mirrors the numbered-badge visual
 * language used in TicketTierBreakdown on the dashboard.
 */
export const TicketTierEditor: React.FC<TicketTierEditorProps> = ({
  tiers,
  onChange,
  showDummyQuantity = false,
  showEndDateTime = false,
}) => {
  const toDate = (s?: string) => (s ? new Date(`${s}T00:00:00`) : null);
  const toDateStr = (d: Date | null) => {
    if (!d) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const updateTier = (id: string, patch: Partial<TicketTierDraft>) => {
    onChange(tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const addTier = () => onChange([...tiers, createEmptyTier()]);

  const removeTier = (id: string) => {
    if (tiers.length <= 1) return; // always keep at least one tier
    onChange(tiers.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-3">
      {tiers.map((tier, index) => (
        <div key={tier.id} className="flex items-start gap-3 rounded-sm border border-slate-200 dark:border-slate-800 bg-[#F9FAFB] dark:bg-[#1E293B] p-3.5">
          <span className="shrink-0 h-7 w-7 mt-1.5 rounded-sm bg-[#007A78]/10 text-[#007A78] dark:bg-[#2DD4BF]/15 dark:text-[#2DD4BF] flex items-center justify-center text-xs font-black">
            {index + 1}
          </span>

          <div className="flex-1 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Tier Name</label>
                <TextInput
                  placeholder="e.g. General Admission"
                  value={tier.name}
                  onChange={(e) => updateTier(tier.id, { name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Price (₹)</label>
                <TextInput
                  type="number"
                  min={0}
                  placeholder="e.g. 500"
                  value={tier.price || ''}
                  onChange={(e) => updateTier(tier.id, { price: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Quantity</label>
                <TextInput
                  type="number"
                  min={1}
                  placeholder="e.g. 100"
                  value={tier.quantity || ''}
                  onChange={(e) => updateTier(tier.id, { quantity: Number(e.target.value) || 0 })}
                />
              </div>
            </div>

            {showDummyQuantity && (
              <div className="flex items-center gap-3 rounded-sm border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">
                    Dummy remaining (shown publicly)
                  </label>
                  <TextInput
                    type="number"
                    min={0}
                    placeholder="Leave blank to show the real quantity"
                    value={tier.dummyRemaining ?? ''}
                    onChange={(e) =>
                      updateTier(tier.id, {
                        dummyRemaining: e.target.value === '' ? undefined : Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            )}

            {showEndDateTime && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-3 py-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Tier end date
                  </label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" />
                    <DatePicker
                      selected={toDate(tier.tierEndDate)}
                      onChange={(d: Date | null) => updateTier(tier.id, { tierEndDate: toDateStr(d) || undefined })}
                      minDate={new Date()}
                      dateFormat="dd/MM/yyyy"
                      placeholderText="Select date"
                      wrapperClassName="w-full block"
                      popperClassName="react-datepicker-popper-custom"
                      popperPlacement="bottom-start"
                      showPopperArrow={false}
                      isClearable
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm py-2 pl-9 pr-3 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-[#2DD4BF]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Tier end time
                  </label>
                  <div className="flex items-center gap-2 rounded-sm border border-slate-300 dark:border-slate-600 px-2.5 py-2 bg-white dark:bg-slate-800">
                    <Clock size={14} className="text-gray-400 shrink-0" />
                    <TimeSelect
                      value={tier.tierEndTime ? tier.tierEndTime.split(':')[0] : '00'}
                      options={Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))}
                      onChange={(h) => updateTier(tier.id, { tierEndTime: `${h}:${tier.tierEndTime?.split(':')[1] || '00'}` })}
                    />
                    <span className="text-slate-400">:</span>
                    <TimeSelect
                      value={tier.tierEndTime ? tier.tierEndTime.split(':')[1] : '00'}
                      options={Array.from({ length: 60 }, (_, m) => String(m).padStart(2, '0'))}
                      onChange={(m) => updateTier(tier.id, { tierEndTime: `${tier.tierEndTime?.split(':')[0] || '00'}:${m}` })}
                    />
                  </div>
                </div>
                <p className="sm:col-span-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Optional — leave blank to keep this tier available for the whole event. Once this date/time passes, the tier is hidden from customers.
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => removeTier(tier.id)}
            disabled={tiers.length <= 1}
            className="shrink-0 mt-1.5 p-2 rounded-sm text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
            title={tiers.length <= 1 ? 'At least one tier is required' : 'Remove tier'}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addTier}
        className="flex items-center justify-center gap-1.5 w-full rounded-sm border border-dashed border-slate-300 dark:border-slate-700 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-[#007A78]/5 hover:text-[#007A78] dark:hover:text-[#2DD4BF] hover:border-[#007A78]/50 transition-all"
      >
        <Plus size={16} /> Add Ticket Tier
      </button>
    </div>
  );
};

export default TicketTierEditor;