import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, type Theme } from '../../context/ThemeContext';

interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ showLabel = false, className = '' }) => {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const modes: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = modes.indexOf(theme);
    const nextTheme = modes[(currentIndex + 1) % modes.length];
    setTheme(nextTheme);
  };

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun size={18} className="text-[#007A78] transition-transform duration-300 rotate-0 hover:rotate-45" />;
      case 'dark':
        return <Moon size={18} className="text-[#2DD4BF] transition-transform duration-300 hover:-rotate-12" />;
      case 'system':
        return <Monitor size={18} className="text-[#007A78] dark:text-[#2DD4BF] transition-transform duration-300 hover:scale-110" />;
    }
  };

  const getLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
        return 'System';
    }
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className={`inline-flex items-center gap-2 p-2 rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all duration-200 shadow-xs active:scale-95 ${className}`}
      title={`Current mode: ${getLabel()} (Click to toggle)`}
      aria-label="Toggle theme mode"
    >
      <span className="flex items-center justify-center">{getIcon()}</span>
      {showLabel && <span className="text-xs font-bold select-none">{getLabel()}</span>}
    </button>
  );
};

export default ThemeToggle;
