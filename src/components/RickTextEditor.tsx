import React, { useEffect, useRef } from 'react';

interface RichTextEditorProps {
    id: string;
    value: string;
    onChange: (html: string) => void;
    fontSize: number;
    label?: string;       // NEW — Category jaisa static label, placeholder ki jagah
    required?: boolean;   // NEW — label ke aage "*" dikhane ke liye
    multiline?: boolean;
    editorRef: React.RefObject<HTMLDivElement | null>;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
    id, value, onChange, fontSize, label, required, multiline, editorRef,
}) => {
    const isFirstRender = useRef(true);

    // innerHTML sirf pehli baar set karo — har render pe set karne se
    // cursor position/selection reset ho jaati hai
    useEffect(() => {
        if (isFirstRender.current && editorRef.current) {
            editorRef.current.innerHTML = value;
            isFirstRender.current = false;
        }
    }, [value, editorRef]);

    return (
        <div className="relative">
            {label && (
                <label
                    htmlFor={id}
                    className="absolute -top-2 left-3 z-10 bg-white dark:bg-slate-800 px-1 text-xs font-medium text-gray-500 dark:text-slate-400"
                >
                    {label}{required && ' *'}
                </label>
            )}
            <div
                id={id}
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
                style={{ fontSize }}
                className={`w-full rounded-sm border border-[#7D7777A3] dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-3 text-slate-800 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-[#2DD4BF] ${multiline ? 'min-h-[100px]' : 'min-h-[44px]'}`}
            />
        </div>
    );
};

export default RichTextEditor;