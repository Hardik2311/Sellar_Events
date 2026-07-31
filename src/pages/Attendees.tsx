import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Eye } from 'lucide-react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ui/ThemeToggle';
import type { Attendee } from '../types/attendee.types';
import type { EventSummary } from '../types/event.types';
import EventSelector from '../components/ui/EventSelector';
import AttendeeCard from '../components/AttendeeCard';
import { Card, CardContent } from '../components/ui/card';
import QRScanner from '../components/QrScannerModal';
import SearchBar from '../components/SearchBar';
import ExportMenu from '../components/ExportMenu';
import type { ExportColumn } from '../components/ExportMenu';

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
const toEventSummary = (id: string, data: any): EventSummary => {
  const tiers = (data.tiers ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    price: t.price,
    sold: 0,
    total: t.quantity,
  }));
  return {
    id,
    title: data.title,
    coverImage: data.coverImageUrl ?? undefined,
    category: data.category,
    status: data.status,
    startDate: data.date,
    venue: data.isOnline ? 'Online' : data.venue,
    ticketsSold: 0,
    ticketsTotal: tiers.reduce((sum: number, t: any) => sum + t.total, 0),
    revenue: 0,
    description: data.description,
    tiers,
  };
};

const toAttendee = (id: string, eventId: string, data: any): Attendee => ({
  id,
  eventId,
  name: data.name,
  email: data.email,
  phone: data.phone,
  tierName: data.tierName,
  ticketId: data.ticketId,
  status: data.status,
  checkedInAt: data.checkedInAt instanceof Timestamp ? data.checkedInAt.toDate().toISOString() : null,
});
const Attendees: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [events, setEvents] = useState<EventSummary[]>([]);

  const [selectedEventId, setSelectedEventId] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('name_asc');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Organizer ke saare events real-time load karo
  useEffect(() => {
    if (!profile?.companyId) return;
    const eventsRef = collection(db, 'companies', profile.companyId, 'events');
    const q = query(eventsRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => toEventSummary(d.id, d.data()));
      setEvents(list);

      // Pehli baar load hone pe ya current event delete/miss ho jaaye to fallback
      setSelectedEventId((prev) => (prev && list.some((e) => e.id === prev) ? prev : list[0]?.id ?? ''));
    });
    return () => unsubscribe();
  }, [profile?.companyId]);

  // Selected event ke attendees real-time load karo
  useEffect(() => {
    if (!profile?.companyId || !selectedEventId) {
      setAttendees([]);
      return;
    }
    setIsLoadingAttendees(true);
    const attendeesRef = collection(db, 'companies', profile.companyId, 'events', selectedEventId, 'attendees');
    const q = query(attendeesRef, orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAttendees(snapshot.docs.map((d) => toAttendee(d.id, selectedEventId, d.data())));
      setIsLoadingAttendees(false);
    });
    return () => unsubscribe();
  }, [profile?.companyId, selectedEventId]);

  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;

  const handleEventChange = (eventId: string) => {
    setSelectedEventId(eventId);
    setSearchValue('');
    setExpandedId(null);
  };

  const handleCheckIn = useCallback(
    (id: string) => {
      if (!profile?.companyId || !selectedEventId) return;
      // Optimistic update — UI turant respond kare, snapshot listener khud bhi confirm kar dega
      setAttendees((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'checked_in', checkedInAt: new Date().toISOString() } : a))
      );
      const attendeeRef = doc(db, 'companies', profile.companyId, 'events', selectedEventId, 'attendees', id);
      updateDoc(attendeeRef, { status: 'checked_in', checkedInAt: serverTimestamp() }).catch((err) => {
        console.error('Check-in failed:', err);
        setScanFeedback({ type: 'error', message: 'Check-in failed, please retry.' });
      });
    },
    [profile?.companyId, selectedEventId]
  );

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
    <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-16">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-4 py-3 shadow-xs">
        <button
          onClick={() => navigate('/events')}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
          title="Back to Events"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 text-center flex flex-col items-center justify-center">
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">Attendees</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Guest list & real-time check-in manager</p>
        </div>
        <ThemeToggle />
      </header>

      <main className="grow overflow-y-auto p-2">
        <div className="mx-auto max-w-3xl flex flex-col gap-3">
          {/* 1. Event dropdown */}
          <EventSelector events={events} selectedEventId={selectedEventId} onChange={handleEventChange} />

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
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Checked In</p>
                    <p className="text-2xl font-extrabold text-[#007A78] dark:text-[#2DD4BF]">{stats.checkedIn}</p>
                  </div>
                  <div className="text-center col-span-2 sm:col-span-1">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">By Tier</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
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
                  className="w-28 shrink-0 min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F9FAFB] dark:bg-[#1E293B] px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none shadow-xs"
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
              {isLoadingAttendees ? (
                <div className="text-center py-10 text-sm text-gray-500">Loading attendees…</div>
              ) : sortedAttendees.length === 0 ? (
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
                      eventTitle={selectedEvent.title}
                      eventDate={selectedEvent.startDate}
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