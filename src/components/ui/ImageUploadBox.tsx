import React, { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';

interface ImageUploadBoxProps {
  preview: string | null;
  onChange: (dataUrl: string | null) => void;
}

export const ImageUploadBox: React.FC<ImageUploadBoxProps> = ({ preview, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  if (preview) {
    return (
      <div className="relative h-44 w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md">
        <img src={preview} alt="Event cover" className="h-full w-full object-cover" />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute top-3 right-3 rounded-xl bg-slate-900 text-white p-2 shadow-md hover:bg-slate-800 transition-all active:scale-95"
          title="Remove image"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="flex h-40 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-[#F9FAFB] dark:bg-[#1E293B] hover:bg-[#007A78]/5 dark:hover:bg-slate-800 hover:border-[#007A78]/50 transition-all"
    >
      <ImagePlus size={24} className="text-[#007A78] dark:text-[#2DD4BF]" />
      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Click to upload a cover image</span>
      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Recommended: 1200×600, JPG or PNG</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </button>
  );
};

export default ImageUploadBox;