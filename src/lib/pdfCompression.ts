import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
// worker must be configured once app-wide, e.g. in lib/firebase.ts or main.tsx:
// pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export interface CompressPdfOptions {
  /** Strip title/author/subject/keywords metadata. Default true. */
  stripMetadata?: boolean;
}

/**
 * Re-serializes a PDF with object streams enabled and (optionally)
 * strips metadata. This reduces size for text-heavy PDFs. It does NOT
 * re-encode embedded images — a scanned photo saved as a PDF won't
 * shrink much this way. For real image-heavy compression, use
 * compressPdfToTargetSize, which falls back to rasterization.
 */
export const compressPdf = async (
  input: File | ArrayBuffer,
  options: CompressPdfOptions = {}
): Promise<Blob> => {
  const { stripMetadata = true } = options;

  const bytes = input instanceof File ? await input.arrayBuffer() : input;
  const pdfDoc = await PDFDocument.load(bytes, { updateMetadata: false });

  if (stripMetadata) {
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer('');
    pdfDoc.setCreator('');
  }

  const compressedBytes = await pdfDoc.save({ useObjectStreams: true });
  const compressedBlob = new Blob([compressedBytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });

  const originalSize = input instanceof File ? input.size : bytes.byteLength;
  // Metadata-strip re-serialization can occasionally be equal or larger
  // for already-optimized PDFs — never ship something bigger than the input.
  if (compressedBlob.size >= originalSize) {
    return input instanceof File ? input : new Blob([bytes], { type: 'application/pdf' });
  }

  return compressedBlob;
};

/** Rough size estimate of a Blob in KB. */
export const estimateBlobSizeKB = (blob: Blob): number => Math.round(blob.size / 1024);

/**
 * Rasterizes each page to a canvas and re-embeds as a JPEG at decreasing
 * quality until the target size is hit. This is the only way to actually
 * shrink scanned/photo-based PDFs (pdf-lib alone can't re-encode images).
 * Trade-off: output becomes a flattened image PDF — any real text layer
 * (selectable/searchable text) is lost. Fine for ID-card scans.
 */
const rasterizeAndCompress = async (
  bytes: ArrayBuffer,
  targetSizeKB: number
): Promise<Blob> => {
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const outDoc = await PDFDocument.create();

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 }); // ~150dpi, plenty for ID docs

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    let quality = 0.8;
    let jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
    let jpegBytes = Uint8Array.from(atob(jpegDataUrl.split(',')[1]), (c) => c.charCodeAt(0));

    // Rough per-page budget: shrink quality until page pulls its weight
    // toward the overall target.
    const perPageTargetKB = targetSizeKB / pdf.numPages;
    while (jpegBytes.length / 1024 > perPageTargetKB && quality > 0.3) {
      quality -= 0.1;
      jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
      jpegBytes = Uint8Array.from(atob(jpegDataUrl.split(',')[1]), (c) => c.charCodeAt(0));
    }

    const jpegImage = await outDoc.embedJpg(jpegBytes);
    const outPage = outDoc.addPage([viewport.width, viewport.height]);
    outPage.drawImage(jpegImage, { x: 0, y: 0, width: viewport.width, height: viewport.height });
  }

  const outBytes = await outDoc.save({ useObjectStreams: true });
  return new Blob([outBytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
};

export const compressPdfToTargetSize = async (
  input: File | ArrayBuffer,
  targetSizeKB = 500,
  options: CompressPdfOptions = {}
): Promise<Blob> => {
  const bytes = input instanceof File ? await input.arrayBuffer() : input;
  const originalSizeKB = estimateBlobSizeKB(new Blob([bytes]));

  // Already small enough — don't touch it (same guard pattern as compressImage).
  if (originalSizeKB <= targetSizeKB) {
    return input instanceof File ? input : new Blob([bytes], { type: 'application/pdf' });
  }

  // First try the cheap, lossless-ish route.
  const structurallyCompressed = await compressPdf(bytes, options);
  if (estimateBlobSizeKB(structurallyCompressed) <= targetSizeKB) {
    return structurallyCompressed;
  }

  // Still too big → must be image-heavy (scanned). Rasterize + recompress.
  console.warn(
    `PDF still ${estimateBlobSizeKB(structurallyCompressed)}KB after structural compression ` +
    `(target ${targetSizeKB}KB) — falling back to rasterized re-compression.`
  );
  const rasterized = await rasterizeAndCompress(bytes, targetSizeKB);

  // Never ship something bigger than what we started with.
  return rasterized.size < (input instanceof File ? input.size : bytes.byteLength)
    ? rasterized
    : structurallyCompressed;
};