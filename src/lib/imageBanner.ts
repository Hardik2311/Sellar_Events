// Image helpers for the ticket PDF. Images are pre-fetched (e.g. on event
// select) so building the PDF later has no network dependency at click time.

// Fetches a (possibly cross-origin, e.g. Firebase Storage) image via a blob
// URL so the canvas it's drawn on isn't tainted.
const loadImageFromUrl = async (url: string): Promise<{ img: HTMLImageElement; release: () => void }> => {
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
    return { img, release: () => URL.revokeObjectURL(objectUrl) };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
};

const roundedRectPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// Ticket PDF hero (design: "PDF ticket, A4"): the whole poster, centred, on a
// blurred and dimmed copy of itself over ink. Composited once here so the PDF
// only places a single JPEG. Sizes are design px; the canvas renders at
// `scale`× for print sharpness. Blur is a downscale/upscale pass rather than
// ctx.filter, which iOS Safari doesn't support.
export const loadImageAsPosterHero = async (
  url: string,
  width: number,
  height: number,
  posterHeight: number,
  scale = 2
): Promise<string | null> => {
  try {
    const { img, release } = await loadImageFromUrl(url);
    try {
      const W = Math.round(width * scale);
      const H = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.fillStyle = '#14120f';
      ctx.fillRect(0, 0, W, H);

      // Backdrop: cover-fit into a tiny canvas, then stretch back up with
      // smoothing — a cheap, portable blur. Bleeds 20px past each edge like
      // the design's inset: -20px.
      const bleed = 20 * scale;
      const bw = W + bleed * 2;
      const bh = H + bleed * 2;
      const tiny = document.createElement('canvas');
      tiny.width = Math.max(1, Math.round(bw / 24));
      tiny.height = Math.max(1, Math.round(bh / 24));
      const tctx = tiny.getContext('2d');
      if (tctx) {
        const srcRatio = img.width / img.height;
        const dstRatio = tiny.width / tiny.height;
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (srcRatio > dstRatio) { sw = img.height * dstRatio; sx = (img.width - sw) / 2; }
        else { sh = img.width / dstRatio; sy = (img.height - sh) / 2; }
        tctx.imageSmoothingEnabled = true;
        tctx.drawImage(img, sx, sy, sw, sh, 0, 0, tiny.width, tiny.height);
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(tiny, -bleed, -bleed, bw, bh);
        ctx.restore();
      }

      // Poster: contain-fit at posterHeight tall, never wider than the hero.
      let ph = posterHeight * scale;
      let pw = (img.width / img.height) * ph;
      const maxPw = W - 32 * scale;
      if (pw > maxPw) { pw = maxPw; ph = pw * (img.height / img.width); }
      const px = (W - pw) / 2;
      const py = (H - ph) / 2;
      ctx.save();
      roundedRectPath(ctx, px, py, pw, ph, 8 * scale);
      ctx.clip();
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, px, py, pw, ph);
      ctx.restore();

      return canvas.toDataURL('image/jpeg', 0.88);
    } finally {
      release();
    }
  } catch {
    return null;
  }
};
