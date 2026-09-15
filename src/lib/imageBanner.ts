// Fetches a (possibly cross-origin, e.g. Firebase Storage) image and
// re-renders it into a fixed-aspect-ratio JPEG data URL, cropped to cover —
// same idea as CSS object-fit: cover. Used to pre-fetch a banner image well
// before it's needed (e.g. on event select), so building a PDF later is a
// synchronous, instant operation with no network dependency at click time.
export const loadImageAsCoverBanner = async (
  url: string,
  targetWidth: number,
  targetHeight: number
): Promise<string | null> => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const srcRatio = img.width / img.height;
      const targetRatio = targetWidth / targetHeight;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (srcRatio > targetRatio) {
        sw = img.height * targetRatio;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / targetRatio;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
      return canvas.toDataURL('image/jpeg', 0.85);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
};
