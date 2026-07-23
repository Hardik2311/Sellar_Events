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

export const compressImage = (
  input: string | File,
  options: CompressImageOptions = {}
): Promise<string> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      let { width, height } = img;

      const widthRatio = opts.maxWidth / width;
      const heightRatio = opts.maxHeight / height;
      const scale = Math.min(1, widthRatio, heightRatio); // never upscale

      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas 2D context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL(opts.mimeType, opts.quality));
    };

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
};

/** Rough estimate of a base64 data URL's size in KB. */
export const estimateDataUrlSizeKB = (dataUrl: string): number => {
  const base64Length = dataUrl.split(',')[1]?.length ?? 0;
  return Math.round((base64Length * 0.75) / 1024);
};

export const compressImageToTargetSize = async (
  input: string | File,
  targetSizeKB = 500,
  options: CompressImageOptions = {}
): Promise<string> => {
  let quality = options.quality ?? DEFAULT_OPTIONS.quality;
  let result = await compressImage(input, { ...options, quality });

  let attempts = 0;
  while (estimateDataUrlSizeKB(result) > targetSizeKB && attempts < 5 && quality > 0.2) {
    quality -= 0.15;
    result = await compressImage(result, { ...options, quality });
    attempts += 1;
  }

  return result;
};