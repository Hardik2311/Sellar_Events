import { useEffect, useRef, useState } from 'react';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Generic export control: pass it any array + column definitions and it
// gives you a button that pops up "Download as PDF" / "Download as Excel".
// Not attendee-specific on purpose, so any other list page (orders,
// parties, reports) can reuse it without touching this file.

export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
}

interface ExportMenuProps<T> {
  data: T[];
  columns: ExportColumn<T>[];
  // Used as the base file name, e.g. "diwali-mela" -> diwali-mela-attendees.pdf
  fileNameBase: string;
  // Shown as the PDF title / sheet name, e.g. "Diwali Mela — Attendees"
  documentTitle: string;
  disabled?: boolean;
}

function ExportMenu<T>({ data, columns, fileNameBase, documentTitle, disabled }: ExportMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const safeFileName = (ext: string) => `${fileNameBase.replace(/\s+/g, '-').toLowerCase()}-attendees.${ext}`;

  const handleExportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(documentTitle, 14, 16);

    autoTable(doc, {
      startY: 22,
      head: [columns.map((c) => c.header)],
      body: data.map((row) => columns.map((c) => String(c.accessor(row)))),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [249, 115, 22] }, // #F97316
    });

    doc.save(safeFileName('pdf'));
    setOpen(false);
  };

  const handleExportExcel = () => {
    const rows = data.map((row) =>
      Object.fromEntries(columns.map((c) => [c.header, c.accessor(row)]))
    );
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendees');
    XLSX.writeFile(workbook, safeFileName('xlsx'));
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F9FAFB] dark:bg-[#1E293B] px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-all shadow-xs"
      >
        <Download size={15} className="text-[#007A78] dark:text-[#2DD4BF]" /> Export
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl z-30 overflow-hidden">
          <button
            onClick={handleExportPdf}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileText size={15} className="text-red-500" /> Download as PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
          >
            <FileSpreadsheet size={15} className="text-green-600" /> Download as Excel
          </button>
        </div>
      )}
    </div>
  );
}

export default ExportMenu;