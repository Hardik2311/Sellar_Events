import React from 'react';
import { Bold, Italic } from 'lucide-react';
import type { TextStyleConfig } from '../../types/event.types';

interface TextStyleControlsProps {
  value: TextStyleConfig;
  onChange: (style: TextStyleConfig) => void;
}

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32];

const TextStyleControls: React.FC<TextStyleControlsProps> = ({ value, onChange }) => {
  const update = <K extends keyof TextStyleConfig>(key: K, val: TextStyleConfig[K]) =>
    onChange({ ...value, [key]: val });

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-2 p-1.5 rounded-sm border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 w-fit">
      <select
        value={value.fontSize}
        onChange={(e) => update('fontSize', Number(e.target.value))}
        className="h-8 rounded-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs px-2 text-slate-700 dark:text-slate-200 cursor-pointer"
      >
        {FONT_SIZES.map((size) => (
          <option key={size} value={size}>{size}px</option>
        ))}
      </select>

      <div className="h-6 w-px bg-gray-300 dark:bg-slate-700 mx-0.5" />

      <div className="flex rounded-sm border border-gray-300 dark:border-slate-700 overflow-hidden">
        <button
          type="button"
          onClick={() => update('fontWeight', value.fontWeight === 'bold' ? 'normal' : 'bold')}
          className={`h-8 w-8 flex items-center justify-center transition-colors ${
            value.fontWeight === 'bold'
              ? 'bg-orange-50 dark:bg-[#2DD4BF]/10 text-[#007A78] dark:text-[#2DD4BF]'
              : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
          }`}
        >
          <Bold size={14} />
        </button>

        <button
          type="button"
          onClick={() => update('fontStyle', value.fontStyle === 'italic' ? 'normal' : 'italic')}
          className={`h-8 w-8 flex items-center justify-center border-l border-gray-300 dark:border-slate-700 transition-colors ${
            value.fontStyle === 'italic'
              ? 'bg-orange-50 dark:bg-[#2DD4BF]/10 text-[#007A78] dark:text-[#2DD4BF]'
              : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
          }`}
        >
          <Italic size={14} />
        </button>
      </div>

      <div className="h-6 w-px bg-gray-300 dark:bg-slate-700 mx-0.5" />

      <input
        type="color"
        value={value.color}
        onChange={(e) => update('color', e.target.value)}
        className="h-8 w-8 rounded-sm border border-gray-300 dark:border-slate-700 cursor-pointer bg-white dark:bg-slate-800 p-0.5"
        title="Text color"
      />
    </div>
  );
};

export default TextStyleControls;