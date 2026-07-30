import React from 'react';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}

/**
 * Wraps a single input/select/textarea with a consistent label.
 * Keeps every field in CreateEvent visually identical without
 * repeating the label markup each time.
 */
export const FormField: React.FC<FormFieldProps> = ({ label, htmlFor, hint, children }) => (
  <div>
    <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-500 mb-1">
      {label}
    </label>
    {children}
    {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
  </div>
);

const baseInputClass =
  'w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#007A78]/20 focus:border-[#007A78] dark:focus:ring-[#2DD4BF]/20 dark:focus:border-[#2DD4BF] font-medium transition-all';

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
  <input className={`${baseInputClass} ${className ?? ''}`} {...props} />
);

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className, ...props }) => (
  <textarea className={`${baseInputClass} resize-none ${className ?? ''}`} {...props} />
);

export const SelectInput: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, ...props }) => (
  <select className={`${baseInputClass} ${className ?? ''}`} {...props}>
    {children}
  </select>
);

export default FormField;