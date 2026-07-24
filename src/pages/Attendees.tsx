import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Eye } from 'lucide-react';
import { SAMPLE_EVENT_DATA } from '../data/sampleEventData';
import { getAttendeesForEvent } from '../data/sampleAttendeeData';
import type { Attendee } from '../types/attendee.types';
import EventSelector from '../components/ui/EventSelector';
import AttendeeCard from '../components/AttendeeCard';
import { Card, CardContent } from '../components/ui/card';
import QRScanner from '../components/QrScannerModal';
import SearchBar from '../components/SearchBar';
import ExportMenu from '../components/ExportMenu';
import type { ExportColumn } from '../components/ExportMenu';

// TODO — backend wiring: replace getAttendeesForEvent with a real fetch
// scoped to the selected event, and wire onCheckIn to a mutation that
// updates ticket status + checkedInAt server-side.

type SortOption = 'name_asc' | 'name_desc' | 'checked_in' | 'pending' | 'cancelled';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name_asc', label: ' A to Z ' },
  { value: 'name_desc', label: 'Z to A' },
  { value: 'checked_in', label: 'Checked in' },
  { value: 'pending', label: 'Pending / not arrived' },
  { value: 'cancelled', label: 'Cancelled' },
];

const EXPORT_COLUMNS: ExportColumn<Attendee>[] = [
  { header: 'Name', accessor: (a) => a.name },
  { header: 'Email', accessor: (a) => a.email },
  { header: 'Phone', accessor: (a) => a.phone },
  { header: 'Tier', accessor: (a) => a.tierName },
  { header: 'Ticket ID', accessor: (a) => a.ticketId },
  { header: 'Status', accessor: (a) => a.status },
  { header: 'Checked in at', accessor: (a) => (a.checkedInAt ? new Date(a.checkedInAt).toLocaleString('en-IN') : '') },
];

const Attendees: React.FC = () => {
  const navigate = useNavigate();
  const [selectedEventId, setSelectedEventId] = useState(SAMPLE_EVENT_DATA.events[0]?.id ?? '');
  const [searchValue, setSearchValue] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>(() => getAttendeesForEvent(selectedEventId));
  const [sortOption, setSortOption] = useState<SortOption>('name_asc');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const selectedEvent = SAMPLE_EVENT_DATA.events.find((e) => e.id === selectedEventId) ?? null;

  const handleEventChange = (eventId: string) => {
    setSelectedEventId(eventId);
    setAttendees(getAttendeesForEvent(eventId));
    setSearchValue('');
    setExpandedId(null);
  };

  const handleCheckIn = useCallback((id: string) => {
    setAttendees((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'checked_in', checkedInAt: new Date().toISOString() } : a))
    );
    // TODO: POST /events/:eventId/attendees/:id/check-in
  }, []);

  const handleQrScan = useCallback(
    (decodedText: string) => {
      setIsScannerOpen(false);
      const match = attendees.find((a) => a.ticketId === decodedText);

      if (!match) {
        setScanFeedback({ type: 'error', message: 'No ticket found for this QR code.' });
        return;
      }
      if (match.status === 'cancelled') {
        setScanFeedback({ type: 'error', message: `${match.name}'s ticket is cancelled.` });
        return;
      }
      if (match.status === 'checked_in') {
        setScanFeedback({ type: 'error', message: `${match.name} is already checked in.` });
        return;
      }

      handleCheckIn(match.id);
      setScanFeedback({ type: 'success', message: `${match.name} checked in.` });
    },
    [attendees, handleCheckIn]
  );

  // Auto-clear the scan feedback banner after a few seconds
  useEffect(() => {
    if (!scanFeedback) return;
    const timer = setTimeout(() => setScanFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [scanFeedback]);

  const searchedAttendees = useMemo(() => {
    if (!searchValue.trim()) return attendees;
    const q = searchValue.toLowerCase();
    return attendees.filter(
      (a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.phone.includes(q)
    );
  }, [attendees, searchValue]);

  const sortedAttendees = useMemo(() => {
    switch (sortOption) {
      case 'name_asc':
        return [...searchedAttendees].sort((a, b) => a.name.localeCompare(b.name));
      case 'name_desc':
        return [...searchedAttendees].sort((a, b) => b.name.localeCompare(a.name));
      case 'checked_in':
        return searchedAttendees.filter((a) => a.status === 'checked_in');
      case 'cancelled':
        return searchedAttendees.filter((a) => a.status === 'cancelled');
      default:
        return searchedAttendees;
    }
  }, [searchedAttendees, sortOption]);

  const stats = useMemo(() => {
    const checkedIn = attendees.filter((a) => a.status === 'checked_in').length;
    const tierCounts: Record<string, number> = {};
    attendees.forEach((a) => {
      if (a.status !== 'cancelled') tierCounts[a.tierName] = (tierCounts[a.tierName] || 0) + 1;
    });
    return { total: attendees.length, checkedIn, tierCounts };
  }, [attendees]);

  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-100 mb-16">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-300 bg-gray-100 p-2">
        <button
          onClick={() => navigate('/events')}
          className="p-2 rounded-sm border border-slate-400 hover:bg-slate-200 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 text-center flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold text-slate-800">Attendees</h1>
          <p className="text-sm text-slate-500">Guest list for your event</p>
        </div>
        <div className="w-9" />
      </header>

      <main className="grow overflow-y-auto p-2">
        <div className="mx-auto max-w-3xl flex flex-col gap-3">
          {/* 1. Event dropdown */}
          <EventSelector events={SAMPLE_EVENT_DATA.events} selectedEventId={selectedEventId} onChange={handleEventChange} />

          {selectedEvent && (
            <>
              {/* 2. Search bar + camera/QR scan icon */}
              <SearchBar
                value={searchValue}
                onChange={setSearchValue}
                onScanClick={() => setIsScannerOpen(true)}
                placeholder="Search by name , email or phone..."
              />

              {/* Scan feedback banner */}
              {scanFeedback && (
                <div
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${scanFeedback.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                >
                  {scanFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  {scanFeedback.message}
                </div>
              )}

              {/* 3. Summary strip */}
              <Card className="shadow-sm border-gray-200">
                <CardContent className="pt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Total tickets</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Checked in</p>
                    <p className="text-2xl font-bold text-[#F97316]">{stats.checkedIn}</p>
                  </div>
                  <div className="text-center col-span-2 sm:col-span-1">
                    <p className="text-xs text-gray-500 mb-1">By tier</p>
                    <p className="text-xs font-medium text-gray-700">
                      {Object.entries(stats.tierCounts).map(([tier, count]) => `${tier}: ${count}`).join(' · ') || '—'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 4. Sorter + Export */}
              <div className="flex items-center gap-2">
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="w-24 shrink-0 min-w-0 rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700 focus:outline-none"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {selectedEvent.status === 'published' && (
                  <button
                    onClick={() => navigate(`/events/discover/${selectedEvent.id}`)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
                    title="View public event page"
                  >
                    <Eye size={14} /> Live page
                  </button>
                )}
                <div className="shrink-0">
                  <ExportMenu
                    data={attendees}
                    columns={EXPORT_COLUMNS}
                    fileNameBase={selectedEvent.title}
                    documentTitle={`${selectedEvent.title} — Attendees`}
                    disabled={attendees.length === 0}
                  />
                </div>
              </div>

              {/* 5. Attendee list */}
              {sortedAttendees.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-500">
                  {attendees.length === 0 ? 'No tickets sold for this event yet' : 'No attendees match your search'}
                </div>
              ) : (
                <div>
                  {sortedAttendees.map((attendee) => (
                    <AttendeeCard
                      key={attendee.id}
                      attendee={attendee}
                      isExpanded={expandedId === attendee.id}
                      onToggle={() => setExpandedId(expandedId === attendee.id ? null : attendee.id)}
                      onCheckIn={handleCheckIn}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <QRScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleQrScan}
        title="Scan ticket to check in"
      />
    </div>
  );
};

export default Attendees;