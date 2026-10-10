export interface CompressImageOptions {
  /** Max width in px the output image will be scaled down to fit within. */
  maxWidth?: number;
  /** Max height in px the output image will be scaled down to fit within. */
  maxHeight?: number;
  /** JPEG/WebP quality, 0–1. Ignored for 'image/png'. */
  quality?: number;
  /** Output mime type. */
  mimeType?: 'image/jpeg' | 'image/webp' | 'image/png';
}

const DEFAULT_OPTIONS: Required<CompressImageOptions> = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.75,
  mimeType: 'image/jpeg',
};

const loadImage = (input: string | File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for compression'));

    if (typeof input === 'string') {
      img.src = input;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(input);
    }
  });

// Draws the decoded source at the target size and encodes it. Always works from
// the original pixels, so repeated attempts never stack compression artefacts.
const encodeImage = (img: HTMLImageElement, opts: Required<CompressImageOptions>): string => {
  const scale = Math.min(1, opts.maxWidth / img.naturalWidth, opts.maxHeight / img.naturalHeight); // never upscale
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas 2D context');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL(opts.mimeType, opts.quality);
};

export const compressImage = async (
  input: string | File,
  options: CompressImageOptions = {}
): Promise<string> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const img = await loadImage(input);
  return encodeImage(img, opts);
};

let webpEncodeSupport: boolean | undefined;

/** Whether this browser's canvas can encode WebP (Chrome, Edge, Firefox; not older Safari). */
export const canEncodeWebp = (): boolean => {
  if (webpEncodeSupport === undefined) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      webpEncodeSupport = canvas.toDataURL('image/webp').startsWith('data:image/webp');
    } catch {
      webpEncodeSupport = false;
    }
  }
  return webpEncodeSupport;
};

/** Rough estimate of a base64 data URL's size in KB. */
export const estimateDataUrlSizeKB = (dataUrl: string): number => {
  const base64Length = dataUrl.split(',')[1]?.length ?? 0;
  return Math.round((base64Length * 0.75) / 1024);
};

export const HARD_MAX_SIZE_KB = 1024; // absolute ceiling — nothing should ever cross 1MB

export const compressImageToTargetSize = async (
  input: string | File,
  targetSizeKB = 500,
  options: CompressImageOptions = {}
): Promise<string> => {
  const base = { ...DEFAULT_OPTIONS, ...options };
  let quality = base.quality;
  let maxWidth = base.maxWidth;
  let maxHeight = base.maxHeight;

  // Decode once; every attempt below re-encodes from these original pixels.
  const img = await loadImage(input);
  const encode = () => encodeImage(img, { ...base, quality, maxWidth, maxHeight });

  let result = encode();

  // Pass 1: lower the quality in small steps (cheap, keeps the resolution)
  let attempts = 0;
  while (estimateDataUrlSizeKB(result) > targetSizeKB && attempts < 6 && quality > 0.5) {
    quality = Math.max(0.5, quality - 0.08);
    result = encode();
    attempts += 1;
  }

  // Pass 2: quality floor reached but still too big → shrink dimensions too
  let shrinkAttempts = 0;
  while (estimateDataUrlSizeKB(result) > targetSizeKB && shrinkAttempts < 4) {
    maxWidth = Math.round(maxWidth * 0.85);
    maxHeight = Math.round(maxHeight * 0.85);
    result = encode();
    shrinkAttempts += 1;
  }

  // Hard safety net: guarantee under 1MB no matter what, for storage
  if (estimateDataUrlSizeKB(result) > HARD_MAX_SIZE_KB) {
    console.warn(`Image still ${estimateDataUrlSizeKB(result)}KB after normal passes, forcing aggressive downscale`);
    quality = 0.5;
    maxWidth = 1000;
    maxHeight = 1000;
    result = encode();
  }

  return result;
};
