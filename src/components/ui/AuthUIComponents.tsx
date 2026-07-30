import React from 'react';
import { FiCalendar } from 'react-icons/fi';

/**
 * Shared, dependency-free UI primitives for the Events project auth flow.
 * No image assets required anywhere — the hero panel below is pure CSS.
 */

// ─── Spinner ─────────────────────────────────────────────────────────────
export const Spinner: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <div
    className="rounded-full border-2 border-white/40 border-t-white animate-spin"
    style={{ width: size, height: size }}
  />
);

// ─── Button ──────────────────────────────────────────────────────────────
type ButtonVariant = 'filled' | 'outline';

export const CustomButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
> = ({ variant = 'filled', className = '', children, ...rest }) => {
  const base =
    'inline-flex items-center justify-center rounded-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
  const styles =
    variant === 'filled'
      ? 'bg-black text-white hover:bg-neutral-800'
      : 'bg-white text-black border border-gray-300 hover:bg-gray-50';
  return (
    <button className={`${base} ${styles} ${className}`} {...rest}>
      {children}
    </button>
  );
};

// ─── Floating label input ───────────────────────────────────────────────
interface FloatingLabelInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: React.ReactNode;
  error?: string | null;
}

export const FloatingLabelInput: React.FC<FloatingLabelInputProps> = ({
  label,
  icon,
  error,
  id,
  className = '',
  ...rest
}) => {
  return (
    <div className="w-full">
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={id}
          placeholder=" "
          className={[
            'peer w-full bg-white border border-[#7D7777A3] rounded-sm shadow-[0_2px_4px_rgba(0,0,0,0.06)]',
            'py-3 text-[15px] text-slate-800 outline-none transition-colors',
            'focus:border-slate-500',
            icon ? 'pl-11 pr-3' : 'px-3',
            className,
          ].join(' ')}
          {...rest}
        />
        <label
          htmlFor={id}
          className={[
            'absolute bg-white px-1 text-gray-400 pointer-events-none transition-all duration-150',
            'top-1/2 -translate-y-1/2 text-[15px]',
            icon ? 'left-11' : 'left-3',
            'peer-focus:top-0 peer-focus:text-xs peer-focus:text-slate-600',
            'peer-[&:not(:placeholder-shown)]:top-0 peer-[&:not(:placeholder-shown)]:text-xs',
          ].join(' ')}
        >
          {label}
        </label>
      </div>
      {error && <p className="text-red-500 text-xs mt-1 mb-0">{error}</p>}
    </div>
  );
};

// ─── Floating label textarea ─────────────────────────────────────────────
interface FloatingLabelTextAreaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string | null;
}

export const FloatingLabelTextArea: React.FC<FloatingLabelTextAreaProps> = ({
  label,
  error,
  id,
  className = '',
  ...rest
}) => {
  return (
    <div className="w-full">
      <div className="relative">
        <textarea
          id={id}
          placeholder=" "
          className={[
            'peer w-full bg-white border border-[#7D7777A3] rounded-sm shadow-[0_2px_4px_rgba(0,0,0,0.06)]',
            'px-3 pt-4 pb-2 text-[15px] text-slate-800 outline-none transition-colors resize-none',
            'focus:border-slate-500',
            className,
          ].join(' ')}
          {...rest}
        />
        <label
          htmlFor={id}
          className={[
            'absolute bg-white px-1 left-3 text-gray-400 pointer-events-none transition-all duration-150',
            'top-4 text-[15px]',
            'peer-focus:top-[-8px] peer-focus:text-xs peer-focus:text-slate-600',
            'peer-[&:not(:placeholder-shown)]:top-[-8px] peer-[&:not(:placeholder-shown)]:text-xs',
          ].join(' ')}
        >
          {label}
        </label>
      </div>
      {error && <p className="text-red-500 text-xs mt-1 mb-0">{error}</p>}
    </div>
  );
};

