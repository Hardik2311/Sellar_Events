import React from 'react';
import { createPortal } from 'react-dom';

interface ImageOptionsModalProps {
  title: string;
  hasImage: boolean;
  onUpload: () => void;
  onRemove: () => void;
  onClose: () => void;
}

const ImageOptionsModal: React.FC<ImageOptionsModalProps> = ({
  title,
  hasImage,
  onUpload,
  onRemove,
  onClose,
}) => {
  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1E293B] w-[calc(100%-2rem)] max-w-sm sm:w-80 mx-4 sm:mx-0 mb-4 sm:mb-0 rounded-2xl overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 text-center">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 m-0">{title}</p>
        </div>
        <button
          type="button"
          onClick={onUpload}
          className="w-full text-center py-3 text-sm font-bold text-[#007A78] dark:text-[#2DD4BF] border-b border-slate-100 dark:border-slate-800 cursor-pointer bg-white dark:bg-[#1E293B]"
        >
          {hasImage ? 'Change Photo' : 'Add Photo'}
        </button>
        {hasImage && (
          <button
            type="button"
            onClick={onRemove}
            className="w-full text-center py-3 text-sm font-bold text-red-500 dark:text-red-400 border-b border-slate-100 dark:border-slate-800 cursor-pointer bg-white dark:bg-[#1E293B]"
          >
            Remove Current Photo
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full text-center py-3 text-sm font-semibold text-slate-500 dark:text-slate-400 cursor-pointer bg-white dark:bg-[#1E293B]"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default ImageOptionsModal;