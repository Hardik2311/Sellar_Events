import React, { useState } from 'react';
import { X, Store, Link2, KeyRound, Copy, Check } from 'lucide-react';

interface ShareOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  onViewStore?: () => void;

  // Only needed for a code-protected SINGLE event share — the generic
  // storefront share (ShareLinkPickerModal) doesn't pass these.
  eventId?: string;
  onRegenerateCode?: (eventId: string, expiresInHours?: number | null) => Promise<string>;
  isPrivate?: boolean;
}

// Options for the "Generate Code" expiry dropdown — value is hours, '' = never expires.
const EXPIRY_OPTIONS: { label: string; hours: number | null }[] = [
  { label: 'Never expires', hours: null },
  { label: 'Expires in 24 hours', hours: 24 },
  { label: 'Expires in 7 days', hours: 24 * 7 },
  { label: 'Expires in 30 days', hours: 24 * 30 },
];

export const ShareOptionsModal: React.FC<ShareOptionsModalProps> = ({
  isOpen,
  onClose,
  shareUrl,
  onViewStore,
  eventId,
  onRegenerateCode,
  isPrivate,
}) => {
  const [generatedCode, setGeneratedCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [expiryHours, setExpiryHours] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleGenerateCode = async () => {
    if (!eventId || !onRegenerateCode) return;
    setGenerating(true);
    setCodeCopied(false);
    try {
      const newCode = await onRegenerateCode(eventId, expiryHours);
      setGeneratedCode(newCode);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCode = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch (err) {
      console.error('Copy code failed:', err);
    }
  };

  const handleShareLink = async () => {
    if (!shareUrl) {
      console.warn('Share link blocked: url is empty');
      return;
    }

    // The clipboard/native-share payload must always be the real, navigable
    // URL. For a private event we also generate a fresh code and surface it
    // as accompanying text — never baked into the copied string itself,
    // otherwise pasting it into a browser doesn't go anywhere.
    let codeNote = '';
    if (isPrivate && eventId && onRegenerateCode) {
      const newCode = await onRegenerateCode(eventId, expiryHours);
      codeNote = `Use code ${newCode} to access this event: `;
    }

    const shareData = codeNote ? { text: codeNote, url: shareUrl } : { url: shareUrl };

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        if (navigator.canShare && !navigator.canShare(shareData)) {
          console.warn('Native share blocked: navigator.canShare() returned false for', shareData);
        } else {
          await navigator.share(shareData);
          return;
        }
      } catch (err) {
        const error = err as Error;
        if (error?.name === 'AbortError') return;
        console.error('Native share failed:', error?.name, error?.message);
      }
    }
    try {
      // Clipboard always gets the actual link, with the code note (if any)
      // prefixed as plain text — the URL itself is still copy-pasteable.
      await navigator.clipboard.writeText(`${codeNote}${shareUrl}`);
    } catch (err) {
      console.error('Copy link fallback failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-xs rounded-sm bg-white dark:bg-slate-800 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end mb-3">
          <button onClick={onClose}>
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {isPrivate && eventId && onRegenerateCode && (
            <>
              <select
                value={expiryHours ?? ''}
                onChange={(e) => setExpiryHours(e.target.value === '' ? null : Number(e.target.value))}
                className="rounded-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                {EXPIRY_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.hours ?? ''}>{opt.label}</option>
                ))}
              </select>
              <button
                onClick={handleGenerateCode}
                disabled={generating}
                className="flex items-center gap-2 rounded-sm border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-60"
              >
                <KeyRound size={18} className="text-[#007A78]" />
                {generating ? 'Generating…' : 'Generate Code'}
              </button>
              {generatedCode && (
                <button
                  onClick={handleCopyCode}
                  className="flex items-center justify-between gap-2 rounded-sm border border-dashed border-[#007A78]/50 bg-[#007A78]/5 px-3 py-2.5 text-sm font-semibold tracking-wide text-[#007A78] dark:text-[#2DD4BF] hover:bg-[#007A78]/10"
                >
                  <span>{generatedCode}</span>
                  {codeCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              )}
            </>
          )}

          {onViewStore && (
            <button
              onClick={() => { onViewStore(); onClose(); }}
              className="flex items-center gap-2 rounded-sm border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              <Store size={18} className="text-[#007A78]" /> View Events
            </button>
          )}

          <button
            onClick={handleShareLink}
            className="flex items-center gap-2 rounded-sm border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            <Link2 size={18} className="text-[#007A78]" /> Share Link
          </button>
        </div>
      </div>
    </div>
  );
};
