import React, { useState, useCallback } from 'react';
import { X, UploadCloud, AlertTriangle, CheckCircle2, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Attendee } from '../types/attendee.types';
import type { EventSummary } from '../types/event.types'; // CHANGED — PublicEvent → EventSummary (matches what Attendees.tsx actually passes)

interface ParsedRow {
    name: string;
    email: string;
    phone: string;
    tierName: string;
    valid: boolean;
    reason?: string;
    isDuplicate?: boolean;
}

interface ImportAttendeesModalProps {
    isOpen: boolean;
    onClose: () => void;
    event: EventSummary | null; // CHANGED
    companyId: string | undefined;
    existingAttendees: Attendee[]; // for duplicate-by-email check
    onSuccess: (count: number) => void;
}

const HEADER_ALIASES: Record<string, keyof ParsedRow> = {
    name: 'name', 'full name': 'name',
    email: 'email', 'email address': 'email',
    phone: 'phone', mobile: 'phone', 'phone number': 'phone',
    tier: 'tierName', 'ticket tier': 'tierName',
};

// SAME logic as CheckoutPage.tsx's getEventInitials — keeps ticket ID format
// consistent across checkout, walk-in, and import flows.
// "Party Popper" -> "PP", "Sunburn Festival" -> "SF", "Diwali" -> "DI"
const getEventInitials = (title: string): string => {
    const words = title.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'EV';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return words.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
};

// CHANGED — random IMP-xxxx-xxxx hata ke checkout jaisa "INITIALS-001" format
const genTicketId = (eventTitle: string, sequenceNumber: number) =>
    `${getEventInitials(eventTitle)}-${String(sequenceNumber).padStart(3, '0')}`;

