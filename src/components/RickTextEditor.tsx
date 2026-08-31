import React, { useEffect, useRef } from 'react';

interface RichTextEditorProps {
    id: string;
    value: string;              // HTML string
    onChange: (html: string) => void;
    fontSize: number;
    placeholder?: string;
    multiline?: boolean;
    editorRef: React.RefObject<HTMLDivElement | null>;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
    id, value, onChange, fontSize, placeholder, multiline, editorRef,
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
        <div
            id={id}
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
            data-placeholder={placeholder}
            style={{ fontSize }}
            className={`w-full rounded-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-slate-800 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-[#2DD4BF] empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 ${multiline ? 'min-h-[100px]' : 'min-h-[44px]'}`}
        />
    );
};

export default RichTextEditor;