// ─── Floating label select ──────────────────────────────────────────────
interface Option {
  value: string;
  label: string;
}

interface FloatingLabelSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  icon?: React.ReactNode;
  options: Option[];
}

export const FloatingLabelSelect: React.FC<FloatingLabelSelectProps> = ({
  label,
  icon,
  options,
  id,
  className = '',
  value,
  ...rest
}) => {
  const hasValue = value !== undefined && value !== '';
  return (
    <div className="relative">
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none">
          {icon}
        </span>
      )}
      <select
        id={id}
        value={value}
        className={[
          'peer w-full bg-white border border-[#7D7777A3] rounded-sm shadow-[0_2px_4px_rgba(0,0,0,0.06)]',
          'py-3 text-[15px] text-slate-800 outline-none appearance-none transition-colors',
          'focus:border-slate-500',
          icon ? 'pl-11 pr-8' : 'px-3 pr-8',
          className,
        ].join(' ')}
        {...rest}
      >
        <option value="" disabled hidden />
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <label
        htmlFor={id}
        className={[
          'absolute bg-white px-1 text-gray-400 pointer-events-none transition-all duration-150 z-10',
          icon ? 'left-11' : 'left-3',
          hasValue ? '-top-2 text-xs text-slate-600' : 'top-1/2 -translate-y-1/2 text-[15px]',
          'peer-focus:-top-2 peer-focus:text-xs peer-focus:text-slate-600',
        ].join(' ')}
      >
        {label}
      </label>
      <svg
        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
};

// ─── Stepper ─────────────────────────────────────────────────────────────
export const Stepper: React.FC<{
  totalSteps: number;
  currentStep: number;
  onStepClick?: (step: number) => void;
}> = ({ totalSteps, currentStep, onStepClick }) => {
  return (
    <div className="flex items-center w-full">
      {Array.from({ length: totalSteps }).map((_, i) => {
        const step = i + 1;
        const isActive = step === currentStep;
        const isDone = step < currentStep;
        return (
          <React.Fragment key={step}>
            <button
              type="button"
              onClick={() => onStepClick?.(step)}
              className={[
                'w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                isDone
                  ? 'bg-black text-white cursor-pointer'
                  : isActive
                    ? 'bg-black text-white'
                    : 'bg-gray-200 text-gray-500',
              ].join(' ')}
            >
              {step}
            </button>
            {step < totalSteps && (
              <div
                className={`flex-1 h-0.5 mx-2 ${isDone ? 'bg-black' : 'bg-gray-200'
                  }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── Auth hero panel (replaces the old bg-image panel — pure CSS) ───────
/**
 * A gradient + dot-pattern panel used on the login/signup screens instead
 * of a background photo. Works as the full-height left panel on desktop
 * and a shorter top banner on mobile — just pass a height via className.
 */
export const AuthHeroPanel: React.FC<{
  title?: string;
  subtitle?: string;
  className?: string;
}> = ({ title = 'Sellar Events', subtitle = 'Plan it. List it. Fill every seat.', className = '' }) => {
  return (
    <div
      className={[
        'relative overflow-hidden flex items-center justify-center',
        'bg-linear-to-br from-slate-900 via-slate-800 to-black',
        className,
      ].join(' ')}
    >
      {/* dot grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
      {/* soft glow accents */}
      <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-[#007A78]/30 dark:bg-[#2DD4BF]/20 blur-3xl" />
      <div className="absolute -bottom-20 -right-10 w-72 h-72 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="relative z-10 flex flex-col items-center text-center px-8">
        <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-4">
          <FiCalendar className="text-[#007A78] dark:text-[#2DD4BF]" size={28} />
        </div>
        <h2 className="text-white text-2xl font-bold tracking-tight">{title}</h2>
        <p className="text-slate-300 text-sm mt-2 max-w-55">{subtitle}</p>
      </div>
    </div>
  );
};