import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { TicketTierDraft } from '../types/event.types';
import { TextInput } from './ui/FormField';

interface TicketTierEditorProps {
  tiers: TicketTierDraft[];
  onChange: (tiers: TicketTierDraft[]) => void;
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
export const TicketTierEditor: React.FC<TicketTierEditorProps> = ({ tiers, onChange }) => {
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
        <div key={tier.id} className="flex items-start gap-3 rounded-md border border-gray-200 p-3">
          <span className="shrink-0 h-6 w-6 mt-1.5 rounded-full bg-orange-100 text-[#F97316] flex items-center justify-center text-xs font-bold">
            {index + 1}
          </span>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <TextInput
              placeholder="Tier name (e.g. General)"
              value={tier.name}
              onChange={(e) => updateTier(tier.id, { name: e.target.value })}
            />
            <TextInput
              type="number"
              min={0}
              placeholder="Price (₹)"
              value={tier.price || ''}
              onChange={(e) => updateTier(tier.id, { price: Number(e.target.value) || 0 })}
            />
            <TextInput
              type="number"
              min={1}
              placeholder="Quantity"
              value={tier.quantity || ''}
              onChange={(e) => updateTier(tier.id, { quantity: Number(e.target.value) || 0 })}
            />
          </div>

          <button
            type="button"
            onClick={() => removeTier(tier.id)}
            disabled={tiers.length <= 1}
            className="shrink-0 mt-1.5 p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
            title={tiers.length <= 1 ? 'At least one tier is required' : 'Remove tier'}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addTier}
        className="flex items-center justify-center gap-1.5 w-full rounded-md border border-dashed border-gray-300 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-[#F97316] hover:border-orange-200 transition-colors"
      >
        <Plus size={15} /> Add ticket tier
      </button>
    </div>
  );
};

export default TicketTierEditor;