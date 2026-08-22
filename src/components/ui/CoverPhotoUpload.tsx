import React, { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { compressImageToTargetSize, estimateDataUrlSizeKB } from '../../lib/imageCompression';

interface CoverPhotoUploadProps {
  desktopSrc: string | null;
  mobileSrc: string | null;
  onChangeDesktop: (src: string | null) => void;
  onChangeMobile: (src: string | null) => void;
}

const readAndCompress = async (file: File): Promise<string> => {
  const rawPreview: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const compressed = await compressImageToTargetSize(rawPreview, 500, { maxWidth: 1600, maxHeight: 1600 });
  if (estimateDataUrlSizeKB(compressed) > 1024) {
    throw new Error('Image could not be compressed under 1MB');
  }
  return compressed;
};

const Slot: React.FC<{
  label: string;
  hint: string;
  src: string | null;
  onChange: (src: string | null) => void;
}> = ({ label, hint, src, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFile = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    setError(null);
    setIsProcessing(true);
    try {
      onChange(await readAndCompress(file));
    } catch (err) {
      console.error('Cover photo compression failed:', err);
      setError('Could not compress this image under 1MB. Try a smaller/simpler image.');
    } finally {
      setIsProcessing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex-1">
      <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{label}</p>
      {src ? (
        <div className="relative aspect-video rounded-sm overflow-hidden border border-gray-200 dark:border-slate-700 group">
          <img src={src} alt={label} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-1 right-1 rounded-full bg-white/90 p-1 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <label className="aspect-video rounded-sm border border-dashed border-gray-300 dark:border-slate-600 flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-slate-400 hover:border-[#007A78] dark:hover:border-[#2DD4BF] hover:text-[#007A78] dark:hover:text-[#2DD4BF] cursor-pointer transition-colors">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files)} disabled={isProcessing} />
          <ImagePlus size={16} />
          <span className="text-[9px] font-medium">{isProcessing ? 'Compressing…' : hint}</span>
        </label>
      )}
      {error && <p className="mt-1 text-[9px] text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
};

export const CoverPhotoUpload: React.FC<CoverPhotoUploadProps> = ({ desktopSrc, mobileSrc, onChangeDesktop, onChangeMobile }) => (
  <div>
    <div className="flex gap-3">
      <Slot label="Desktop cover" hint="1600×600 landscape" src={desktopSrc} onChange={onChangeDesktop} />
      <Slot label="Mobile cover" hint="1080×1350 portrait" src={mobileSrc} onChange={onChangeMobile} />
    </div>
    <p className="mt-2 text-xs text-gray-500 dark:text-slate-500">
      Upload both for a pixel-perfect fit on every screen. Add only one and we'll place it neatly (blurred backdrop, no stretching) for the size you skipped.
    </p>
  </div>
);

export default CoverPhotoUpload;