import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { CheckCircle2, XCircle, Eye, UserPlus, UploadCloud, Wallet, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import AddWalkInAttendeeModal from '../components/AddWalkInAttendeeModal';
import ImportAttendeesModal from '../components/ImportAttendeesModal'; // NEW
import TicketConfirmation from '../components/TicketConfirmation';
import BackButton from '../components/ui/BackButton';
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
import type { Attendee } from '../types/attendee.types';
import type { EventSummary } from '../types/event.types';
import { buildEventSlugId } from '../data/events';
import { getShareBaseUrl } from '../lib/shareLinks';
import EventListCard from '../components/EventListCard';
import AttendeeCard from '../components/AttendeeCard';
import { Card, CardContent } from '../components/ui/card';
import QRScanner from '../components/QrScannerModal';
import ConfirmCheckInModal from '../components/ConfirmCheckInModal';
import SearchBar from '../components/SearchBar';
import ExportMenu from '../components/ExportMenu';
import type { ExportColumn } from '../components/ExportMenu';
import { Permission } from '../types/permissions.types';
import { usePermissions } from '../hooks/usePermissions';
import ShowWrapper from '../components/ShowWrapper';
import ConfirmCancelModal from '../components/ConfirmCancelModal';
import ConfirmReviveModal from '../components/ConfirmReviveModal';
import EditAttendeeModal from '../components/EditAttendeeModal';
import { useEventCredits } from '../hooks/useEventCredits';

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
    coverImage: data.coverImageDesktop || data.coverImageMobile || data.coverImageUrl || undefined,
    category: data.category,
    status: data.status,
    startDate: data.date,
    venue: data.isOnline ? 'Online' : data.venue,
    ticketsSold: 0,
    ticketsTotal: tiers.reduce((sum: number, t: any) => sum + t.total, 0),
    revenue: 0,
    description: data.description,
    tiers,
    customFields: data.customFields ?? [],
    salesTrend: data.salesTrend ?? [],
    registrationMode: data.registrationMode,
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
  customFieldAnswers: data.customFieldAnswers ?? {},
  amountPaid: Number(data.amountPaid ?? 0),
  paymentMode: data.paymentMode ?? undefined,
  paymentMethod: data.paymentMethod ?? undefined,
  screenshotUrl: data.screenshotUrl ?? undefined,
});
const Attendees: React.FC = () => {
  const { profile } = useAuth();
  const { can } = usePermissions(); // MOVED — hooks must run inside the component, not at module scope
  const { credits, loading: creditsLoading } = useEventCredits();
  const [events, setEvents] = useState<EventSummary[]>([]);

  const [selectedEventId, setSelectedEventId] = useState('');
  const [eventSearchValue, setEventSearchValue] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('name_asc');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [pendingAttendee, setPendingAttendee] = useState<Attendee | null>(null);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false); // NEW
  const [walkInTicket, setWalkInTicket] = useState<{ ticketId: string; tierName: string; attendeeName: string } | null>(null);
  const [pendingCancelAttendee, setPendingCancelAttendee] = useState<Attendee | null>(null);
  const [pendingReviveAttendee, setPendingReviveAttendee] = useState<Attendee | null>(null);
  const [pendingEditAttendee, setPendingEditAttendee] = useState<Attendee | null>(null);

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

  // Check-in should only be allowed on/after the event's date (date-only comparison, time ignored)
  const isEventDateInFuture = useCallback((event: EventSummary | null): boolean => {
    if (!event?.startDate) return false;
    const eventDate = new Date(event.startDate);
    const today = new Date();
    eventDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return eventDate.getTime() > today.getTime();
  }, []);

  const handleEventChange = (eventId: string) => {
    setSelectedEventId(eventId);
    setSearchValue('');
    setExpandedId(null);
  };

  const handleCheckIn = useCallback(
    (id: string) => {
      if (!profile?.companyId || !selectedEventId) return;
      const current = attendees.find((a) => a.id === id);
      const isCurrentlyCheckedIn = current?.status === 'checked_in';

      // Only block fresh check-ins before the event date; still allow undoing an existing check-in
      if (!isCurrentlyCheckedIn && isEventDateInFuture(selectedEvent)) {
        setScanFeedback({ type: 'error', message: 'Check-in is not available before the event date.' });
        return;
      }

      const nextStatus: Attendee['status'] = isCurrentlyCheckedIn ? 'valid' : 'checked_in';

      // Optimistic update — UI turant respond kare, snapshot listener khud bhi confirm kar dega
      setAttendees((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, status: nextStatus, checkedInAt: isCurrentlyCheckedIn ? null : new Date().toISOString() } : a
        )
      );
      const attendeeRef = doc(db, 'companies', profile.companyId, 'events', selectedEventId, 'attendees', id);
      updateDoc(attendeeRef, {
        status: nextStatus,
        checkedInAt: isCurrentlyCheckedIn ? null : serverTimestamp(),
      }).catch((err) => {
        console.error('Check-in update failed:', err);
        setScanFeedback({ type: 'error', message: 'Check-in update failed, please retry.' });
      });
    },
    [profile?.companyId, selectedEventId, attendees]
  );
  const requestCancel = useCallback(
    (id: string) => {
      const target = attendees.find((a) => a.id === id);
      if (target) setPendingCancelAttendee(target);
    },
    [attendees]
  );
  const handleCancel = useCallback(
    (id: string) => {
      if (!profile?.companyId || !selectedEventId) return;
      // Optimistic update — turant UI me cancelled dikhao, listener confirm kar dega
      setAttendees((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'cancelled' } : a))
      );
      const attendeeRef = doc(db, 'companies', profile.companyId, 'events', selectedEventId, 'attendees', id);
      updateDoc(attendeeRef, { status: 'cancelled' }).catch((err) => {
        console.error('Cancel failed:', err);
        setScanFeedback({ type: 'error', message: 'Cancel failed, please retry.' });
      });
    },
    [profile?.companyId, selectedEventId]
  );

  const handleRevive = useCallback(
    (id: string) => {
      if (!profile?.companyId || !selectedEventId) return;
      // Optimistic update — turant UI me valid dikhao, listener confirm kar dega
      setAttendees((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'valid' } : a))
      );
      const attendeeRef = doc(db, 'companies', profile.companyId, 'events', selectedEventId, 'attendees', id);
      updateDoc(attendeeRef, { status: 'valid' }).catch((err) => {
        console.error('Revive failed:', err);
        setScanFeedback({ type: 'error', message: 'Revive failed, please retry.' });
      });
    },
    [profile?.companyId, selectedEventId]
  );

  const requestEdit = useCallback(
    (attendee: Attendee) => {
      setPendingEditAttendee(attendee);
    },
    []
  );

  const handleSaveEdit = useCallback(
    (
      id: string,
      updates: Pick<Attendee, 'name' | 'email' | 'phone' | 'tierName'> & {
        tierId?: string;
        amountPaid?: number;
        paymentMode?: Attendee['paymentMode'];
      }
    ) => {
      if (!profile?.companyId || !selectedEventId) return;

      // ticketTierId maps to Firestore's ticketTierId field, not "tierId" — rename before writing
      const { tierId, ...rest } = updates;
      const writePayload = { ...rest, ...(tierId ? { ticketTierId: tierId } : {}) };

      // Optimistic update — UI turant reflect kare, listener confirm kar dega
      setAttendees((prev) => prev.map((a) => (a.id === id ? { ...a, ...writePayload } : a)));

      const attendeeRef = doc(db, 'companies', profile.companyId, 'events', selectedEventId, 'attendees', id);
      updateDoc(attendeeRef, writePayload)
        .then(() => {
          setScanFeedback({ type: 'success', message: `${updates.name}'s details updated.` });
        })
        .catch((err) => {
          console.error('Edit failed:', err);
          setScanFeedback({ type: 'error', message: 'Update failed, please retry.' });
        });

      setPendingEditAttendee(null);
    },
    [profile?.companyId, selectedEventId]
  );

  const handleCancelEdit = useCallback(() => setPendingEditAttendee(null), []);
  // Opens the confirm-revive popup instead of reviving directly
  const requestRevive = useCallback(
    (id: string) => {
      const target = attendees.find((a) => a.id === id);
      if (target) setPendingReviveAttendee(target);
    },
    [attendees]
  );

  const handleConfirmRevive = useCallback(() => {
    if (!pendingReviveAttendee) return;
    handleRevive(pendingReviveAttendee.id);
    setScanFeedback({ type: 'success', message: `${pendingReviveAttendee.name}'s ticket revived.` });
    setPendingReviveAttendee(null);
  }, [pendingReviveAttendee, handleRevive]);

  const handleCancelRevive = useCallback(() => setPendingReviveAttendee(null), []);

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
      if (isEventDateInFuture(selectedEvent)) {
        setScanFeedback({
          type: 'error',
          message: `Check-in opens on ${selectedEvent ? new Date(selectedEvent.startDate).toLocaleDateString('en-IN') : 'the event date'}.`,
        });
        return;
      }

      setPendingAttendee(match);
    },
    [attendees, selectedEvent, isEventDateInFuture]
  );
  const handleConfirmCancel = useCallback(() => {
    if (!pendingCancelAttendee) return;
    handleCancel(pendingCancelAttendee.id);
    setScanFeedback({ type: 'success', message: `${pendingCancelAttendee.name}'s ticket cancelled.` });
    setPendingCancelAttendee(null);
  }, [pendingCancelAttendee, handleCancel]);

  const handleCancelCancel = useCallback(() => setPendingCancelAttendee(null), []);

  const handleConfirmCheckIn = useCallback(() => {
    if (!pendingAttendee) return;
    handleCheckIn(pendingAttendee.id);
    setScanFeedback({
      type: 'success',
      message: pendingAttendee.status === 'checked_in'
        ? `${pendingAttendee.name}'s check-in undone.`
        : `${pendingAttendee.name} checked in.`,
    });
    setPendingAttendee(null);
  }, [pendingAttendee, handleCheckIn]);

  const handleCancelConfirm = useCallback(() => {
    setPendingAttendee(null);
  }, []);

  const handleWalkInAdded = useCallback((name: string, ticketId: string, tierName: string) => {
    setScanFeedback({ type: 'success', message: `${name} added as walk-in (${ticketId}).` });
    setWalkInTicket({ ticketId, tierName, attendeeName: name });
  }, []);

  // Auto-clear the scan feedback banner after a few seconds
  useEffect(() => {
    if (!scanFeedback) return;
    const timer = setTimeout(() => setScanFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [scanFeedback]);

  const searchedAttendees = useMemo(() => {
    if (!searchValue.trim()) return attendees;
    const q = searchValue.toLowerCase().trim();
    return attendees.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.phone.includes(q) ||
        a.ticketId.toLowerCase().includes(q)
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
      case 'pending':
        return searchedAttendees.filter((a) => a.status === 'valid');
      case 'cancelled':
        return searchedAttendees.filter((a) => a.status === 'cancelled');
      default:
        return searchedAttendees;
    }
  }, [searchedAttendees, sortOption]);

  const stats = useMemo(() => {
    const checkedIn = attendees.filter((a) => a.status === 'checked_in').length;
    const cancelled = attendees.filter((a) => a.status === 'cancelled').length;
    const pending = attendees.filter((a) => a.status === 'valid').length;
    const tierCounts: Record<string, number> = {};
    attendees.forEach((a) => {
      if (a.status !== 'cancelled') tierCounts[a.tierName] = (tierCounts[a.tierName] || 0) + 1;
    });
    return { total: attendees.length, checkedIn, pending, cancelled, tierCounts };
  }, [attendees]);
  const requestCheckIn = useCallback(
    (id: string) => {
      if (isEventDateInFuture(selectedEvent)) {
        setScanFeedback({
          type: 'error',
          message: `Check-in opens on ${selectedEvent ? new Date(selectedEvent.startDate).toLocaleDateString('en-IN') : 'the event date'}.`,
        });
        return;
      }
      const target = attendees.find((a) => a.id === id);
      if (target) setPendingAttendee(target);
    },
    [attendees, selectedEvent, isEventDateInFuture]
  );
  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-16">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="relative sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-4 py-3 shadow-xs">
        <BackButton />
        <div className="absolute left-1/2 -translate-x-1/2 text-center flex flex-col items-center justify-center max-w-[65%]">
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate">Attendees</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">Guest list & real-time check-in</p>
        </div>
        <Link
          to="/events/account/recharge"
          className="flex items-center gap-1.5 rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 text-xs font-bold text-[#007A78] dark:text-[#2DD4BF] hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
          title="Event credits — click to recharge"
        >
          <Wallet size={16} />
          {creditsLoading ? '…' : credits}
        </Link>
      </header>

      <main className="grow overflow-y-auto p-2">
        <div className="mx-auto max-w-5xl flex flex-col gap-3">
          {/* 1. Event dropdown */}
          <EventListCard
            events={events}
            selectedEventId={selectedEventId}
            onSelect={handleEventChange}
            searchValue={eventSearchValue}
            onSearchChange={setEventSearchValue}
          />

          {selectedEvent && (
            <>
              {/* 2. Search bar + camera/QR scan icon */}
              <SearchBar
                value={searchValue}
                onChange={setSearchValue}
                onScanClick={can(Permission.SCAN_QR) ? () => setIsScannerOpen(true) : undefined}
                placeholder="Search by name , email or phone..."
              />

              {/* Scan feedback banner */}
              {scanFeedback && (
                <div
                  className={`flex items-center gap-2 rounded-sm px-3 py-2 text-sm ${scanFeedback.type === 'success'
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
                <CardContent className="pt-6 grid grid-cols-4 gap-2 sm:gap-3">
                  <div className="text-center min-w-0">
                    <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1 truncate">Total</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                  </div>
                  <div className="text-center min-w-0">
                    <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 truncate">Checked In</p>
                    <p className="text-lg sm:text-2xl font-extrabold text-[#007A78] dark:text-[#2DD4BF]">{stats.checkedIn}</p>
                  </div>
                  <div className="text-center min-w-0">
                    <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 truncate">Pending</p>
                    <p className="text-lg sm:text-2xl font-extrabold text-amber-600">{stats.pending}</p>
                  </div>
                  <div className="text-center min-w-0">
                    <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 truncate">Cancelled</p>
                    <p className="text-lg sm:text-2xl font-extrabold text-[#FF3B30]">{stats.cancelled}</p>
                  </div>
                </CardContent>
              </Card>

              {/* By Tier — still shown, just on its own row below so it can wrap freely */}
              {Object.keys(stats.tierCounts).length > 0 && (
                <Card className="shadow-sm border-gray-200">
                  <CardContent className="py-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">By Tier:</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 break-words">
                      {Object.entries(stats.tierCounts).map(([tier, count]) => `${tier}: ${count}`).join(' · ')}
                    </p>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2">
                {can(Permission.ADD_WALK_IN_ATTENDEE) && (
                  <button
                    onClick={() => {
                      if (selectedEvent.status !== 'published') {
                        setScanFeedback({ type: 'error', message: 'Publish the event before adding walk-in attendees.' });
                        return;
                      }
                      setIsWalkInModalOpen(true);
                    }}
                    disabled={selectedEvent.status !== 'published'}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-sm bg-[#007A78] hover:bg-[#006361] px-3 py-2.5 text-xs font-bold text-white transition-colors whitespace-nowrap dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5] dark:text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#007A78] dark:disabled:hover:bg-[#2DD4BF]"
                    title={selectedEvent.status !== 'published' ? 'Publish the event first to add walk-in attendees' : 'Add a walk-in / on-the-spot attendee'}
                  >
                    <UserPlus size={14} /> Add Walk-in
                  </button>
                )}
                {can(Permission.IMPORT_ATTENDEES) && selectedEvent.registrationMode === 'rsvp' && (
                  <button
                    onClick={() => {
                      if (selectedEvent.status !== 'published') {
                        setScanFeedback({ type: 'error', message: 'Publish the event before importing attendees.' });
                        return;
                      }
                      setIsImportModalOpen(true);
                    }}
                    disabled={selectedEvent.status !== 'published'}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-slate-800"
                    title={selectedEvent.status !== 'published' ? 'Publish the event first to import attendees' : 'Bulk import attendees from Excel/CSV (e.g. RSVP form responses)'}
                  >
                    <UploadCloud size={14} /> Import Excel
                  </button>
                )}
              </div>

              {/* 4b. Sorter + Live page + Export — back on one row, like before */}
              <div className="flex items-center gap-2">
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="w-28 shrink-0 min-w-0 rounded-sm border border-slate-200 dark:border-slate-800 bg-[#F9FAFB] dark:bg-[#1E293B] px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none shadow-xs"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {selectedEvent.status === 'published' && (
                  <button
                    onClick={async () => {
                      if (!profile?.companyId) return;
                      const baseUrl = await getShareBaseUrl(profile.companyId);
                      window.open(
                        `${baseUrl}/e/${buildEventSlugId(selectedEvent.title, selectedEvent.id)}`,
                        '_blank',
                        'noopener,noreferrer'
                      );
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
                    title="View public event page"
                  >
                    <Eye size={14} /> Live page
                  </button>
                )}
                <div className="shrink-0">
                  <ShowWrapper permission={Permission.EXPORT_ATTENDEES}>
                    <ExportMenu
                      data={attendees}
                      columns={EXPORT_COLUMNS}
                      fileNameBase={selectedEvent.title}
                      documentTitle={`${selectedEvent.title} — Attendees`}
                      disabled={attendees.length === 0}
                    />
                  </ShowWrapper>
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
                      onCheckIn={can(Permission.CHECK_IN_ATTENDEE) ? requestCheckIn : undefined}
                      onCancel={can(Permission.CANCEL_ATTENDEE) ? requestCancel : undefined}
                      onRevive={can(Permission.CANCEL_ATTENDEE) ? requestRevive : undefined}
                      onEdit={can(Permission.EDIT_ATTENDEE) ? requestEdit : undefined}
                      eventTitle={selectedEvent.title}
                      eventDate={selectedEvent.startDate}
                      customFields={selectedEvent.customFields}
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
      <ConfirmCancelModal
        attendee={pendingCancelAttendee}
        onConfirm={handleConfirmCancel}
        onCancel={handleCancelCancel}
      />
      <ConfirmReviveModal
        attendee={pendingReviveAttendee}
        onConfirm={handleConfirmRevive}
        onCancel={handleCancelRevive}
      />
      <ConfirmCheckInModal
        attendee={pendingAttendee}
        onConfirm={handleConfirmCheckIn}
        onCancel={handleCancelConfirm}
      />
      <EditAttendeeModal
        attendee={pendingEditAttendee}
        event={selectedEvent}
        onSave={handleSaveEdit}
        onCancel={handleCancelEdit}
      />

      <AddWalkInAttendeeModal
        isOpen={isWalkInModalOpen}
        onClose={() => setIsWalkInModalOpen(false)}
        event={selectedEvent}
        companyId={profile?.companyId}
        onSuccess={handleWalkInAdded}
      />
      <ImportAttendeesModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        event={selectedEvent}
        companyId={profile?.companyId}
        existingAttendees={attendees}
        onSuccess={(count) => setScanFeedback({ type: 'success', message: `${count} attendee(s) imported.` })}
      />
      {walkInTicket && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-sm sm:rounded-sm bg-white dark:bg-slate-900 shadow-xl">
            <button
              onClick={() => setWalkInTicket(null)}
              className="absolute right-3 top-3 z-10 rounded-sm bg-black/5 p-1.5 text-slate-500 hover:bg-black/10 hover:text-slate-700 dark:bg-white/10 dark:text-slate-300"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <TicketConfirmation
              eventTitle={selectedEvent.title}
              eventDate={selectedEvent.startDate}
              tickets={[walkInTicket]}
              onDone={() => setWalkInTicket(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendees;