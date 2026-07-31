import React, { useRef, useState , useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FiUpload, FiFileText, FiCheck, FiX, FiLoader } from 'react-icons/fi';
import { storage } from '../lib/firebase';
import { compressPdfToTargetSize } from '../lib/pdfCompression';

interface IdentityDocumentUploadProps {
  label: string;
  companyId: string;
  userId: string;
  /** e.g. 'aadhaar' or 'pan' — used to build the storage path/filename. */
  docType: 'aadhaar' | 'pan';
  existingUrl?: string;
  onUploaded: (url: string) => void;
}

const IdentityDocumentUpload: React.FC<IdentityDocumentUploadProps> = ({
  label,
  companyId,
  userId,
  docType,
  existingUrl,
  onUploaded,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | undefined>(existingUrl);

  
  useEffect(() => {
    setUploadedUrl(existingUrl || undefined);
  }, [existingUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file only.');
      return;
    }

    setError(null);
    setFileName(file.name);
    setUploading(true);

    try {
      const compressedBlob = await compressPdfToTargetSize(file, 500);
      const docRef = ref(storage, `companies/${companyId}/users/${userId}/documents/${docType}.pdf`);
      await uploadBytes(docRef, compressedBlob, { contentType: 'application/pdf' });
      const url = await getDownloadURL(docRef);

      setUploadedUrl(url);
      onUploaded(url);
    } catch (err) {
      console.error(`Failed to upload ${docType} PDF:`, err);
      setError('Upload failed. Please check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setFileName(null);
    setUploadedUrl(undefined);
    onUploaded('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
        {label}
      </label>

      <div className="flex items-center gap-3 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 bg-white dark:bg-slate-900">
        <FiFileText size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />

        <div className="flex-1 min-w-0">
          {uploadedUrl && !uploading ? (
            <a
              href={uploadedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[#007A78] dark:text-[#2DD4BF] truncate hover:underline"
            >
              {fileName || 'View uploaded document'}
            </a>
          ) : (
            <span className="text-sm text-slate-400 dark:text-slate-500">
              {uploading ? 'Uploading…' : 'No file uploaded'}
            </span>
          )}
        </div>

        {uploading && <FiLoader size={16} className="animate-spin text-slate-400 shrink-0" />}
        {uploadedUrl && !uploading && <FiCheck size={16} className="text-emerald-500 shrink-0" />}

        {uploadedUrl && !uploading ? (
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs font-bold text-red-500 dark:text-red-400 hover:underline shrink-0"
          >
            Remove
          </button>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs font-bold text-[#007A78] dark:text-[#2DD4BF] hover:underline shrink-0 disabled:opacity-50"
          >
            <span className="flex items-center gap-1">
              <FiUpload size={12} /> Upload PDF
            </span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
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
    </div>
  );
};

export default IdentityDocumentUpload;