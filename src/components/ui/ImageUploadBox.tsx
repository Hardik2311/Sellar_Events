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
      <div className="relative h-40 w-full rounded-md overflow-hidden border border-gray-200">
        <img src={preview} alt="Event cover" className="h-full w-full object-cover" />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute top-2 right-2 rounded-full bg-white/90 p-1 shadow-sm hover:bg-white"
        >
          <X size={14} className="text-gray-700" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="flex h-40 w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors"
    >
      <ImagePlus size={22} className="text-gray-400" />
      <span className="text-xs text-gray-500">Click to upload a cover image</span>
      <span className="text-[10px] text-gray-400">Recommended: 1200×600, JPG or PNG</span>
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