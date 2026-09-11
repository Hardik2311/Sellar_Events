import React, { useRef, useState, useEffect } from 'react';
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
  const [isBoldActive, setIsBoldActive] = useState(false);
  const [isItalicActive, setIsItalicActive] = useState(false);

 const isTagActive = (node: Node | null, tag: 'b' | 'i'): boolean => {
  if (!node) return false;
  const el = node.nodeType === 3 ? node.parentElement : (node as Element);
  return Boolean(el?.closest(tag));
};

const updateActiveFormats = () => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !editorRef.current) return;

  const range = sel.getRangeAt(0);
  const container = range.startContainer;

  let before: Node | null = null;
  let after: Node | null = null;

  if (container.nodeType === Node.TEXT_NODE) {
    // Text node ke andar caret ho to sirf ussi node ka format count hota hai
    before = after = container;
  } else {
    // Element boundary pe caret ho (do formatted spans ke beech) — dono taraf
    // ke neighbor check karo taaki border case mein dono formats detect ho jaayein
    const el = container as Element;
    before = el.childNodes[range.startOffset - 1] ?? null;
    after = el.childNodes[range.startOffset] ?? null;
  }

  if (
    (!before || !editorRef.current.contains(before)) &&
    (!after || !editorRef.current.contains(after))
  ) {
    return;
  }

  setIsBoldActive(isTagActive(before, 'b') || isTagActive(after, 'b'));
  setIsItalicActive(isTagActive(before, 'i') || isTagActive(after, 'i'));
};

  useEffect(() => {
    // selectionchange se turant selection settle nahi hota — ek microtask/frame
    // defer karke check karo taaki final selection state mile
    const handler = () => requestAnimationFrame(updateActiveFormats);
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, []);

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

  const toggleTag = (tag: 'b' | 'i') => {
    editorRef.current?.focus();
    const range = restoreSelection();
    if (!range || range.collapsed) return;

    const sel = window.getSelection(); // NEW — wrap/unwrap ke baad selection re-set karne ke liye

    const container =
      range.commonAncestorContainer.nodeType === 3
        ? range.commonAncestorContainer.parentElement
        : (range.commonAncestorContainer as Element);
    const existing = container?.closest(tag);

    if (existing && editorRef.current?.contains(existing)) {
      // already bold/italic — unwrap
      const parent = existing.parentNode;
      const firstChild = existing.firstChild;
      const lastChild = existing.lastChild;
      while (existing.firstChild) parent?.insertBefore(existing.firstChild, existing);
      parent?.removeChild(existing);

      // NEW — unwrap ke baad selection ko usi (ab plain) content par re-place karo
      if (sel && firstChild && lastChild) {
        const newRange = document.createRange();
        newRange.setStartBefore(firstChild);
        newRange.setEndAfter(lastChild);
        sel.removeAllRanges();
        sel.addRange(newRange);
        savedRange.current = newRange.cloneRange();
      }

      if (tag === 'b') setIsBoldActive(false);
      if (tag === 'i') setIsItalicActive(false);
    } else {
      const wrapper = document.createElement(tag);
      // Default browser bold (700) halka lagta hai — explicit heavier weight force karo
      if (tag === 'b') wrapper.style.fontWeight = '800';
      try {
        range.surroundContents(wrapper);
      } catch {
        const contents = range.extractContents();
        wrapper.appendChild(contents);
        range.insertNode(wrapper);
      }


      if (sel) {
        const newRange = document.createRange();
        newRange.selectNodeContents(wrapper);
        sel.removeAllRanges();
        sel.addRange(newRange);
        savedRange.current = newRange.cloneRange();
      }

      if (tag === 'b') setIsBoldActive(true);
      if (tag === 'i') setIsItalicActive(true);
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
          className={`h-8 w-8 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-slate-700 ${isBoldActive
            ? 'bg-[#007A78]/15 dark:bg-[#2DD4BF]/20 text-[#007A78] dark:text-[#2DD4BF] ring-1 ring-inset ring-[#007A78] dark:ring-[#2DD4BF]'
            : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
          onClick={() => toggleTag('i')}
          className={`h-8 w-8 flex items-center justify-center border-l border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 ${isItalicActive
            ? 'bg-[#007A78]/15 dark:bg-[#2DD4BF]/20 text-[#007A78] dark:text-[#2DD4BF] ring-1 ring-inset ring-[#007A78] dark:ring-[#2DD4BF]'
            : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}
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