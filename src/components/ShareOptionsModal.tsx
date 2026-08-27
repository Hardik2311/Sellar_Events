import React from 'react';
import { X, MessageCircle, Link as LinkIcon } from 'lucide-react';

interface ShareOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWhatsAppShare: () => void;
  onCopyLink: () => void;
}

export const ShareOptionsModal: React.FC<ShareOptionsModalProps> = ({
  isOpen, onClose, onWhatsAppShare, onCopyLink,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-xs rounded-lg bg-white dark:bg-slate-800 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Share event</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => { onWhatsAppShare(); onClose(); }}
            className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-medium hover:bg-green-50 dark:hover:bg-slate-700"
          >
            <MessageCircle size={18} className="text-green-600" /> Share on WhatsApp
          </button>
          <button
            onClick={() => { onCopyLink(); onClose(); }}
            className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            <LinkIcon size={18} className="text-[#007A78]" /> Copy link
          </button>
        </div>
      </div>
    </div>
  );
};