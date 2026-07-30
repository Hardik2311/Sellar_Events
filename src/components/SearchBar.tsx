import React from 'react';
import { Search, Camera } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onScanClick: () => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onScanClick,
  placeholder = 'Search by name, email or phone...',
}) => (
  <div className="flex items-center gap-2">
    <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F9FAFB] dark:bg-[#1E293B] px-4 py-2.5 shadow-xs focus-within:ring-2 focus-within:ring-[#007A78]/30 focus-within:border-[#007A78] dark:focus-within:ring-[#2DD4BF]/30 dark:focus-within:border-[#2DD4BF] transition-all">
      <Search size={18} className="text-slate-400 dark:text-slate-500 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none font-medium"
      />
    </div>
    <button
      onClick={onScanClick}
      className="shrink-0 flex items-center justify-center h-11 w-11 rounded-xl bg-[#007A78] hover:bg-[#006361] text-white dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5] dark:text-slate-950 transition-all shadow-xs active:scale-95"
      aria-label="Scan barcode or QR code"
      title="Scan QR Code"
    >
      <Camera size={20} />
    </button>
  </div>
);

export default SearchBar;