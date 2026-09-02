import React, { useRef, useState } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { compressImage } from '../../lib/imageCompression';

interface QRCodeImageUploadProps {
  value: string | null;
  onChange: (src: string | null) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB accepted pre-compression; we shrink it after

const QRCodeImageUpload: React.FC<QRCodeImageUploadProps> = ({ value, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Image must be under 10 MB.');
      return;
    }
    setError(null);
    setIsCompressing(true);
    try {
      // PNG output + modest cap — QR codes need to stay sharp/scannable,
      // so we resize rather than lossy-compress like a photo.
      const compressed = await compressImage(file, {
        maxWidth: 600,
        maxHeight: 600,
        mimeType: 'image/png',
      });
      onChange(compressed);
    } catch {
      setError('Could not process that image, please try another.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div>
      {value ? (
        <div className="relative w-40">
          <img
            src={value}
            alt="QR code preview"
            className="w-40 h-40 rounded-sm border border-gray-300 dark:border-slate-600 object-contain bg-white"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -right-2 -top-2 rounded-full bg-slate-800 dark:bg-slate-600 p-1 text-white shadow-md hover:bg-slate-900"
            aria-label="Remove QR image"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <label
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex w-40 h-40 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-sm border-2 border-dashed p-3 text-center transition-colors ${isDragging
              ? 'border-[#007A78] bg-orange-50 dark:bg-[#2DD4BF]/10'
              : 'border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800'
            }`}
        >
          {isCompressing ? (
            <Loader2 size={20} className="animate-spin text-slate-400" />
          ) : (
            <>
              <ImagePlus size={20} className="text-gray-400" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Upload QR</span>
              <span className="text-[10px] text-slate-400">Click or drag image</span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={isCompressing}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};

export default QRCodeImageUpload;