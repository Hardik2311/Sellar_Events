// Identity-document helpers shared by AuthContext/useProfileData and the
// IdentityUpload component. Kept apart from IdentityUpload on purpose: that
// component pulls in PDF.js (via pdfCompression), and AuthContext is loaded on
// every page — importing these from there put PDF.js in every visitor's
// startup bundle, storefront included.

export const SLOT_LABELS = ['Front', 'Back'];

export interface DocFile {
  url: string;
  name: string;
}

/**
 * Best-effort filename recovery for documents that were uploaded before
 * filenames were tracked (or whose name wasn't passed in explicitly).
 * Falls back to the slot label (Front/Back) if nothing can be parsed.
 */
const deriveNameFromUrl = (url: string, fallback: string): string => {
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    const last = path.split('/').pop();
    return last && last.trim().length > 0 ? last : fallback;
  } catch {
    return fallback;
  }
};

// Normalizes stored data into DocFile[]. Handles both new {url,name} objects
// and legacy plain string[] URLs (old data), so nothing breaks.
export const normalizeDocFiles = (input: unknown, fallbackLabels: string[] = SLOT_LABELS): DocFile[] => {
  if (!Array.isArray(input)) return [];
  return input.map((item, i) =>
    typeof item === 'string'
      ? { url: item, name: deriveNameFromUrl(item, fallbackLabels[i] || `File ${i + 1}`) }
      : (item as DocFile)
  );
};
