import type { jsPDF } from 'jspdf';
import antonUrl from '../assets/fonts/pdf/Anton-Regular.ttf?url';
import figtreeRegularUrl from '../assets/fonts/pdf/Figtree-Regular.ttf?url';
import figtreeSemiBoldUrl from '../assets/fonts/pdf/Figtree-SemiBold.ttf?url';
import figtreeBoldUrl from '../assets/fonts/pdf/Figtree-Bold.ttf?url';
import spaceMonoBoldUrl from '../assets/fonts/pdf/SpaceMono-Bold.ttf?url';

// Brand fonts for the ticket PDF. jsPDF can't read woff2 or variable fonts,
// so static TTFs live in assets/fonts/pdf and are fetched only when a PDF is
// first built. Each family is registered under its own name with the
// 'normal' style, so callers pick a weight with setFont(PdfFont.X, 'normal').
export const PdfFont = {
  Display: 'Anton',
  Body: 'Figtree',
  BodySemiBold: 'Figtree-SemiBold',
  BodyBold: 'Figtree-Bold',
  Mono: 'SpaceMono-Bold',
} as const;
export type PdfFontName = (typeof PdfFont)[keyof typeof PdfFont];

// Vertical metrics (hhea ascent/descent, in em) — used to place baselines the
// same way a CSS line box does, so the PDF matches the HTML design.
export const PDF_FONT_METRICS: Record<PdfFontName, { ascent: number; descent: number }> = {
  Anton: { ascent: 2409 / 2048, descent: 674 / 2048 },
  Figtree: { ascent: 0.95, descent: 0.25 },
  'Figtree-SemiBold': { ascent: 0.95, descent: 0.25 },
  'Figtree-Bold': { ascent: 0.95, descent: 0.25 },
  'SpaceMono-Bold': { ascent: 1.12, descent: 0.361 },
};

const FONT_FILES: { name: PdfFontName; url: string }[] = [
  { name: PdfFont.Display, url: antonUrl },
  { name: PdfFont.Body, url: figtreeRegularUrl },
  { name: PdfFont.BodySemiBold, url: figtreeSemiBoldUrl },
  { name: PdfFont.BodyBold, url: figtreeBoldUrl },
  { name: PdfFont.Mono, url: spaceMonoBoldUrl },
];

const toBase64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

// One shared fetch for the whole session — "Download all" builds several PDFs
// in parallel and they must not each re-download the fonts.
let fontDataPromise: Promise<{ name: PdfFontName; base64: string }[] | null> | null = null;

const loadFontData = () => {
  if (!fontDataPromise) {
    fontDataPromise = Promise.all(
      FONT_FILES.map(async ({ name, url }) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Font ${name} failed to load (${res.status})`);
        return { name, base64: toBase64(await res.arrayBuffer()) };
      })
    ).catch((err) => {
      console.error('Ticket PDF fonts failed to load, falling back to Helvetica:', err);
      fontDataPromise = null; // allow a retry on the next download
      return null;
    });
  }
  return fontDataPromise;
};

/**
 * Registers the brand fonts on `doc`. Returns false when they couldn't be
 * loaded — the caller then draws with Helvetica so a download never fails.
 */
export const registerPdfFonts = async (doc: jsPDF): Promise<boolean> => {
  const fonts = await loadFontData();
  if (!fonts) return false;
  fonts.forEach(({ name, base64 }) => {
    const file = `${name}.ttf`;
    doc.addFileToVFS(file, base64);
    doc.addFont(file, name, 'normal');
  });
  return true;
};
