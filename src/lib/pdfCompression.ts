import { PDFDocument } from 'pdf-lib';

export interface CompressPdfOptions {
  /** Strip title/author/subject/keywords metadata. Default true. */
  stripMetadata?: boolean;
}

/**
 * Re-serializes a PDF with object streams enabled and (optionally)
 * strips metadata. This reduces size for text-heavy PDFs. It does NOT
 * re-encode embedded images — a scanned photo saved as a PDF won't
 * shrink much this way. For real image-heavy compression you'd need a
 * server-side tool (e.g. Ghostscript) or a WASM image re-encoder.
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
  return new Blob([compressedBytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
};

/** Rough size estimate of a Blob in KB. */
export const estimateBlobSizeKB = (blob: Blob): number => Math.round(blob.size / 1024);

export const compressPdfToTargetSize = async (
  input: File | ArrayBuffer,
  targetSizeKB = 500,
  options: CompressPdfOptions = {}
): Promise<Blob> => {
  const compressed = await compressPdf(input, options);

  if (estimateBlobSizeKB(compressed) > targetSizeKB) {
    console.warn(
      `PDF is still ${estimateBlobSizeKB(compressed)}KB after compression (target ${targetSizeKB}KB). ` +
      'pdf-lib cannot re-encode embedded images — this is expected for scanned PDFs.'
    );
  }

  return compressed;
};