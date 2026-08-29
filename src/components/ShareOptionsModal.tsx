import React, { useState } from 'react';
import { X, MessageCircle, Share2 } from 'lucide-react';

interface ShareOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  onWhatsAppShare: () => void;
}

export const ShareOptionsModal: React.FC<ShareOptionsModalProps> = ({
  isOpen,
  onClose,
  shareUrl,
  onWhatsAppShare,
}) => {
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  if (!isOpen) return null;

  const handleNativeShare = async () => {
    if (!shareUrl) {
      console.warn('Native share blocked: shareUrl is empty');
      return;
    }
    const shareData = { url: shareUrl };
    try {
      // canShare lets us catch unsupported-data errors before actually calling share()
      if (navigator.canShare && !navigator.canShare(shareData)) {
        console.warn('Native share blocked: navigator.canShare() returned false for', shareData);
        return;
      }
      await navigator.share(shareData);
      onClose();
    } catch (err) {
      const error = err as Error;
      if (error?.name === 'AbortError') return; // user cancelled the sheet — not a bug
      console.error('Native share failed:', error?.name, error?.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-xs rounded-lg bg-white dark:bg-slate-800 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Share event</h3>
          <button onClick={onClose}>
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => { onWhatsAppShare(); onClose(); }}
            className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-medium hover:bg-green-50 dark:hover:bg-slate-700"
          >
            <MessageCircle size={18} className="text-green-600" /> Share on WhatsApp
          </button>

          {canNativeShare && (
            <button
              onClick={handleNativeShare}
              className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              <Share2 size={18} className="text-[#007A78]" /> Share
            </button>
          )}
        </div>
      </div>
    </div>
  );
};