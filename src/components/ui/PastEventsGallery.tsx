import React, { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import type { GalleryMediaItem } from '../../types/event.types';
import { compressImageToTargetSize } from '../../lib/imageCompression';

interface PastEventsGalleryProps {
  media: GalleryMediaItem[];
  onChange: (media: GalleryMediaItem[]) => void;
  maxItems?: number;
}

const MAX_BYTES = 1024 * 1024; // 1MB — GIFs/videos are not re-encoded client-side

const detectType = (file: File): GalleryMediaItem['type'] => {
  if (file.type === 'image/gif') return 'gif';
  if (file.type.startsWith('video/')) return 'video';
  return 'image';
};

export const PastEventsGallery: React.FC<PastEventsGalleryProps> = ({ media, onChange, maxItems = 6 }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);

    const remainingSlots = maxItems - media.length;
    const files = Array.from(fileList).slice(0, remainingSlots);
    if (files.length === 0) return;

    const isUncompressible = (f: File) => f.type === 'image/gif' || f.type.startsWith('video/');
    const oversized = files.filter((f) => isUncompressible(f) && f.size > MAX_BYTES);
    if (oversized.length > 0) {
      setError('GIFs and videos must already be under 1MB — please compress before uploading.');
    }
    const validFiles = files.filter((f) => !isUncompressible(f) || f.size <= MAX_BYTES);
    if (validFiles.length === 0) return;

    setIsProcessing(true);
    try {
      const results = await Promise.all(
        validFiles.map(async (file): Promise<GalleryMediaItem | null> => {
          const type = detectType(file);
          const rawPreview: string = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          if (type === 'image') {
            try {
              const compressed = await compressImageToTargetSize(rawPreview, 500, { maxWidth: 1600, maxHeight: 1600 });
              return { url: compressed, type };
            } catch (err) {
              console.error('Gallery image compression failed, skipping file:', err);
              return null; // never fall back to an uncompressed file
            }
          }
          return { url: rawPreview, type };
        })
      );

      const items = results.filter((item): item is GalleryMediaItem => item !== null);
      if (items.length < validFiles.length) {
        setError('Some images could not be compressed and were skipped.');
      }
      if (items.length > 0) {
        onChange([...media, ...items]);
      }
    } finally {
      setIsProcessing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeItem = (index: number) => onChange(media.filter((_, i) => i !== index));

  return (
    <div>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))' }}>
        {media.map((item, i) => (
          <div key={i} className="relative aspect-square rounded-sm overflow-hidden border border-gray-200 dark:border-slate-700 group">
            {item.type === 'video' ? (
              <video src={item.url} className="h-full w-full object-cover" muted />
            ) : (
              <img src={item.url} alt={`Past event media ${i + 1}`} className="h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button type="button" onClick={() => removeItem(i)} className="rounded-sm bg-white/90 px-2 py-1 text-[9px] font-semibold text-red-600">
                Remove
              </button>
            </div>
          </div>
        ))}

        {media.length < maxItems && (
          <label className="aspect-square rounded-sm border border-dashed border-gray-300 dark:border-slate-600 flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-slate-400 hover:border-[#007A78] dark:hover:border-[#2DD4BF] hover:text-[#007A78] dark:hover:text-[#2DD4BF] cursor-pointer transition-colors">
            <input ref={inputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} disabled={isProcessing} />
            <ImagePlus size={16} />
            <span className="text-[9px] font-medium">Add media</span>
          </label>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-slate-500">
        {isProcessing ? 'Processing…' : `Up to ${maxItems} photos, GIFs, or videos. GIFs/videos must be under 1MB.`}
      </p>
      {error && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
};

export default PastEventsGallery;