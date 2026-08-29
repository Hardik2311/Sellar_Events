import { useEffect, useRef, useState } from 'react';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx-js-style'; // ⬅ styling-capable fork, not plain 'xlsx'

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
  fileNameBase: string;
  documentTitle: string;
  disabled?: boolean;
}

// App's teal accent — matches the "Checked In" stat & icons on Attendees page
const BRAND_TEAL = '#007A78';
const BRAND_TEAL_RGB: [number, number, number] = [0, 122, 120];
const BRAND_TEAL_LIGHT = 'E6F5F4'; // light tint for alternating rows / excel header bg
const BRAND_TEAL_LIGHT_RGB: [number, number, number] = [230, 245, 244];

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

    // Title bar in brand teal
    doc.setFillColor(...BRAND_TEAL_RGB);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(documentTitle, 14, 13);

    autoTable(doc, {
      startY: 26,
      head: [columns.map((c) => c.header)],
      body: data.map((row) => columns.map((c) => String(c.accessor(row)))),
      styles: { fontSize: 8, textColor: [30, 41, 59] }, // slate-800, matches app text
      headStyles: {
        fillColor: BRAND_TEAL_RGB,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: BRAND_TEAL_LIGHT_RGB,
      },
    });

    doc.save(safeFileName('pdf'));
    setOpen(false);
  };

  const handleExportExcel = () => {
  const s = (font: any, fill?: any, alignment?: any, border?: any) => ({
    font: { name: 'Arial', ...font },
    fill: fill ?? {},
    alignment: alignment ?? { horizontal: 'center', vertical: 'center', wrapText: true },
    border: border ?? {},
  });
  const solidFill = (rgb: string) => ({ patternType: 'solid', fgColor: { rgb } });
  const allBorders = {
    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } },
  };
  const bblr = {
    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } },
  };

  const headers = columns.map((c) => c.header);
  const colCount = headers.length;
  const dataStartRow = 7;
  const totalRows = dataStartRow + data.length + 1;
  const aoa: any[][] = Array.from({ length: totalRows }, () => Array(colCount).fill(null));

  aoa[0][0] = documentTitle;
  aoa[1][0] = `Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  aoa[3][0] = 'SUMMARY';
  aoa[4][0] = `Total Records: ${data.length}`;
  headers.forEach((h, i) => { aoa[6][i] = h; });
  data.forEach((row, idx) => {
    aoa[dataStartRow + idx] = columns.map((c) => c.accessor(row));
  });
  const footerRow = dataStartRow + data.length;
  aoa[footerRow][0] = 'TOTAL';
  aoa[footerRow][1] = `${data.length} record${data.length === 1 ? '' : 's'}`;

  const worksheet: any = XLSX.utils.aoa_to_sheet(aoa);
  worksheet['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 14) }));
  worksheet['!rows'] = [
    { hpt: 32 }, { hpt: 18 }, { hpt: 8 }, { hpt: 16 }, { hpt: 20 }, { hpt: 8 }, { hpt: 26 },
    ...data.map(() => ({ hpt: 20 })),
    { hpt: 22 },
  ];
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: colCount - 1 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: colCount - 1 } },
  ];

  const styleCell = (addr: string, st: any) => {
    if (!worksheet[addr]) worksheet[addr] = { t: 's', v: '' };
    worksheet[addr].s = st;
  };

  styleCell('A1', s({ sz: 15, bold: true, color: { rgb: 'FFFFFF' } }, solidFill(BRAND_TEAL.replace('#', '')), { horizontal: 'center', vertical: 'center' }));
  styleCell('A2', s({ sz: 9, italic: true, color: { rgb: '134E4A' } }, solidFill(BRAND_TEAL_LIGHT), { horizontal: 'center', vertical: 'center' }));
  styleCell('A4', s({ sz: 10, bold: true, color: { rgb: '0F766E' } }, solidFill('F0FDFA'), { horizontal: 'left', vertical: 'center' }, allBorders));
  styleCell('A5', s({ sz: 10, bold: true, color: { rgb: '166534' } }, solidFill('DCFCE7'), { horizontal: 'center', vertical: 'center' }, bblr));

  headers.forEach((_, i) => {
    const addr = XLSX.utils.encode_cell({ r: 6, c: i });
    styleCell(addr, s({ sz: 10, bold: true, color: { rgb: 'FFFFFF' } }, solidFill('0F5F5D'), { horizontal: 'left', vertical: 'center' }, allBorders));
  });

  data.forEach((_, idx) => {
    const r = dataStartRow + idx;
    const isAlt = idx % 2 === 1;
    for (let ci = 0; ci < colCount; ci++) {
      const addr = XLSX.utils.encode_cell({ r, c: ci });
      styleCell(addr, s({ sz: 9, color: { rgb: '1E293B' } }, solidFill(isAlt ? 'F8FAFC' : 'FFFFFF'), { horizontal: 'left', vertical: 'center' }, bblr));
    }
  });

  for (let ci = 0; ci < colCount; ci++) {
    const addr = XLSX.utils.encode_cell({ r: footerRow, c: ci });
    styleCell(addr, s({ sz: 10, bold: true, color: { rgb: '1E293B' } }, solidFill('E2E8F0'), { horizontal: 'left', vertical: 'center' }, { top: { style: 'medium', color: { rgb: '1E293B' } }, bottom: { style: 'medium', color: { rgb: '1E293B' } }, left: { style: 'thin', color: { rgb: 'CBD5E1' } }, right: { style: 'thin', color: { rgb: 'CBD5E1' } } }));
  }

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
        className="flex items-center gap-1.5 rounded-sm border border-slate-200 dark:border-slate-800 bg-[#F9FAFB] dark:bg-[#1E293B] px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-all shadow-xs"
      >
        <Download size={15} className="text-[#007A78] dark:text-[#2DD4BF]" /> Export
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 rounded-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl z-30 overflow-hidden">
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