const ImportAttendeesModal: React.FC<ImportAttendeesModalProps> = ({
    isOpen, onClose, event, companyId, existingAttendees, onSuccess,
}) => {
    const [rows, setRows] = useState<ParsedRow[]>([]);
    const [fileName, setFileName] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // MOVED — existingEmails, handleFile, handleDownloadSample (all hooks/hook-dependent
    // logic) must run on EVERY render regardless of isOpen/event, so the early return
    // below is now the LAST thing before JSX, not before these declarations.
    const existingEmails = new Set(existingAttendees.map((a) => a.email.toLowerCase().trim()));

    const handleFile = useCallback((file: File) => {
        setError(null);
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: 'array' });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

                if (json.length === 0) {
                    setError('File khaali hai ya format samajh nahi aaya.');
                    setRows([]);
                    return;
                }

                const seenInFile = new Set<string>();
                const parsed: ParsedRow[] = json.map((raw) => {
                    const mapped: Partial<ParsedRow> = {};
                    Object.entries(raw).forEach(([key, val]) => {
                        const norm = HEADER_ALIASES[key.trim().toLowerCase()];
                        if (norm) (mapped as any)[norm] = String(val).trim();
                    });
                    const name = mapped.name ?? '';
                    const email = (mapped.email ?? '').toLowerCase();
                    const phone = mapped.phone ?? '';
                    const tierName = mapped.tierName || '';

                    const isDuplicate = Boolean(email) && (existingEmails.has(email) || seenInFile.has(email));
                    if (email) seenInFile.add(email);

                    const valid = Boolean(name) && Boolean(email) && !isDuplicate;
                    const reason = !name ? 'Name missing' : !email ? 'Email missing' : isDuplicate ? 'Already exists' : undefined;

                    return { name, email, phone, tierName, valid, reason, isDuplicate };
                });

                setRows(parsed);
            } catch (err) {
                console.error(err);
                setError('File parse nahi ho payi. .xlsx ya .csv try karein.');
            }
        };
        reader.readAsArrayBuffer(file);
    }, [existingAttendees]);

    // NEW — sample .xlsx generate karke browser se directly download karwata hai
    const handleDownloadSample = useCallback(() => {
        const sampleData = [
            { Name: 'Rahul Sharma', Email: 'rahul.sharma@example.com', Phone: '9876543210' },
            { Name: 'Priya Verma', Email: 'priya.verma@example.com', Phone: '9123456780' },
        ];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        ws['!cols'] = [{ wch: 20 }, { wch: 28 }, { wch: 15 }, { wch: 12 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Attendees');
        XLSX.writeFile(wb, 'attendee_import_sample.xlsx');
    }, []);
    const validRows = rows.filter((r) => r.valid);

    const handleImport = async () => {
        if (!companyId || !event || validRows.length === 0) return;
        setIsImporting(true);
        setError(null);
        try {
            // Firestore batch limit is 500 writes — chunk if needed
            const chunkSize = 450;
            for (let i = 0; i < validRows.length; i += chunkSize) {
                const batch = writeBatch(db);
                const chunk = validRows.slice(i, i + chunkSize);
                chunk.forEach((row, chunkIndex) => {
                    const ref = doc(collection(db, 'companies', companyId, 'events', event.id, 'attendees'));
                    // CHANGED — sequence continues from current attendee count, so imported
                    // tickets don't collide with ones already created via checkout/walk-in
                    const sequenceNumber = existingAttendees.length + i + chunkIndex + 1;
                    batch.set(ref, {
                        name: row.name,
                        email: row.email,
                        phone: row.phone,
                        tierName: row.tierName,
                        ticketId: genTicketId(event.title, sequenceNumber),
                        status: 'valid',
                        amountPaid: 0,
                        source: 'import',
                        customFieldAnswers: {},
                        createdAt: serverTimestamp(),
                    });
                });
                await batch.commit();
            }
            onSuccess(validRows.length);
            setRows([]);
            setFileName('');
            onClose();
        } catch (err) {
            console.error('Import failed:', err);
            setError('Import fail ho gaya, dobara try karein.');
        } finally {
            setIsImporting(false);
        }
    };
    // MOVED — ab ye check saare hooks ke baad hai, isliye hook count har render me same rehta hai
    if (!isOpen || !event) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" onClick={onClose}>
            <div
                className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-sm bg-white dark:bg-[#1E293B] shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 p-3">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Import attendees</h2>
                    <button onClick={onClose} className="rounded-sm p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
                        <X size={18} />
                    </button>
                </div>

                <div className="grow overflow-y-auto p-4 space-y-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Upload a .xlsx or .csv file — columns: <strong>Name, Email, Phone</strong> (Tier optional).
                        A Google Form response sheet export will work directly if the column names match.
                    </p>

                    {/* NEW — sample file jisme user attendee details fill karke seedha upload kar sake */}
                    <button
                        type="button"
                        onClick={handleDownloadSample}
                        className="flex w-full items-center justify-center gap-1.5 rounded-sm border border-dashed border-[#007A78]/40 dark:border-[#2DD4BF]/40 bg-teal-50/50 dark:bg-teal-950/20 px-3 py-2 text-xs font-semibold text-[#007A78] dark:text-[#2DD4BF] hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors"
                    >
                        <FileDown size={14} /> Download Sample Excel
                    </button>

                    <label className="flex flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 text-sm text-slate-500 cursor-pointer hover:border-[#007A78]">
                        <UploadCloud size={22} />
                        {fileName || 'Click to select a file'}
                        <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                        />
                    </label>

                    {error && (
                        <div className="flex items-center gap-2 rounded-sm bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
                            <AlertTriangle size={16} /> {error}
                        </div>
                    )}

                    {rows.length > 0 && (
                        <div className="space-y-1">
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                {validRows.length} of {rows.length} rows valid
                                {rows.length - validRows.length > 0 && ` (${rows.length - validRows.length} skipped — missing data or duplicate)`}
                            </p>
                            <div className="max-h-48 overflow-y-auto rounded-sm border border-slate-200 dark:border-slate-700 text-xs">
                                {rows.map((r, i) => (
                                    <div
                                        key={i}
                                        className={`flex items-center justify-between px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 ${r.valid ? '' : 'opacity-50'
                                            }`}
                                    >
                                        <span className="truncate">{r.name || '—'} · {r.email || '—'}</span>
                                        {r.valid ? <CheckCircle2 size={14} className="text-green-600 shrink-0" /> : (
                                            <span className="text-red-500 shrink-0">{r.reason}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 dark:border-slate-800 p-3">
                    <button onClick={onClose} className="rounded-sm border border-gray-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-slate-200">
                        Cancel
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={validRows.length === 0 || isImporting}
                        className="rounded-sm bg-[#007A78] dark:bg-[#2DD4BF] px-4 py-2 text-sm font-semibold text-white dark:text-slate-950 disabled:opacity-40"
                    >
                        {isImporting ? 'Importing…' : `Import ${validRows.length || ''} attendees`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportAttendeesModal;