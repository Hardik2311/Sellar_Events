import React, { useRef, useState, useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FiUpload, FiFileText, FiCheck, FiX, FiLoader, FiPlus, FiEye, FiDownload } from 'react-icons/fi';
import { storage } from '../lib/firebase';
import { compressPdfToTargetSize } from '../lib/pdfCompression';
import { compressImage } from '../lib/identityCompression';

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
const MAX_FILES = 2;
const SLOT_LABELS = ['Front', 'Back'];

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

const toDocFiles = (input: (DocFile | string)[]): DocFile[] => normalizeDocFiles(input);

interface IdentityDocumentUploadProps {
  label: string;
  companyId: string;
  userId: string;
  /** e.g. 'aadhaar' or 'pan' — used to build the storage path/filename. */
  docType: 'aadhaar' | 'pan';
    existingUrls?: DocFile[];
  onUploaded: (files: DocFile[]) => void;
}

const IdentityDocumentUpload: React.FC<IdentityDocumentUploadProps> = ({
  label,
  companyId,
  userId,
  docType,
  existingUrls,
  onUploaded,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<DocFile[]>(toDocFiles(existingUrls || []));
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<DocFile | null>(null);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);

  useEffect(() => {
    setFiles(toDocFiles(existingUrls || []));
  }, [existingUrls]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please upload a PDF, JPG or PNG file only.');
      return;
    }

    setError(null);
    const slotIndex = files.length;
    setUploadingSlot(slotIndex);

    try {
      const isPdf = file.type === 'application/pdf';
      const compressed = isPdf
        ? await compressPdfToTargetSize(file, 500)
        : await compressImage(file, 500, 1600);

      const ext = isPdf ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
      const docRef = ref(
        storage,
        `companies/${companyId}/users/${userId}/documents/${docType}_${slotIndex + 1}.${ext}`
      );
      await uploadBytes(docRef, compressed, { contentType: file.type });
      const url = await getDownloadURL(docRef);

      const updated = [...files, { url, name: file.name }];
      setFiles(updated);
     onUploaded(updated); 
    } catch (err) {
      console.error(`Failed to upload ${docType} file:`, err);
      setError('Upload failed. Please check your connection and try again.');
    } finally {
      setUploadingSlot(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

    const handleRemove = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    onUploaded(updated);
  };

  const handleDownload = async (file: DocFile) => {
    setDownloadingUrl(file.url);
    try {
      const res = await fetch(file.url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed, falling back to opening the file:', err);
      window.open(file.url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloadingUrl(null);
    }
  };

  const canAddMore = files.length < MAX_FILES && uploadingSlot === null;

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
        {label}
      </label>

      <div className="flex flex-col gap-2">
        {files.map((file, index) => (
          <div
            key={file.url}
            className="flex items-center gap-2 border border-slate-300 dark:border-slate-700 rounded-sm px-3.5 py-2.5 bg-white dark:bg-slate-900 min-w-0"
          >
            <FiFileText size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
            <span
              className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200 truncate"
              title={file.name}
            >
              {file.name}
            </span>
            <FiCheck size={16} className="text-emerald-500 shrink-0" />

            <button
              type="button"
              onClick={() => setPreviewFile(file)}
              className="p-1.5 rounded-sm text-slate-500 dark:text-slate-400 hover:text-[#007A78] dark:hover:text-[#2DD4BF] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              aria-label={`View ${file.name}`}
              title="View"
            >
              <FiEye size={15} />
            </button>

            <button
              type="button"
              onClick={() => handleDownload(file)}
              disabled={downloadingUrl === file.url}
              className="p-1.5 rounded-sm text-slate-500 dark:text-slate-400 hover:text-[#007A78] dark:hover:text-[#2DD4BF] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 disabled:opacity-50"
              aria-label={`Download ${file.name}`}
              title="Download"
            >
              {downloadingUrl === file.url ? (
                <FiLoader size={15} className="animate-spin" />
              ) : (
                <FiDownload size={15} />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleRemove(index)}
              className="p-1.5 rounded-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0"
              aria-label={`Remove ${file.name}`}
              title="Remove"
            >
              <FiX size={15} />
            </button>
          </div>
        ))}

        {(canAddMore || uploadingSlot !== null) && (
          <div className="flex items-center gap-3 border border-dashed border-slate-300 dark:border-slate-700 rounded-sm px-3.5 py-2.5 bg-white dark:bg-slate-900 min-w-0">
            <FiFileText size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-slate-400 dark:text-slate-500">
                {uploadingSlot !== null
                  ? 'Uploading…'
                  : `No ${SLOT_LABELS[files.length]?.toLowerCase() || ''} file uploaded`}
              </span>
            </div>

            {uploadingSlot !== null ? (
              <FiLoader size={16} className="animate-spin text-slate-400 shrink-0" />
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-bold text-[#007A78] dark:text-[#2DD4BF] hover:underline shrink-0 flex items-center gap-1"
              >
                {files.length === 0 ? <FiUpload size={12} /> : <FiPlus size={12} />}
                {files.length === 0 ? 'Upload' : `Add ${SLOT_LABELS[files.length] || 'File'}`}
              </button>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="hidden"
          aria-label={`Upload ${label}`}
          onChange={handleFileSelect}
        />
      </div>

      {error && (
        <p className="text-red-500 text-[11px] font-bold mt-0.5 mb-0 flex items-center gap-1">
          <FiX size={12} /> {error}
        </p>
      )}

      {previewFile && (
        <DocumentPreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
};

/**
 * Lightweight in-page popup for previewing a document.
 * Replaces the previous behaviour of opening the file in a new browser tab.
 */
const DocumentPreviewModal: React.FC<{ file: DocFile; onClose: () => void }> = ({
  file,
  onClose,
}) => {
  const isPdf = file.name.toLowerCase().endsWith('.pdf');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1E293B] rounded-sm shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate pr-3">
            {file.name}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            aria-label="Close preview"
          >
            <FiX size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
          {isPdf ? (
            <iframe src={file.url} title={file.name} className="w-full h-[75vh] border-0" />
          ) : (
            <img src={file.url} alt={file.name} className="max-w-full max-h-[75vh] object-contain" />
          )}
        </div>
      </div>
    </div>
  );
};

export default IdentityDocumentUpload;