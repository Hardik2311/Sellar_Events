import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx-js-style';
import BackButton from '../../components/ui/BackButton';
import EventListCard from '../../components/EventListCard';
import { EventDateFilter, EventFilterProvider } from '../../components/ui/EventdateFilter';
import { useAuth } from '../../context/AuthContext';
import { useSalesReport } from '../../hooks/useSalesReport';

const formatDate = (ms: number) =>
    new Date(ms).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const SalesReportPageInner: React.FC = () => {
    const { profile } = useAuth();
    const { eventId } = useParams<{ eventId: string }>();

    const {
        events, eventsLoading, eventSearch, setEventSearch,
        selectedEventId, setSelectedEventId, selectedEvent,
        attendeesLoading: loading,
        startDate, endDate, appliedFilters,
        searchQuery, setSearchQuery,
        sortConfig, handleSort,
        filtered, summary,
    } = useSalesReport(profile?.companyId, eventId);

    const [showSearch, setShowSearch] = useState(false);
    const [isListVisible, setIsListVisible] = useState(true);
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

    const showToast = (type: 'success' | 'error' | 'info', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 2500);
    };

    // ---- PDF ----
    const downloadAsPdf = () => {
        if (!appliedFilters) return;
        try {
            const doc = new jsPDF();
            const pw = doc.internal.pageSize.getWidth();
            const ph = doc.internal.pageSize.getHeight();
            doc.setFillColor(0, 122, 120); doc.rect(0, 0, pw, 6, 'F');
            doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor(17, 24, 39);
            const reportTitle = profile?.organizationName
                ? `Ticket Sales Report — ${profile.organizationName}`
                : 'Ticket Sales Report';
            doc.text(reportTitle, 14, 24);
            doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(107, 114, 128);
            doc.text(`Generated: ${formatDate(Date.now())}   |   Period: ${formatDate(appliedFilters.start)} to ${formatDate(appliedFilters.end)}`, 14, 31);

            autoTable(doc, {
                startY: 38,
                head: [['DATE', 'BUYER', 'TIER', 'AMOUNT (₹)']],
                body: filtered.map(a => [
                    formatDate(a.purchasedAt!),
                    a.name || 'N/A',
                    a.tierName || 'N/A',
                    (a.amountPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
                ]),
                foot: [['TOTAL', `${summary.ticketsSold} tickets`, '', summary.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })]],
                theme: 'plain',
                styles: { font: 'helvetica', cellPadding: 7, fontSize: 10, textColor: [55, 65, 81] },
                headStyles: { fillColor: [240, 253, 250], textColor: [0, 90, 88], fontStyle: 'bold', lineWidth: { top: 1, bottom: 1 }, lineColor: [204, 251, 241] },
                footStyles: { fillColor: [255, 255, 255], textColor: [17, 24, 39], fontStyle: 'bold', lineWidth: { top: 1, bottom: 2 }, lineColor: [17, 24, 39] },
                alternateRowStyles: { fillColor: [250, 250, 250] },
                columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 40 }, 3: { halign: 'right', cellWidth: 42 } },
                didDrawPage: () => {
                    doc.setFontSize(9); doc.setTextColor(156, 163, 175);
                    doc.text(`Page ${doc.getNumberOfPages()}`, pw - 14, ph - 10, { align: 'right' });
                },
            });
            doc.save(`Sales_Report_${startDate}_to_${endDate}.pdf`);
            setIsDownloadOpen(false);
            showToast('success', 'PDF downloaded successfully!');
        } catch (err) {
            console.error(err);
            showToast('error', 'Failed to generate PDF.');
        }
    };

    // ---- Excel ----
    const downloadAsExcel = () => {
        if (!appliedFilters) return;
        try {
            const s = (font: any, fill?: any, alignment?: any, border?: any) => ({
                font: { name: 'Arial', ...font }, fill: fill ?? {},
                alignment: alignment ?? { horizontal: 'center', vertical: 'center', wrapText: true }, border: border ?? {},
            });
            const solidFill = (rgb: string) => ({ patternType: 'solid', fgColor: { rgb } });
            const allBorders = { top: { style: 'thin', color: { rgb: 'CBD5E1' } }, bottom: { style: 'thin', color: { rgb: 'CBD5E1' } }, left: { style: 'thin', color: { rgb: 'CBD5E1' } }, right: { style: 'thin', color: { rgb: 'CBD5E1' } } };
            const bblr = { bottom: { style: 'thin', color: { rgb: 'CBD5E1' } }, left: { style: 'thin', color: { rgb: 'CBD5E1' } }, right: { style: 'thin', color: { rgb: 'CBD5E1' } } };

            const COLS = [{ header: '#', width: 6 }, { header: 'Date', width: 16 }, { header: 'Buyer', width: 22 }, { header: 'Tier', width: 18 }, { header: 'Amount (₹)', width: 18 }];
            const colCount = COLS.length;
            const dataStartRow = 7;
            const totalRows = dataStartRow + filtered.length + 1;
            const aoa: any[][] = Array.from({ length: totalRows }, () => Array(colCount).fill(null));

            aoa[0][0] = profile?.organizationName
                ? `Ticket Sales Report  —  ${profile.organizationName}`
                : 'Ticket Sales Report';
            aoa[1][0] = `Generated: ${formatDate(Date.now())}   |   Period: ${formatDate(appliedFilters.start)} → ${formatDate(appliedFilters.end)}`;
            aoa[3][0] = 'SUMMARY';
            aoa[4][0] = `Total Sales: ₹${summary.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}   |   Tickets Sold: ${summary.ticketsSold}`;
            COLS.forEach((c, i) => { aoa[6][i] = c.header; });
            filtered.forEach((a, idx) => {
                const r = dataStartRow + idx;
                aoa[r] = [idx + 1, formatDate(a.purchasedAt!), a.name || 'N/A', a.tierName || 'N/A', a.amountPaid || 0];
            });
            const footerRow = dataStartRow + filtered.length;
            aoa[footerRow] = ['TOTAL', `${summary.ticketsSold} tickets`, '', '', summary.total];

            const ws: any = XLSX.utils.aoa_to_sheet(aoa);
            ws['!cols'] = COLS.map(c => ({ wch: c.width }));
            ws['!rows'] = [{ hpt: 36 }, { hpt: 20 }, { hpt: 8 }, { hpt: 18 }, { hpt: 22 }, { hpt: 8 }, { hpt: 28 }, ...filtered.map(() => ({ hpt: 20 })), { hpt: 24 }];
            ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } }, { s: { r: 3, c: 0 }, e: { r: 3, c: colCount - 1 } }, { s: { r: 4, c: 0 }, e: { r: 4, c: colCount - 1 } }];

            const styleCell = (addr: string, st: any) => { if (!ws[addr]) ws[addr] = { t: 's', v: '' }; ws[addr].s = st; };
            styleCell('A1', s({ sz: 16, bold: true, color: { rgb: 'FFFFFF' } }, solidFill('007A78'), { horizontal: 'center', vertical: 'center' }));
            styleCell('A2', s({ sz: 9, italic: true, color: { rgb: '134E4A' } }, solidFill('CCFBF1'), { horizontal: 'center', vertical: 'center' }));
            styleCell('A4', s({ sz: 10, bold: true, color: { rgb: '0F766E' } }, solidFill('F0FDFA'), { horizontal: 'left', vertical: 'center' }, allBorders));
            styleCell('A5', s({ sz: 10, bold: true, color: { rgb: '166534' } }, solidFill('DCFCE7'), { horizontal: 'center', vertical: 'center' }, bblr));
            COLS.forEach((_, i) => {
                const addr = XLSX.utils.encode_cell({ r: 6, c: i });
                styleCell(addr, s({ sz: 10, bold: true, color: { rgb: 'FFFFFF' } }, solidFill('0F5F5D'), { horizontal: i <= 2 ? 'left' : 'center', vertical: 'center' }, allBorders));
            });
            filtered.forEach((_, idx) => {
                const r = dataStartRow + idx;
                const isAlt = idx % 2 === 1;
                for (let ci = 0; ci < colCount; ci++) {
                    const addr = XLSX.utils.encode_cell({ r, c: ci });
                    styleCell(addr, s({ sz: 9, color: { rgb: '1E293B' } }, solidFill(isAlt ? 'F8FAFC' : 'FFFFFF'), { horizontal: ci === 4 ? 'center' : 'left', vertical: 'center' }, bblr));
                    if (ci === 4 && ws[addr]) { ws[addr].t = 'n'; ws[addr].z = '₹#,##0.00'; }
                }
            });
            for (let ci = 0; ci < colCount; ci++) {
                const addr = XLSX.utils.encode_cell({ r: footerRow, c: ci });
                styleCell(addr, s({ sz: 10, bold: true, color: { rgb: '1E293B' } }, solidFill('E2E8F0'), { horizontal: ci <= 2 ? 'left' : 'center', vertical: 'center' }, { top: { style: 'medium', color: { rgb: '1E293B' } }, bottom: { style: 'medium', color: { rgb: '1E293B' } }, left: { style: 'thin', color: { rgb: 'CBD5E1' } }, right: { style: 'thin', color: { rgb: 'CBD5E1' } } }));
                if (ci === 4 && ws[addr]) { ws[addr].t = 'n'; ws[addr].z = '₹#,##0.00'; }
            }

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');
            XLSX.writeFile(wb, `Sales_Report_${startDate}_to_${endDate}.xlsx`);
            setIsDownloadOpen(false);
            showToast('success', 'Excel downloaded successfully!');
        } catch (err) {
            console.error(err);
            showToast('error', 'Failed to generate Excel.');
        }
    };

    if (eventsLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-[#0F172A] text-slate-500 dark:text-slate-400">
                Loading...
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 pb-16">
            <header className="sticky top-0 z-20 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-4 py-3 shadow-xs">
                <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        <BackButton />
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-center max-w-[60%] min-w-0">
                        <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate">Ticket Sales</h1>
                        {selectedEvent && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{selectedEvent.title}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowSearch(v => !v)}
                            className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                            aria-label="Search"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="7" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </button>
                    </div>
                </div>
                {showSearch && (
                    <div className="flex justify-center mt-2">
                        <div className="flex items-center w-full max-w-md border-b-2 border-slate-300 dark:border-slate-700 focus-within:border-[#007A78] dark:focus-within:border-[#2DD4BF]">
                            <input
                                type="text"
                                placeholder="Search by buyer, tier, phone..."
                                autoFocus
                                className="flex-1 text-sm p-2 outline-none bg-transparent text-center text-slate-900 dark:text-white"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            <button
                                onClick={() => { setSearchQuery(''); setShowSearch(false); }}
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                )}
            </header>

            {toast && (
                <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-[9000] px-4 py-2 rounded-sm shadow-lg text-sm font-semibold text-white
                    ${toast.type === 'success' ? 'bg-[#007A78] dark:bg-[#2DD4BF] dark:text-slate-950' : toast.type === 'error' ? 'bg-red-600' : 'bg-slate-700'}`}>
                    {toast.message}
                </div>
            )}

            <div className="flex-1 p-4 sm:p-6 lg:p-8">
                <div className="w-full max-w-6xl mx-auto space-y-4">

                    <EventListCard
                        events={events}
                        selectedEventId={selectedEventId}
                        onSelect={setSelectedEventId}
                        searchValue={eventSearch}
                        onSearchChange={setEventSearch}
                        loading={eventsLoading}
                    />

                    <EventDateFilter />

                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 bg-white dark:bg-[#1E293B] p-4 rounded-sm shadow-sm border border-slate-200 dark:border-slate-800">
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Sales</p>
                            <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">₹{Math.round(summary.total).toLocaleString('en-IN')}</p>
                        </div>
                        <div className="flex-1 bg-white dark:bg-[#1E293B] p-4 rounded-sm shadow-sm border border-slate-200 dark:border-slate-800">
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tickets Sold</p>
                            <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{summary.ticketsSold}</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#1E293B] p-4 rounded-sm shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 text-center sm:text-left">Report Details</h2>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsListVisible(v => !v)}
                                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition text-xs"
                            >
                                {isListVisible ? 'Hide List' : 'Show List'}
                            </button>
                            <button
                                onClick={() => filtered.length === 0 ? showToast('info', 'No data to download.') : setIsDownloadOpen(true)}
                                disabled={!selectedEventId}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white font-bold rounded-sm text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Download
                            </button>
                        </div>
                    </div>

                    {isDownloadOpen && (
                        <div className="fixed inset-0 z-[8500] flex items-center justify-center bg-black/40 px-4" onClick={() => setIsDownloadOpen(false)}>
                            <div
                                className="bg-white dark:bg-[#1E293B] w-full max-w-xs rounded-sm shadow-xl p-5 border border-slate-200 dark:border-slate-800"
                                onClick={e => e.stopPropagation()}
                            >
                                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 text-center">Download Report</h3>
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={downloadAsPdf}
                                        className="py-2.5 rounded-sm bg-[#007A78] hover:bg-[#006361] dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5] text-white dark:text-slate-950 font-bold text-sm"
                                    >
                                        Download as PDF
                                    </button>
                                    <button
                                        onClick={downloadAsExcel}
                                        className="py-2.5 rounded-sm bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white font-bold text-sm"
                                    >
                                        Download as Excel
                                    </button>
                                    <button
                                        onClick={() => setIsDownloadOpen(false)}
                                        className="py-2.5 rounded-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {isListVisible && (
                        <div className="bg-white dark:bg-[#1E293B] rounded-sm shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                                        {([
                                            { key: 'purchasedAt', label: 'date' },
                                            { key: 'name', label: 'buyer' },
                                            { key: 'tierName', label: 'tier' },
                                            { key: 'amountPaid', label: 'amount' },
                                        ] as const).map(col => {
                                            const isSorted = sortConfig.key === col.key;
                                            const directionIcon = sortConfig.direction === 'asc' ? '∧' : '∨';
                                            return (
                                                <th
                                                    key={col.key}
                                                    onClick={() => handleSort(col.key)}
                                                    className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-800 dark:hover:text-white select-none"
                                                >
                                                    <span className="inline-flex items-center gap-1">
                                                        {col.label}
                                                        <span className="w-4 inline-block">
                                                            {isSorted ? (
                                                                <span className="text-[#007A78] dark:text-[#2DD4BF] text-xs font-bold">{directionIcon}</span>
                                                            ) : (
                                                                <span className="text-slate-400 text-xs opacity-50">∧∨</span>
                                                            )}
                                                        </span>
                                                    </span>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {!selectedEventId ? (
                                        <tr>
                                            <td colSpan={4} className="text-center py-10 text-slate-400 dark:text-slate-500">
                                                Select an event above to view its ticket sales.
                                            </td>
                                        </tr>
                                    ) : loading ? (
                                        <tr>
                                            <td colSpan={4} className="text-center py-10 text-slate-400 dark:text-slate-500">
                                                Loading sales...
                                            </td>
                                        </tr>
                                    ) : filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="text-center py-10 text-slate-400 dark:text-slate-500">
                                                No sales found for selected period.
                                            </td>
                                        </tr>
                                    ) : filtered.map((a, i) => (
                                        <tr key={a.id} className={i % 2 === 0 ? 'bg-white dark:bg-[#1E293B]' : 'bg-slate-50 dark:bg-[#182234]'}>
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{formatDate(a.purchasedAt!)}</td>
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{a.name || 'N/A'}</td>
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{a.tierName || 'N/A'}</td>
                                            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">₹{(a.amountPaid || 0).toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const SalesReportPage: React.FC = () => (
    <EventFilterProvider>
        <SalesReportPageInner />
    </EventFilterProvider>
);

export default SalesReportPage;