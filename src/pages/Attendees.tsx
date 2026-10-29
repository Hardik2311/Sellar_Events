import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { CheckCircle2, XCircle, Eye, UserPlus, UploadCloud, Wallet, X, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import AddWalkInAttendeeModal from '../components/AddWalkInAttendeeModal';
import ImportAttendeesModal from '../components/ImportAttendeesModal'; // NEW
import InviteSpecialGuestModal from '../components/InviteSpecialGuestModal';
import SpecialGuestAddedModal, { type AddedGuest } from '../components/SpecialGuestAddedModal';
import TicketConfirmation from '../components/TicketConfirmation';
import BackButton from '../components/ui/BackButton';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { Attendee } from '../types/attendee.types';
import type { EventSummary } from '../types/event.types';
import { buildEventSlugId } from '../data/events';
import { getShareBaseUrl } from '../lib/shareLinks';
import { stripHtmlTags } from '../lib/utils';
import EventListCard from '../components/EventListCard';
import AttendeeCard from '../components/AttendeeCard';
import { Card, CardContent } from '../components/ui/card';
import QRScanner from '../components/QrScannerModal';
import ConfirmCheckInModal from '../components/ConfirmCheckInModal';
import GroupCheckInModal from '../components/GroupCheckInModal';
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
import { loadTicketPdfHero } from '../lib/ticketPdf';

// Matches the PDF acknowledgement's banner box in AttendeeCard.tsx.

type SortOption = 'name_asc' | 'name_desc' | 'purchased_first' | 'purchased_last' | 'checked_in' | 'pending' | 'cancelled';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name_asc', label: ' A to Z ' },
  { value: 'name_desc', label: 'Z to A' },
  { value: 'purchased_first', label: 'Ticket: first - last' },
  { value: 'purchased_last', label: 'Ticket: last - first' },
  { value: 'checked_in', label: 'Checked in' },
  { value: 'pending', label: 'Pending / not arrived' },
  { value: 'cancelled', label: 'Cancelled' },
];

// purchasedAt is the source of truth for when the ticket was bought;
// createdAt is the fallback for older records that predate that field.
const getPurchaseTime = (a: Attendee): number => a.purchasedAt ?? a.createdAt ?? 0;

const getAttendeeType = (a: Attendee): string => {
  if (a.source === 'import') return 'Imported';
  if (a.source === 'special_guest') return 'Special Guest';
  // paymentMode (Cash/UPI/Card...) is only set for organizer-added walk-ins,
  // so it works as a fallback for walk-ins saved without `source`
  if (a.source === 'walk_in' || (!a.paymentMethod && a.paymentMode)) return 'Walk-in';
  if (a.paymentMethod === 'manual_qr') return 'QR Paid';
  return 'Payment Gateway';
};

const getPaymentModeLabel = (a: Attendee): string => {
  if (a.source === 'import' || a.source === 'special_guest') return '';
  if (a.source === 'walk_in') return a.paymentMode ?? ''; // Cash / UPI / Card / ... as chosen by organizer
  if (a.paymentMode && !a.paymentMethod) return a.paymentMode; // walk-in saved without `source`
  if (a.paymentMethod === 'manual_qr') return 'QR';
  return 'Gateway';
};

