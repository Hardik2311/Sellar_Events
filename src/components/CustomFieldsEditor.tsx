import React, { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import type { CustomField, CustomFieldType } from '../types/event.types';

interface CustomFieldsEditorProps {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
}

const createEmptyField = (): CustomField => ({
  id: `field-${Date.now()}`,
  label: '',
  type: 'text',
  required: false,
});

const CustomFieldsEditor: React.FC<CustomFieldsEditorProps> = ({ fields, onChange }) => {
  // Raw text typed in the "options" box per field — kept separate from
  // field.options so a trailing/typed comma doesn't get stripped mid-typing.
  const [optionsDraft, setOptionsDraft] = useState<Record<string, string>>({});

  const updateField = (id: string, patch: Partial<CustomField>) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeField = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
  };

  const addField = () => {
    onChange([...fields, createEmptyField()]);
  };

  const moveField = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-slate-500">
        Ask attendees extra questions at checkout — like a mini form (t-shirt size, dietary preference, emergency contact, etc).
      </p>

      {fields.map((field, index) => (
        <div
          key={field.id}
          className="rounded-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 space-y-2"
        >
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => moveField(index, -1)}
              disabled={index === 0}
              className="mt-2 text-slate-400 hover:text-slate-600 disabled:opacity-30 cursor-grab"
              title="Reorder"
            >
              <GripVertical size={14} />
            </button>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={field.label}
                onChange={(e) => updateField(field.id, { label: e.target.value })}
                placeholder="Question label (e.g. T-shirt size)"
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-[#007A78] focus:ring-1 focus:ring-[#007A78]"
              />
              <select
                value={field.type}
                onChange={(e) => updateField(field.id, { type: e.target.value as CustomFieldType })}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-[#007A78] focus:ring-1 focus:ring-[#007A78]"
              >
                <option value="text">Short text</option>
                <option value="textarea">Long text</option>
                <option value="select">Dropdown</option>
                <option value="checkbox">Checkbox</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => removeField(field.id)}
              className="mt-2 text-red-400 hover:text-red-600"
              title="Remove question"
            >
              <Trash2 size={16} />
            </button>
          </div>

                    {field.type === 'select' && (
            <input
              type="text"
              value={optionsDraft[field.id] ?? field.options?.join(', ') ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                // Keep the raw text as-is while typing (commas, trailing
                // spaces, empty trailing entries — all allowed here).
                setOptionsDraft((d) => ({ ...d, [field.id]: raw }));
              }}
              onBlur={(e) => {
                const parsed = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                updateField(field.id, { options: parsed });
                // Drop the draft so the input falls back to the clean,
                // normalized value derived from field.options.
                setOptionsDraft((d) => {
                  const next = { ...d };
                  delete next[field.id];
                  return next;
                });
              }}
              placeholder="Options, comma separated (e.g. S, M, L, XL)"
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-[#007A78] focus:ring-1 focus:ring-[#007A78]"
            />
          )}

          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => updateField(field.id, { required: e.target.checked })}
              className="h-4 w-4 appearance-none rounded-sm border border-slate-400 bg-white checked:bg-[#007A78] checked:border-[#007A78] relative cursor-pointer checked:after:content-['✓'] checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-white checked:after:text-[10px] checked:after:font-bold"
            />
            Required
          </label>
        </div>
      ))}

      <button
        type="button"
        onClick={addField}
        className="flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 dark:border-slate-600 px-3 py-2 text-xs font-semibold text-[#007A78] dark:text-[#2DD4BF] hover:bg-orange-50 dark:hover:bg-[#2DD4BF]/10 w-full justify-center"
      >
        <Plus size={14} /> Add question
      </button>
    </div>
  );
};

export default CustomFieldsEditor;