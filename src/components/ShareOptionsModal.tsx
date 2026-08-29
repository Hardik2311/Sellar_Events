import React from 'react';
import { X, MessageCircle, Store, Link2 } from 'lucide-react';

interface ShareOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  onWhatsAppShare: () => void;
  onViewStore?: () => void;
}

export const ShareOptionsModal: React.FC<ShareOptionsModalProps> = ({
  isOpen,
  onClose,
  shareUrl,
  onWhatsAppShare,
  onViewStore,
}) => {
  if (!isOpen) return null;

  const handleShareLink = async () => {
    if (!shareUrl) {
      console.warn('Share link blocked: shareUrl is empty');
      return;
    }
    const shareData = { url: shareUrl };
    // Native share sheet — same as "share to any app" normally works
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
        if (error?.name === 'AbortError') return; // user cancelled the sheet — not a bug
        console.error('Native share failed:', error?.name, error?.message);
      }
    }
    // Fallback for browsers/devices without navigator.share (e.g. desktop Chrome)
    try {
      await navigator.clipboard.writeText(shareUrl);
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
          {onViewStore && (
            <button
              onClick={() => { onViewStore(); onClose(); }}
              className="flex items-center gap-2 rounded-sm border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              <Store size={18} className="text-[#007A78]" /> View Store
            </button>
          )}

          <button
            onClick={() => { onWhatsAppShare(); onClose(); }}
            className="flex items-center gap-2 rounded-sm border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-medium hover:bg-green-50 dark:hover:bg-slate-700"
          >
            <MessageCircle size={18} className="text-green-600" /> Share on WhatsApp
          </button>

          <button
            onClick={() => { handleShareLink(); onClose(); }}
            className="flex items-center gap-2 rounded-sm border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            <Link2 size={18} className="text-[#007A78]" /> Share Link
          </button>
        </div>
      </div>
    </div>
  );
};