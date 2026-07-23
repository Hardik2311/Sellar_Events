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
    <div className="flex flex-1 items-center gap-2 rounded-sm border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
      <Search size={16} className="text-gray-400 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-gray-500 placeholder:text-gray-400 focus:outline-none"
      />
    </div>
    <button
      onClick={onScanClick}
      className="shrink-0 flex items-center justify-center h-11 w-11 rounded-sm bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
      aria-label="Scan barcode or QR code"
    >
      <Camera size={18} />
    </button>
  </div>
);

export default SearchBar;