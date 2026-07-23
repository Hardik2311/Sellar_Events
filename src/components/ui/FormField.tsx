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
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#F97316] focus:border-[#F97316]';

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