const EXPORT_COLUMNS: ExportColumn<Attendee>[] = [
  { header: 'Name', accessor: (a) => a.name },
  { header: 'Email', accessor: (a) => a.email },
  { header: 'Phone', accessor: (a) => a.phone },
  { header: 'Tier', accessor: (a) => a.tierName },
  { header: 'Ticket ID', accessor: (a) => a.ticketId },
  { header: 'Attendee Type', accessor: (a) => getAttendeeType(a) },
  { header: 'Guest Category', accessor: (a) => a.guestCategory ?? '' },
  { header: 'Payment Mode', accessor: (a) => getPaymentModeLabel(a) },
  { header: 'Amount Paid', accessor: (a) => a.amountPaid ?? 0 },
  { header: 'Status', accessor: (a) => a.status },
  { header: 'Checked in at', accessor: (a) => (a.checkedInAt ? new Date(a.checkedInAt).toLocaleString('en-IN') : '') },
];
const toEventSummary = (id: string, data: any): EventSummary => {
  const tiers = (data.tiers ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    price: t.price,
    sold: Number.isFinite(t.sold) ? t.sold : 0,
    guestSold: Number.isFinite(t.guestSold) ? t.guestSold : 0,
    total: t.quantity,
  }));
  return {
    id,
    title: data.title,
    coverImage: data.coverImageDesktop || data.coverImageMobile || data.coverImageUrl || undefined,
    posterImage: data.coverImageMobile || data.coverImageDesktop || data.coverImageUrl || undefined,
    category: data.category,
    status: data.status,
    startDate: data.date,
    time: data.time ?? undefined,
    venue: data.isOnline ? 'Online' : data.venue,
    ticketsSold: tiers.reduce((sum: number, t: any) => sum + t.sold, 0),
    ticketsTotal: tiers.reduce((sum: number, t: any) => sum + t.total, 0),
    revenue: tiers.reduce((sum: number, t: any) => sum + (t.sold - t.guestSold) * (t.price || 0), 0),
    description: data.description,
    tiers,
    customFields: data.customFields ?? [],
    salesTrend: data.salesTrend ?? [],
    registrationMode: data.registrationMode,
    isOnline: data.isOnline ?? false,
    isPrivate: data.isPrivate ?? false,
    consentText: data.consentText,
    goodToKnowText: data.goodToKnowText,
    arriveByTime: data.arriveByTime ?? null,
    ageLimit: data.ageLimit ?? null,
    helplineNumber: data.helplineNumber ?? null,
    upiId: data.upiId ?? undefined,
    payeeName: data.payeeName ?? undefined,
  };
};

