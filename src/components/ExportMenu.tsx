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
  organizationName: string; // shown as letterhead in both PDF & Excel
  disabled?: boolean;
}

const BRAND_TEAL_RGB: [number, number, number] = [0, 122, 120];
function ExportMenu<T>({ data, columns, fileNameBase, documentTitle, organizationName, disabled }: ExportMenuProps<T>) {
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

  const safeFileName = (ext: string) => `${fileNameBase.replace(/\s+/g, '-').toLowerCase()}.${ext}`;

  const handleExportPdf = () => {
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    const generatedOn = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    // Brand strip with organization name centered inside — same as Sales Report export
    doc.setFillColor(...BRAND_TEAL_RGB);
    doc.rect(0, 0, pageWidth, 20, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(organizationName || documentTitle, pageWidth / 2, 13, { align: 'center' });

    // Title + subtitle below the strip
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(documentTitle, 14, 34);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(
      `Generated: ${generatedOn}   |   ${data.length} record${data.length === 1 ? '' : 's'}`,
      14,
      41
    );

    autoTable(doc, {
      startY: 44,
      head: [columns.map((c) => c.header)],
      body: data.map((row) => columns.map((c) => String(c.accessor(row)))),
      theme: 'plain',
      styles: { font: 'helvetica', cellPadding: 4, fontSize: 8, textColor: [55, 65, 81], overflow: 'linebreak' },
      headStyles: {
        fillColor: [240, 253, 250],
        textColor: [0, 90, 88],
        fontStyle: 'bold',
        fontSize: 8,
        lineWidth: { top: 1, bottom: 1 },
        lineColor: [204, 251, 241],
      },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { top: 44, bottom: 16 },
      didDrawPage: () => {
        const w = doc.internal.pageSize.getWidth();
        const h = doc.internal.pageSize.getHeight();
        doc.setFontSize(9);
        doc.setTextColor(156, 163, 175);
        doc.text(`Page ${doc.getNumberOfPages()}`, w - 14, h - 8, { align: 'right' });
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
    const dataStartRow = 8; // shifted +1 for the org-name row
    const totalRows = dataStartRow + data.length + 1;
    const aoa: any[][] = Array.from({ length: totalRows }, () => Array(colCount).fill(null));

    const generatedOn = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    aoa[0][0] = organizationName || documentTitle;
    aoa[1][0] = documentTitle;
    aoa[2][0] = `Generated: ${generatedOn}   |   ${data.length} record${data.length === 1 ? '' : 's'}`;
    aoa[4][0] = 'SUMMARY';
    aoa[5][0] = `Total Records: ${data.length}`;
    headers.forEach((h, i) => { aoa[7][i] = h; });
    data.forEach((row, idx) => {
      aoa[dataStartRow + idx] = columns.map((c) => c.accessor(row));
    });
    const footerRow = dataStartRow + data.length;
    if (colCount === 1) {
      aoa[footerRow][0] = `TOTAL: ${data.length} record${data.length === 1 ? '' : 's'}`;
    } else {
      aoa[footerRow][0] = 'TOTAL';
      aoa[footerRow][1] = `${data.length} record${data.length === 1 ? '' : 's'}`;
    }

    const worksheet: any = XLSX.utils.aoa_to_sheet(aoa);
    worksheet['!cols'] = headers.map((h, colIdx) => {
      const maxDataLen = data.reduce((max, row) => {
        const val = String(columns[colIdx].accessor(row) ?? '');
        return Math.max(max, val.length);
      }, 0);
      // widest of: header text, actual data, capped so one column doesn't blow up the sheet
      const idealWidth = Math.max(h.length + 4, maxDataLen + 2, 14);
      return { wch: Math.min(idealWidth, 40) };
    });
    worksheet['!rows'] = [
      { hpt: 20 }, // org name row
      { hpt: 32 }, { hpt: 18 }, { hpt: 8 }, { hpt: 16 }, { hpt: 20 }, { hpt: 8 }, { hpt: 26 },
      ...data.map(() => ({ hpt: 20 })),
      { hpt: 22 },
    ];
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }, // org name
      { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } }, // title
      { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } }, // generated date
      { s: { r: 4, c: 0 }, e: { r: 4, c: colCount - 1 } }, // SUMMARY
      { s: { r: 5, c: 0 }, e: { r: 5, c: colCount - 1 } }, // total records
    ];

    const styleCell = (addr: string, st: any) => {
      if (!worksheet[addr]) worksheet[addr] = { t: 's', v: '' };
      worksheet[addr].s = st;
    };

    styleCell('A1', s({ sz: 14, bold: true, color: { rgb: 'FFFFFF' } }, solidFill('007A78'), { horizontal: 'center', vertical: 'center' })); // org name
    styleCell('A2', s({ sz: 13, bold: true, color: { rgb: '111827' } }, solidFill('FFFFFF'), { horizontal: 'center', vertical: 'center' })); // title
    styleCell('A3', s({ sz: 9, italic: true, color: { rgb: '134E4A' } }, solidFill('CCFBF1'), { horizontal: 'center', vertical: 'center' })); // generated
    styleCell('A5', s({ sz: 10, bold: true, color: { rgb: '0F766E' } }, solidFill('F0FDFA'), { horizontal: 'left', vertical: 'center' }, allBorders));
    styleCell('A6', s({ sz: 10, bold: true, color: { rgb: '166534' } }, solidFill('DCFCE7'), { horizontal: 'center', vertical: 'center' }, bblr));

    headers.forEach((_, i) => {
      const addr = XLSX.utils.encode_cell({ r: 7, c: i });
      styleCell(addr, s({ sz: 10, bold: true, color: { rgb: 'FFFFFF' } }, solidFill('0F5F5D'), { horizontal: i === 0 ? 'left' : 'center', vertical: 'center' }, allBorders));
    });

    data.forEach((_, idx) => {
      const r = dataStartRow + idx;
      const isAlt = idx % 2 === 1;
      for (let ci = 0; ci < colCount; ci++) {
        const addr = XLSX.utils.encode_cell({ r, c: ci });
        styleCell(addr, s({ sz: 9, color: { rgb: '1E293B' } }, solidFill(isAlt ? 'F8FAFC' : 'FFFFFF'), { horizontal: ci === 0 ? 'left' : 'center', vertical: 'center' }, bblr));
      }
    });

    for (let ci = 0; ci < colCount; ci++) {
      const addr = XLSX.utils.encode_cell({ r: footerRow, c: ci });
      styleCell(addr, s({ sz: 10, bold: true, color: { rgb: '1E293B' } }, solidFill('E2E8F0'), { horizontal: ci === 0 ? 'left' : 'center', vertical: 'center' }, { top: { style: 'medium', color: { rgb: '1E293B' } }, bottom: { style: 'medium', color: { rgb: '1E293B' } }, left: { style: 'thin', color: { rgb: 'CBD5E1' } }, right: { style: 'thin', color: { rgb: 'CBD5E1' } } }));
    }

    worksheet['!freeze'] = { xSplit: 0, ySplit: dataStartRow }; // freeze everything above the data rows
    worksheet['!autofilter'] = {
      ref: XLSX.utils.encode_range(
        { r: dataStartRow - 1, c: 0 },
        { r: dataStartRow - 1, c: colCount - 1 }
      ),
    };

    const workbook = XLSX.utils.book_new();
    const sheetName = documentTitle.replace(/[\\/*?:[\]]/g, '').slice(0, 31) || 'Sheet1';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
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
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            <FileText size={15} className="text-red-500" /> Download as PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors border-t border-gray-100 dark:border-slate-800"
          >
            <FileSpreadsheet size={15} className="text-green-600" /> Download as Excel
          </button>
        </div>
      )}
    </div>
  );
}

export default ExportMenu;