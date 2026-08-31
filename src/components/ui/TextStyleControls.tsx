import React, { useRef } from 'react';
import { Bold, Italic } from 'lucide-react';

interface TextStyleControlsProps {
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  editorRef: React.RefObject<HTMLDivElement | null>;
  onChange: (html: string) => void; // NEW — manual DOM edits ke baad React state sync karne ke liye
}

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32];

const TextStyleControls: React.FC<TextStyleControlsProps> = ({
  fontSize,
  onFontSizeChange,
  editorRef,
  onChange,
}) => {
  const savedRange = useRef<Range | null>(null);

  // Dialog khulne / button click hone se PEHLE (mousedown pe) selection save kar lete hain
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = (): Range | null => {
    const sel = window.getSelection();
    if (!sel || !savedRange.current) return null;
    sel.removeAllRanges();
    sel.addRange(savedRange.current);
    return sel.getRangeAt(0);
  };

  const syncChange = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  // Bold/Italic ke liye — selected text ko <b>/<i> mein wrap karta hai,
  // agar pehle se wrapped hai to unwrap (toggle off) kar deta hai
  const toggleTag = (tag: 'b' | 'i') => {
    editorRef.current?.focus();
    const range = restoreSelection();
    if (!range || range.collapsed) return;

    const container =
      range.commonAncestorContainer.nodeType === 3
        ? range.commonAncestorContainer.parentElement
        : (range.commonAncestorContainer as Element);
    const existing = container?.closest(tag);

    if (existing && editorRef.current?.contains(existing)) {
      // already bold/italic — unwrap
      const parent = existing.parentNode;
      while (existing.firstChild) parent?.insertBefore(existing.firstChild, existing);
      parent?.removeChild(existing);
    } else {
      const wrapper = document.createElement(tag);
      try {
        range.surroundContents(wrapper);
      } catch {
        const contents = range.extractContents();
        wrapper.appendChild(contents);
        range.insertNode(wrapper);
      }
    }
    syncChange();
  };

  // Color ke liye — selected text ko <span style="color:...">  mein wrap karta hai
  const applyColor = (color: string) => {
    editorRef.current?.focus();
    const range = restoreSelection();
    if (!range || range.collapsed) return;

    const wrapper = document.createElement('span');
    wrapper.style.color = color;
    try {
      range.surroundContents(wrapper);
    } catch {
      const contents = range.extractContents();
      wrapper.appendChild(contents);
      range.insertNode(wrapper);
    }
    syncChange();
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-2 p-1.5 rounded-sm border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 w-fit">
      <select
        value={fontSize}
        onChange={(e) => onFontSizeChange(Number(e.target.value))}
        className="h-8 rounded-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs px-2"
      >
        {FONT_SIZES.map((size) => (
          <option key={size} value={size}>{size}px</option>
        ))}
      </select>

      <div className="h-6 w-px bg-gray-300 dark:bg-slate-700 mx-0.5" />

      <div className="flex rounded-sm border border-gray-300 dark:border-slate-700 overflow-hidden">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
          onClick={() => toggleTag('b')}
          className="h-8 w-8 flex items-center justify-center bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700"
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
          onClick={() => toggleTag('i')}
          className="h-8 w-8 flex items-center justify-center border-l border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700"
        >
          <Italic size={14} />
        </button>
      </div>

      <div className="h-6 w-px bg-gray-300 dark:bg-slate-700 mx-0.5" />

      <input
        type="color"
        onMouseDown={saveSelection}
        onChange={(e) => applyColor(e.target.value)}
        className="h-8 w-8 rounded-sm border border-gray-300 dark:border-slate-700 cursor-pointer bg-white dark:bg-slate-800 p-0.5"
        title="Selected text color"
      />
    </div>
  );
};

export default TextStyleControls;