const toAttendee = (id: string, eventId: string, data: any): Attendee => ({
  id,
  eventId,
  name: data.name,
  email: data.email,
  phone: data.phone,
  tierName: data.tierName,
  ticketTierId: data.ticketTierId ?? undefined,
  ticketId: data.ticketId,
  status: data.status,
  checkedInAt: data.checkedInAt instanceof Timestamp ? data.checkedInAt.toDate().toISOString() : null,
  customFieldAnswers: data.customFieldAnswers ?? {},
  amountPaid: Number(data.amountPaid ?? 0),
  paymentMode: data.paymentMode ?? undefined,
  paymentMethod: data.paymentMethod ?? undefined,
  screenshotUrl: data.screenshotUrl ?? undefined,
  razorpayPaymentId: data.razorpayPaymentId ?? undefined,
  accessCode: data.accessCode ?? undefined,
  purchasedAt: data.purchasedAt instanceof Timestamp ? data.purchasedAt.toMillis() : undefined,
  createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : undefined,
  bookingGroupId: data.bookingGroupId ?? null,
  // Walk-ins are saved with isWalkIn: true (lib/ticketing.ts), not a source field.
  source: data.source ?? (data.isWalkIn ? 'walk_in' : 'ticket'),
  guestCategory: data.guestCategory ?? undefined,
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
  // Group booking awaiting "how many arrived?" (one QR admits the whole group)
  const [pendingGroup, setPendingGroup] = useState<{ members: Attendee[]; initialArrived: number } | null>(null);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false); // NEW
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [guestAdded, setGuestAdded] = useState<AddedGuest | null>(null);
  const [guestFilter, setGuestFilter] = useState<'all' | 'regular' | 'guests'>('all');
  const [walkInTickets, setWalkInTickets] = useState<{
    ticketId: string;
    tierName: string;
    attendeeName: string;
    attendeeEmail?: string;
    attendeePhone?: string;
    amountPaid?: number;
    paymentMode?: string;
    purchasedAt?: number;
    isComplimentary?: boolean;
  }[] | null>(null);
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

  const [pdfBannerDataUrl, setPdfBannerDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setPdfBannerDataUrl(null);
    // PDF hero is wide, so use the desktop-first cover; portrait is the fallback.
    if (!selectedEvent?.coverImage) return;
    loadTicketPdfHero(selectedEvent.coverImage).then((dataUrl) => {
      if (!cancelled) setPdfBannerDataUrl(dataUrl);
    });
    return () => { cancelled = true; };
  }, [selectedEvent?.coverImage]);

  // "Book more tickets" link inside the ticket PDF — same URL that "Live view"
  // opens (organizer's own base URL + /e/<slug-id>) for THIS event only.
  // Resolved once per event so PDF generation at click time stays instant.
  const [bookMoreTicketsUrl, setBookMoreTicketsUrl] = useState<string | null>(null);
  const selectedEventId_ = selectedEvent?.id;
  const selectedEventTitle = selectedEvent?.title;
  const selectedEventStatus = selectedEvent?.status;
  useEffect(() => {
    let cancelled = false;
    setBookMoreTicketsUrl(null);
    if (!selectedEventId_ || !selectedEventTitle || selectedEventStatus !== 'published') return;

    const slug = buildEventSlugId(selectedEventTitle, selectedEventId_);
    const resolveBase = profile?.companyId
      ? getShareBaseUrl(profile.companyId)
      : Promise.resolve(window.location.origin);

    resolveBase
      .catch(() => window.location.origin)
      .then((baseUrl) => {
        if (!cancelled) setBookMoreTicketsUrl(`${baseUrl}/e/${slug}`);
      });

    return () => { cancelled = true; };
  }, [profile?.companyId, selectedEventId_, selectedEventTitle, selectedEventStatus]);

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

  // bookingGroupId -> its non-cancelled tickets (lead ticket first). Only
  // groups with 2+ live tickets get the group check-in flow.
  const bookingGroups = useMemo(() => {
    const map = new Map<string, Attendee[]>();
    attendees.forEach((a) => {
      if (!a.bookingGroupId || a.status === 'cancelled') return;
      map.set(a.bookingGroupId, [...(map.get(a.bookingGroupId) ?? []), a]);
    });
    map.forEach((members, groupId) =>
      members.sort((x, y) => (x.id === groupId ? -1 : y.id === groupId ? 1 : x.ticketId.localeCompare(y.ticketId)))
    );
    return map;
  }, [attendees]);

  const getGroupMembers = useCallback(
    (attendee: Attendee): Attendee[] | null => {
      const members = attendee.bookingGroupId ? bookingGroups.get(attendee.bookingGroupId) : undefined;
      return members && members.length > 1 ? members : null;
    },
    [bookingGroups]
  );

  // Defaults to "everyone arrived" — the usual case when a group shows its QR
  // at the gate; staff lower it if only some of them are here yet.
  const openGroupCheckIn = useCallback((members: Attendee[]) => {
    setPendingGroup({ members, initialArrived: members.length });
  }, []);

  // Sets exactly `arrivedCount` tickets in the group to checked-in. Tickets
  // already checked in keep their original check-in time.
  const handleGroupCheckIn = useCallback(
    (arrivedCount: number) => {
      const companyId = profile?.companyId;
      if (!pendingGroup || !companyId || !selectedEventId) return;
      const ordered = [...pendingGroup.members].sort(
        (a, b) => Number(b.status === 'checked_in') - Number(a.status === 'checked_in')
      );
      const changes = ordered
        .map((a, i) => ({ attendee: a, shouldBeIn: i < arrivedCount }))
        .filter(({ attendee, shouldBeIn }) => (attendee.status === 'checked_in') !== shouldBeIn);

      const nowIso = new Date().toISOString();
      const changedIds = new Map(changes.map(({ attendee, shouldBeIn }) => [attendee.id, shouldBeIn]));
      setAttendees((prev) =>
        prev.map((a) =>
          changedIds.has(a.id)
            ? { ...a, status: changedIds.get(a.id) ? 'checked_in' : 'valid', checkedInAt: changedIds.get(a.id) ? nowIso : null }
            : a
        )
      );

      const batch = writeBatch(db);
      changes.forEach(({ attendee, shouldBeIn }) => {
        batch.update(doc(db, 'companies', companyId, 'events', selectedEventId, 'attendees', attendee.id), {
          status: shouldBeIn ? 'checked_in' : 'valid',
          checkedInAt: shouldBeIn ? serverTimestamp() : null,
        });
      });
      batch.commit().catch((err) => {
        console.error('Group check-in failed:', err);
        setScanFeedback({ type: 'error', message: 'Group check-in failed, please retry.' });
      });

      setScanFeedback({
        type: 'success',
        message: `${pendingGroup.members[0].name}'s group: ${arrivedCount} of ${pendingGroup.members.length} arrived.`,
      });
      setPendingGroup(null);
    },
    [pendingGroup, profile?.companyId, selectedEventId]
  );

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
        screenshotUrl?: string | null;
      }
    ) => {
      if (!profile?.companyId || !selectedEventId) return;

      // ticketTierId maps to Firestore's ticketTierId field, not "tierId" — rename before writing
      const { tierId, ...rest } = updates;
      const writePayload = { ...rest, ...(tierId ? { ticketTierId: tierId } : {}) };

      // Optimistic update — UI turant reflect kare, listener confirm kar dega
      setAttendees((prev) => prev.map((a) => (a.id === id ? { ...a, ...writePayload } : a)));

      const attendeeRef = doc(db, 'companies', profile.companyId, 'events', selectedEventId, 'attendees', id);
      const eventRef = doc(db, 'companies', profile.companyId, 'events', selectedEventId);

      // Same fallback EditAttendeeModal uses to find the attendee's CURRENT
      // tier (older records predate ticketTierId and only have tierName).
      const previousTierId = pendingEditAttendee
        ? selectedEvent?.tiers.find(
          (t) => t.id === pendingEditAttendee.ticketTierId || t.name === pendingEditAttendee.tierName
        )?.id
        : undefined;
      const tierChanged = !!tierId && !!previousTierId && tierId !== previousTierId;

      // Moving an attendee to a different tier without also moving their
      // seat in tiers[].sold is exactly how sold counts quietly drift from
      // the real attendee count — the Discover page's "X sold" badge reads
      // straight from tiers[].sold, so it'd undercount the new tier and
      // overcount the old one forever after a plain updateDoc here.
      const savePromise = tierChanged
        ? runTransaction(db, async (transaction) => {
          const eventSnap = await transaction.get(eventRef);
          if (!eventSnap.exists()) throw new Error('Event no longer exists.');
          const currentTiers = (eventSnap.data().tiers || []) as { id: string; sold?: number }[];
          const updatedTiers = currentTiers.map((t) => {
            if (t.id === previousTierId) return { ...t, sold: Math.max(0, (t.sold ?? 0) - 1) };
            if (t.id === tierId) return { ...t, sold: (t.sold ?? 0) + 1 };
            return t;
          });
          transaction.update(eventRef, { tiers: updatedTiers });
          transaction.update(attendeeRef, writePayload);
        })
        : updateDoc(attendeeRef, writePayload);

      savePromise
        .then(() => {
          setScanFeedback({ type: 'success', message: `${updates.name}'s details updated.` });
        })
        .catch((err) => {
          console.error('Edit failed:', err);
          setScanFeedback({ type: 'error', message: 'Update failed, please retry.' });
        });

      setPendingEditAttendee(null);
    },
    [profile?.companyId, selectedEventId, pendingEditAttendee, selectedEvent]
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

      const group = getGroupMembers(match);
      if (group) {
        openGroupCheckIn(group);
        return;
      }
      setPendingAttendee(match);
    },
    [attendees, selectedEvent, isEventDateInFuture, getGroupMembers, openGroupCheckIn]
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

  const handleWalkInAdded = useCallback(
    (
      data: {
        name: string;
        ticketId: string;
        tierName: string;
        email: string;
        phone: string;
        amountPaid: number;
        paymentMode: string;
      }[]
    ) => {
      setScanFeedback({
        type: 'success',
        message:
          data.length > 1
            ? `${data.length} attendees added as walk-in (${data[0].ticketId}–${data[data.length - 1].ticketId}).`
            : `${data[0].name} added as walk-in (${data[0].ticketId}).`,
      });
      const purchasedAt = Date.now();
      setWalkInTickets(
        data.map((d) => ({
          ticketId: d.ticketId,
          tierName: d.tierName,
          attendeeName: d.name,
          attendeeEmail: d.email,
          attendeePhone: d.phone,
          amountPaid: d.amountPaid,
          paymentMode: d.paymentMode,
          purchasedAt,
        }))
      );
    },
    []
  );
  const handleGuestAdded = useCallback(
    (g: { name: string; email: string; phone: string; ticketId: string; tierName: string; guestCategory: string }) => {
      setScanFeedback({ type: 'success', message: `${g.name} added as ${g.guestCategory} (${g.ticketId}).` });
      setGuestAdded(g);
    },
    []
  );
  // Auto-clear the scan feedback banner after a few seconds
  useEffect(() => {
    if (!scanFeedback) return;
    const timer = setTimeout(() => setScanFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [scanFeedback]);

  const scopedAttendees = useMemo(() => {
    if (guestFilter === 'guests') return attendees.filter((a) => a.source === 'special_guest');
    if (guestFilter === 'regular') return attendees.filter((a) => a.source !== 'special_guest');
    return attendees;
  }, [attendees, guestFilter]);

  const searchedAttendees = useMemo(() => {
    if (!searchValue.trim()) return scopedAttendees;
    const q = searchValue.toLowerCase().trim();
    return scopedAttendees.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.phone.includes(q) ||
        a.ticketId.toLowerCase().includes(q)
    );
  }, [scopedAttendees, searchValue]);

  const sortedAttendees = useMemo(() => {
    switch (sortOption) {
      case 'name_asc':
        return [...searchedAttendees].sort((a, b) => a.name.localeCompare(b.name));
      case 'name_desc':
        return [...searchedAttendees].sort((a, b) => b.name.localeCompare(a.name));
      case 'purchased_first':
        return [...searchedAttendees].sort((a, b) => getPurchaseTime(a) - getPurchaseTime(b));
      case 'purchased_last':
        return [...searchedAttendees].sort((a, b) => getPurchaseTime(b) - getPurchaseTime(a));
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

  // A group booking shows as ONE row (its first ticket in the current
  // order/filter), with the group's size, ticket IDs and arrivals on it.
  // Cancelled tickets have left their group and keep their own row.
  const listedAttendees = useMemo(() => {
    const seenGroups = new Set<string>();
    return sortedAttendees.filter((a) => {
      if (a.status === 'cancelled' || !a.bookingGroupId || !getGroupMembers(a)) return true;
      if (seenGroups.has(a.bookingGroupId)) return false;
      seenGroups.add(a.bookingGroupId);
      return true;
    });
  }, [sortedAttendees, getGroupMembers]);

  const stats = useMemo(() => {
    const checkedIn = attendees.filter((a) => a.status === 'checked_in').length;
    const cancelled = attendees.filter((a) => a.status === 'cancelled').length;
    const pending = attendees.filter((a) => a.status === 'valid').length;
    const tierCounts: Record<string, number> = {};
    attendees.forEach((a) => {
      if (a.status !== 'cancelled') tierCounts[a.tierName] = (tierCounts[a.tierName] || 0) + 1;
    });
    const guests = attendees.filter((a) => a.source === 'special_guest' && a.status !== 'cancelled').length;
    return { total: attendees.length, checkedIn, pending, cancelled, tierCounts, guests };
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
      if (!target) return;
      const group = getGroupMembers(target);
      if (group) {
        openGroupCheckIn(group);
        return;
      }
      setPendingAttendee(target);
    },
    [attendees, selectedEvent, isEventDateInFuture, getGroupMembers, openGroupCheckIn]
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
          title="Event credits click to recharge"
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
                {can(Permission.IMPORT_ATTENDEES) && (
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
                {can(Permission.ADD_WALK_IN_ATTENDEE) && (
                  <button
                    onClick={() => {
                      if (selectedEvent.status !== 'published') {
                        setScanFeedback({ type: 'error', message: 'Publish the event before inviting special guests.' });
                        return;
                      }
                      setIsGuestModalOpen(true);
                    }}
                    disabled={selectedEvent.status !== 'published'}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-amber-400 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-700 hover:bg-amber-100 transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed dark:bg-amber-500/10 dark:text-amber-300"
                  >
                    <Star size={14} /> Special Guest
                  </button>
                )}
              </div>

              {/* Filter toggle */}
              <div className="flex w-full gap-1 rounded-sm border border-slate-200 bg-white p-1 shadow-xs dark:border-slate-700 dark:bg-slate-800 sm:w-fit">
                {([['all', 'All'], ['regular', 'Regular'], ['guests', `Guests (${stats.guests})`]] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setGuestFilter(val)}
                    className={`flex-1 whitespace-nowrap rounded-sm px-4 py-2 text-xs font-bold transition-colors cursor-pointer sm:flex-none sm:px-5 ${guestFilter === val
                      ? 'bg-[#007A78] text-white dark:bg-[#2DD4BF] dark:text-slate-950'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                  >
                    {label}
                  </button>
                ))}
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
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
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
                      fileNameBase={stripHtmlTags(selectedEvent.title)}
                      documentTitle={`${stripHtmlTags(selectedEvent.title)} Attendees`}
                      organizationName={profile?.organizationName || profile?.fullName || 'Organizer'}
                      disabled={attendees.length === 0}
                    />
                  </ShowWrapper>
                </div>
              </div>

              {/* 5. Attendee list */}
              {isLoadingAttendees ? (
                <div className="text-center py-10 text-sm text-gray-500">Loading attendees…</div>
              ) : listedAttendees.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-500">
                  {attendees.length === 0
                    ? 'No tickets sold for this event yet'
                    : guestFilter === 'guests' && !searchValue.trim()
                      ? 'No special guests invited yet'
                      : 'No attendees match your search'}
                </div>
              ) : (
                <div>
                  {listedAttendees.map((attendee) => (
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
                      eventCategory={selectedEvent.category}
                      eventDate={selectedEvent.startDate}
                      eventTime={selectedEvent.time}
                      eventVenue={selectedEvent.venue}
                      eventBannerDataUrl={pdfBannerDataUrl}
                      eventConsentText={selectedEvent.consentText}
                      eventGoodToKnowText={selectedEvent.goodToKnowText}
                      eventIsOnline={selectedEvent.isOnline}
                      eventIsPrivate={selectedEvent.isPrivate}
                      eventArriveBy={selectedEvent.arriveByTime}
                      eventAgeLimit={selectedEvent.ageLimit}
                      eventHelplineNumber={selectedEvent.helplineNumber}
                      bookMoreTicketsUrl={bookMoreTicketsUrl}
                      customFields={selectedEvent.customFields}
                      groupInfo={(() => {
                        if (attendee.status === 'cancelled') return undefined;
                        const group = getGroupMembers(attendee);
                        if (!group) return undefined;
                        const tiers = Array.from(new Set(group.map((m) => m.tierName)));
                        return {
                          size: group.length,
                          arrived: group.filter((m) => m.status === 'checked_in').length,
                          ticketIds: group.map((m) => m.ticketId).sort((x, y) => x.localeCompare(y)),
                          tierLabel: tiers.length === 1 ? `${tiers[0]} × ${group.length}` : `${group.length} tickets`,
                        };
                      })()}
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
      <GroupCheckInModal
        members={pendingGroup?.members ?? null}
        initialArrived={pendingGroup?.initialArrived ?? 0}
        onConfirm={handleGroupCheckIn}
        onCancel={() => setPendingGroup(null)}
      />
      <EditAttendeeModal
        attendee={pendingEditAttendee}
        event={selectedEvent}
        companyId={profile?.companyId}
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
      <InviteSpecialGuestModal
        isOpen={isGuestModalOpen}
        onClose={() => setIsGuestModalOpen(false)}
        event={selectedEvent}
        companyId={profile?.companyId}
        onSuccess={handleGuestAdded}
      />
      <SpecialGuestAddedModal
        guest={guestAdded}
        event={selectedEvent}
        eventBannerDataUrl={pdfBannerDataUrl}
        bookMoreTicketsUrl={bookMoreTicketsUrl}
        onClose={() => setGuestAdded(null)}
      />
      {walkInTickets && walkInTickets.length > 0 && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-sm sm:rounded-sm bg-white dark:bg-slate-900 shadow-xl">
            <button
              onClick={() => setWalkInTickets(null)}
              className="absolute right-3 top-3 z-10 rounded-sm bg-black/5 p-1.5 text-slate-500 hover:bg-black/10 hover:text-slate-700 dark:bg-white/10 dark:text-slate-300"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <TicketConfirmation
              eventTitle={selectedEvent.title}
              eventCategory={selectedEvent.category}
              eventDate={selectedEvent.startDate}
              eventVenue={selectedEvent.venue}
              eventTime={selectedEvent.time}
              tickets={walkInTickets.map((t) => ({ ...t, status: 'valid' }))}
              onDone={() => setWalkInTickets(null)}
              eventBannerDataUrl={pdfBannerDataUrl}
              eventPosterUrl={selectedEvent.posterImage}
              eventConsentText={selectedEvent.consentText}
              eventGoodToKnowText={selectedEvent.goodToKnowText}
              eventIsOnline={selectedEvent.isOnline}
              eventIsPrivate={selectedEvent.isPrivate}
              eventArriveBy={selectedEvent.arriveByTime}
              eventAgeLimit={selectedEvent.ageLimit}
              eventHelplineNumber={selectedEvent.helplineNumber}
              bookMoreTicketsUrl={bookMoreTicketsUrl}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendees;