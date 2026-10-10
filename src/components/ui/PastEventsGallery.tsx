import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Play } from 'lucide-react';
import type { GalleryMediaItem } from '../../types/event.types';
import { canEncodeWebp, compressImageToTargetSize } from '../../lib/imageCompression';
import { compressVideo, MAX_VIDEO_SECONDS, VideoCompressionError } from '../../lib/videoCompression';

interface PastEventsGalleryProps {
  media: GalleryMediaItem[];
  onChange: (media: GalleryMediaItem[]) => void;
  maxItems?: number;
  /** Fires true while files are being compressed, so the parent can hold its Save button. */
  onBusyChange?: (busy: boolean) => void;
}

// GIFs can't be re-encoded without losing their animation, so they keep a size cap.
const MAX_GIF_BYTES = 2 * 1024 * 1024;

// Photos: long edge up to 2000px, WebP where the browser can encode it (about
// 30% smaller than JPEG at the same quality), starting at quality 0.85 and only
// stepping down if the file is still over ~450 KB.
const IMAGE_TARGET_KB = 450;
const IMAGE_MAX_EDGE = 2000;
const IMAGE_QUALITY = 0.85;

interface PendingUpload {
  id: number;
  kind: 'image' | 'video' | 'gif';
  progress: number; // 0–1, videos only
}

const detectType = (file: File): GalleryMediaItem['type'] | null => {
  if (file.type === 'image/gif') return 'gif';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  return null;
};

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const PastEventsGallery: React.FC<PastEventsGalleryProps> = ({ media, onChange, maxItems = 6, onBusyChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingUpload[]>([]);

  // Files are processed one after another while the parent re-renders; keep the
  // latest list so each finished item is appended to it, not to a stale copy.
  const mediaRef = useRef(media);
  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  const busy = pending.length > 0;
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  const append = (item: GalleryMediaItem) => {
    const next = [...mediaRef.current, item];
    mediaRef.current = next;
    onChange(next);
  };

  const processFile = async (file: File, id: number): Promise<string | null> => {
    const type = detectType(file);
    if (!type) return `${file.name} isn't a photo or video.`;

    if (type === 'gif') {
      if (file.size > MAX_GIF_BYTES) return `${file.name} is over 2 MB. GIFs can't be compressed without losing their animation.`;
      append({ url: await readAsDataUrl(file), type });
      return null;
    }

    if (type === 'image') {
      try {
        const compressed = await compressImageToTargetSize(file, IMAGE_TARGET_KB, {
          maxWidth: IMAGE_MAX_EDGE,
          maxHeight: IMAGE_MAX_EDGE,
          quality: IMAGE_QUALITY,
          mimeType: canEncodeWebp() ? 'image/webp' : 'image/jpeg',
        });
        append({ url: compressed, type });
        return null;
      } catch (err) {
        console.error('Gallery image compression failed, skipping file:', err);
        return `${file.name} couldn't be compressed and was skipped.`;
      }
    }

    try {
      const result = await compressVideo(file, (progress) =>
        setPending((list) => list.map((p) => (p.id === id ? { ...p, progress } : p)))
      );
      append({ url: URL.createObjectURL(result.blob), type: 'video', file: result.blob });
      if (result.trimmed) {
        setNotes((n) => [...n, `${file.name} was longer than ${MAX_VIDEO_SECONDS} seconds, so only the first ${MAX_VIDEO_SECONDS} seconds were kept.`]);
      }
      return null;
    } catch (err) {
      if (err instanceof VideoCompressionError && err.code === 'unsupported') {
        return `${file.name}: this browser can't compress videos. Use the latest Chrome, Edge, Safari or Firefox.`;
      }
      return `${file.name}: ${err instanceof Error ? err.message : 'this video couldn’t be compressed.'}`;
    }
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrors([]);
    setNotes([]);

    const remainingSlots = maxItems - media.length - pending.length;
    const files = Array.from(fileList).slice(0, Math.max(0, remainingSlots));
    if (inputRef.current) inputRef.current.value = '';
    if (files.length === 0) return;
    if (fileList.length > files.length) {
      setNotes([`Only ${maxItems} photos or videos fit in the gallery, so ${fileList.length - files.length} were left out.`]);
    }

    const queued: PendingUpload[] = files.map((file, i) => ({
      id: Date.now() + i,
      kind: detectType(file) ?? 'image',
      progress: 0,
    }));
    setPending((list) => [...list, ...queued]);

    // One at a time: video encoding is heavy, and running several at once can
    // exhaust memory on phones.
    for (let i = 0; i < files.length; i++) {
      const error = await processFile(files[i], queued[i].id);
      if (error) setErrors((e) => [...e, error]);
      setPending((list) => list.filter((p) => p.id !== queued[i].id));
    }
  };

  const removeItem = (index: number) => {
    const item = media[index];
    if (item?.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
    onChange(media.filter((_, i) => i !== index));
  };

  const isProcessing = pending.length > 0;
  const slotsLeft = maxItems - media.length - pending.length;

  return (
    <div>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))' }}>
        {media.map((item, i) => (
          <div key={i} className="relative aspect-square rounded-sm overflow-hidden border border-gray-200 dark:border-slate-700 group">
            {item.type === 'video' ? (
              <>
                <video src={`${item.url}#t=0.1`} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                <span className="pointer-events-none absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-sm bg-black/60 text-white">
                  <Play size={11} className="fill-white" />
                </span>
              </>
            ) : (
              <img src={item.url} alt={`Past event media ${i + 1}`} className="h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center justify-center">
              <button type="button" onClick={() => removeItem(i)} className="rounded-sm bg-white/90 px-2 py-1 text-[9px] font-semibold text-red-600">
                Remove
              </button>
            </div>
          </div>
        ))}

        {pending.map((p) => (
          <div
            key={p.id}
            className="relative aspect-square rounded-sm overflow-hidden border border-dashed border-[#007A78]/50 dark:border-[#2DD4BF]/50 bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center gap-1 text-[#007A78] dark:text-[#2DD4BF]"
            aria-live="polite"
          >
            <Loader2 size={16} className="animate-spin" />
            <span className="text-[9px] font-semibold">
              {p.kind === 'video' ? `Compressing ${Math.round(p.progress * 100)}%` : 'Compressing…'}
            </span>
            {p.kind === 'video' && (
              <span className="absolute inset-x-0 bottom-0 h-1 bg-[#007A78]/15 dark:bg-[#2DD4BF]/15">
                <span className="block h-full bg-[#007A78] dark:bg-[#2DD4BF] transition-[width]" style={{ width: `${Math.round(p.progress * 100)}%` }} />
              </span>
            )}
          </div>
        ))}

        {slotsLeft > 0 && (
          <label className="aspect-square rounded-sm border border-dashed border-gray-300 dark:border-slate-600 flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-slate-400 hover:border-[#007A78] dark:hover:border-[#2DD4BF] hover:text-[#007A78] dark:hover:text-[#2DD4BF] cursor-pointer transition-colors">
            <input ref={inputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            <ImagePlus size={16} />
            <span className="text-[9px] font-medium">Add photos or videos</span>
          </label>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-slate-500">
        {isProcessing
          ? 'Compressing… keep this page open until it finishes.'
          : `Up to ${maxItems} photos or videos. Everything is compressed before upload; videos are kept to ${MAX_VIDEO_SECONDS} seconds.`}
      </p>
      {notes.map((note) => (
        <p key={note} className="mt-1 text-xs text-amber-600 dark:text-amber-400">{note}</p>
      ))}
      {errors.map((error) => (
        <p key={error} className="mt-1 text-xs text-red-500 dark:text-red-400">{error}</p>
      ))}
    </div>
  );
};

export default PastEventsGallery;
