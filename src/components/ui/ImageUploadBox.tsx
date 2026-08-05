import React, { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { compressImageToTargetSize } from '../../lib/imageCompression';

interface ImageUploadBoxProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export const ImageUploadBox: React.FC<ImageUploadBoxProps> = ({ images, onChange, maxImages = 6 }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const remainingSlots = maxImages - images.length;
    const files = Array.from(fileList).slice(0, remainingSlots);
    if (files.length === 0) return;

    setIsCompressing(true);
    try {
      const compressedPreviews = await Promise.all(
        files.map(async (file) => {
          const rawPreview: string = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          try {
            return await compressImageToTargetSize(rawPreview, 500, {
              maxWidth: 1600,
              maxHeight: 1600,
            });
          } catch (err) {
            console.error('Image compression failed, falling back to original preview:', err);
            return rawPreview;
          }
        })
      );
      onChange([...images, ...compressedPreviews]);
    } finally {
      setIsCompressing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const reorderAsCover = (index: number) => {
    if (index === 0) return;
    const next = [...images];
    const [chosen] = next.splice(index, 1);
    next.unshift(chosen);
    onChange(next);
  };

  return (
    <div>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))' }}
      >
        {images.map((src, i) => (
          <div
            key={i}
            className="relative aspect-square rounded-sm overflow-hidden border border-gray-200 dark:border-slate-700 group"
          >
            <img src={src} alt={`Event photo ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 && (
              <span className="absolute top-1 left-1 rounded-sm bg-[#007A78] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                Cover
              </span>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
              {i !== 0 && (
                <button
                  type="button"
                  onClick={() => reorderAsCover(i)}
                  className="w-full rounded-sm bg-white/90 px-1 py-0.5 text-[8px] font-semibold text-slate-800"
                >
                  Make cover
                </button>
              )}
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="w-full rounded-sm bg-white/90 px-1 py-0.5 text-[8px] font-semibold text-red-600"
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        {images.length < maxImages && (
          <label className="aspect-square rounded-sm border border-dashed border-gray-300 dark:border-slate-600 flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-slate-400 hover:border-[#007A78] dark:hover:border-[#2DD4BF] hover:text-[#007A78] dark:hover:text-[#2DD4BF] cursor-pointer transition-colors">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <ImagePlus size={16} />
            <span className="text-[9px] font-medium">Add photo</span>
          </label>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-slate-500">
        {isCompressing
          ? 'Compressing images…'
          : `Up to ${maxImages} photos. First photo is used as the cover. Recommended 1200×600, JPG or PNG.`}
      </p>
    </div>
  );
};

export default ImageUploadBox;