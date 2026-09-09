import React, { useState } from 'react';
import { X, Store, Link2 } from 'lucide-react';

interface ShareOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  onViewStore?: () => void;

  // Only needed for a code-protected SINGLE event share — the generic
  // storefront share (ShareLinkPickerModal) doesn't pass these.
  eventId?: string;
  onRegenerateCode?: (eventId: string) => Promise<string>;
  isPrivate?: boolean;
}

export const ShareOptionsModal: React.FC<ShareOptionsModalProps> = ({
  isOpen,
  onClose,
  shareUrl,
  onViewStore,
  eventId,
  onRegenerateCode,
  isPrivate,
}) => {
  if (!isOpen) return null;
  const handleShareLink = async () => {
    if (!shareUrl) {
      console.warn('Share link blocked: url is empty');
      return;
    }

    // Private events: bake the code straight into the shared message so the
    // organizer never has to copy/paste it separately. Public events share
    // the plain link as before.
    let message = shareUrl;
    if (isPrivate && eventId && onRegenerateCode) {
      const newCode = await onRegenerateCode(eventId);
      message = `Use code ${newCode} to access this event: ${shareUrl}`;
    }

    const shareData = isPrivate ? { text: message } : { url: shareUrl };
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
      await navigator.clipboard.writeText(message);
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