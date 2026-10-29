import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { CheckCircle2, ChevronDown, XCircle, Eye, UserPlus, UploadCloud, Wallet, X } from 'lucide-react';
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
  runTransaction,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { Attendee } from '../types/attendee.types';
import type { EventSummary } from '../types/event.types';
import { buildEventSlugId, findReferralCodeEntry } from '../data/events';
import { getShareBaseUrl } from '../lib/shareLinks';
import { stripHtmlTags } from '../lib/utils';
import EventListCard from '../components/EventListCard';
import { sortEventsForPicker } from '../lib/eventPicker';
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
import { useOrganizerEvents } from '../hooks/useOrganizerEvents';
import { CONFIRMED_TICKET_STATUSES } from '../types/attendee.types';
import type { ReferralDiscountType } from '../data/events';

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
    sold: Number.isFinite(t.sold) ? t.sold : 0,
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
    revenue: tiers.reduce((sum: number, t: any) => sum + t.sold * (t.price || 0), 0),
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
    taxType: data.taxType ?? null,
    referralCodesEnabled: data.referralCodesEnabled || false,
    referralCodes: (data.referralCodes || []).map((c: any) => ({
      code: c.code,
      label: c.label,
      discountType: c.discountType,
      discountValue: c.discountValue,
      previousCodes: c.previousCodes ?? [],
    })),
    referralDiscountType: data.referralDiscountType || 'percent',
    referralDiscountValue: typeof data.referralDiscountValue === 'number' ? data.referralDiscountValue : 10,
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
  razorpayPaymentId: data.razorpayPaymentId ?? undefined,
  accessCode: data.accessCode ?? undefined,
  referralCode: data.referralCode ?? undefined,
  referralDiscountAmount: typeof data.referralDiscountAmount === 'number' ? data.referralDiscountAmount : undefined,
  purchasedAt: data.purchasedAt instanceof Timestamp ? data.purchasedAt.toMillis() : undefined,
  createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : undefined,
  bookingGroupId: data.bookingGroupId ?? null,
  orderId: data.orderId ?? undefined,
  bookingId: data.bookingId ?? null,
  // Walk-ins are saved with isWalkIn: true (lib/ticketing.ts), not a source field.
  source: data.source ?? (data.isWalkIn ? 'walk_in' : 'ticket'),
});
// Everything bought in ONE purchase, whatever the names: gateway orders
// share orderId, free / manual-QR / walk-in bookings share bookingId. Older
// tickets without either fall back to the same-name bookingGroupId.
const purchaseKey = (a: Attendee) => a.orderId || a.bookingId || a.bookingGroupId || null;

const Attendees: React.FC = () => {
  const { profile } = useAuth();
  const { can } = usePermissions(); // MOVED — hooks must run inside the component, not at module scope
  const { credits, loading: creditsLoading } = useEventCredits();
  const { createReferralCode, updateReferralCode, deleteReferralCode } = useOrganizerEvents();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [isReferralSectionOpen, setIsReferralSectionOpen] = useState(false);
  const [isAddingReferralCode, setIsAddingReferralCode] = useState(false);
  // The code whose row is showing the edit form / the delete confirmation.
  const [editingReferralCode, setEditingReferralCode] = useState<string | null>(null);
  const [deletingReferralCode, setDeletingReferralCode] = useState<string | null>(null);
  const [newReferralCode, setNewReferralCode] = useState('');
  const [newReferralLabel, setNewReferralLabel] = useState('');
  const [newReferralDiscountType, setNewReferralDiscountType] = useState<ReferralDiscountType>('percent');
  const [newReferralDiscountValue, setNewReferralDiscountValue] = useState(10);
  const [referralCodeError, setReferralCodeError] = useState<string | null>(null);
  const [isSavingReferralCode, setIsSavingReferralCode] = useState(false);

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
  // Tickets bought together, awaiting "who is here?" (focusIds = what was scanned/tapped)
  const [pendingGroup, setPendingGroup] = useState<{ members: Attendee[]; focusIds: string[] } | null>(null);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false); // NEW
  const [walkInTickets, setWalkInTickets] = useState<{
    ticketId: string;
    tierName: string;
    attendeeName: string;
    attendeeEmail?: string;
    attendeePhone?: string;
    amountPaid?: number;
    paymentMode?: string;
    purchasedAt?: number;
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

      // Pehli baar load hone pe ya current event delete/miss ho jaaye to fallback —
      // the top of the dropdown (next upcoming event, else the most recent past one).
      const pickable = sortEventsForPicker(list);
      setSelectedEventId((prev) => (prev && pickable.some((e) => e.id === prev) ? prev : pickable[0]?.id ?? ''));
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

  // Live per-code stats — never trust a stored counter, derive from the
  // already-loaded confirmed attendee docs so refunds/cancellations are
  // reflected automatically.
  const referralCodeStats = (() => {
    const byCode = new Map<string, { ticketsSold: number; totalDiscount: number }>();
    attendees
      .filter((a) => a.referralCode && CONFIRMED_TICKET_STATUSES.has(a.status))
      .forEach((a) => {
        // Keyed by the code's current name, so a rename keeps its sales.
        const soldCode = (a.referralCode as string).trim().toUpperCase();
        const code = findReferralCodeEntry(selectedEvent?.referralCodes, soldCode)?.code ?? soldCode;
        const entry = byCode.get(code) ?? { ticketsSold: 0, totalDiscount: 0 };
        entry.ticketsSold += 1;
        entry.totalDiscount += a.referralDiscountAmount || 0;
        byCode.set(code, entry);
      });
    return byCode;
  })();

  const closeReferralForm = () => {
    setIsAddingReferralCode(false);
    setEditingReferralCode(null);
    setNewReferralCode('');
    setNewReferralLabel('');
    setReferralCodeError(null);
  };

  // A new code starts from the event's default discount.
  const startAddReferralCode = () => {
    closeReferralForm();
    setDeletingReferralCode(null);
    setNewReferralDiscountType(selectedEvent?.referralDiscountType || 'percent');
    setNewReferralDiscountValue(selectedEvent?.referralDiscountValue ?? 10);
    setIsAddingReferralCode(true);
  };

  const startEditReferralCode = (entry: NonNullable<EventSummary['referralCodes']>[number]) => {
    closeReferralForm();
    setDeletingReferralCode(null);
    setEditingReferralCode(entry.code);
    setNewReferralCode(entry.code);
    setNewReferralLabel(entry.label);
    setNewReferralDiscountType(entry.discountType);
    setNewReferralDiscountValue(entry.discountValue);
  };

  const handleSaveReferralCode = async () => {
    if (!selectedEvent) return;
    setReferralCodeError(null);
    setIsSavingReferralCode(true);
    try {
      if (editingReferralCode) {
        await updateReferralCode(selectedEvent.id, editingReferralCode, newReferralCode, newReferralLabel, newReferralDiscountType, newReferralDiscountValue);
      } else {
        await createReferralCode(selectedEvent.id, newReferralCode, newReferralLabel, newReferralDiscountType, newReferralDiscountValue);
      }
      closeReferralForm();
    } catch (err: any) {
      setReferralCodeError(
        err?.message === 'CODE_ALREADY_EXISTS'
          ? 'That code already exists for this event.'
          : err?.message === 'INVALID_DISCOUNT'
            ? 'Enter a valid discount (1-100% or a positive ₹ amount).'
            : err?.message === 'CODE_AND_LABEL_REQUIRED'
              ? 'Enter both a code and a label.'
              : err?.message === 'CODE_NOT_FOUND'
                ? 'This code was deleted in the meantime.'
                : 'Could not save the code — try again.'
      );
    } finally {
      setIsSavingReferralCode(false);
    }
  };

  const handleDeleteReferralCode = async (code: string) => {
    if (!selectedEvent) return;
    setReferralCodeError(null);
    setIsSavingReferralCode(true);
    try {
      await deleteReferralCode(selectedEvent.id, code);
      setDeletingReferralCode(null);
    } catch {
      setReferralCodeError('Could not delete the code — try again.');
    } finally {
      setIsSavingReferralCode(false);
    }
  };

  // Shared by "+ Add code" and a row's Edit.
  const isRenamingReferralCode =
    !!editingReferralCode && !!newReferralCode.trim() && newReferralCode.trim() !== editingReferralCode;
  const referralCodeForm = (
    <div className="space-y-3 rounded-sm border border-gray-200 dark:border-slate-700 p-3">
      <div className="flex gap-2">
        <div className="w-32 shrink-0">
          <label htmlFor="referral-code-input" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Code
          </label>
          <input
            id="referral-code-input"
            type="text"
            placeholder="e.g. SARAH10"
            value={newReferralCode}
            onChange={(e) => setNewReferralCode(e.target.value.toUpperCase())}
            className="w-full rounded-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 font-mono text-sm uppercase text-slate-700 dark:text-slate-200"
          />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="referral-label-input" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Label
          </label>
          <input
            id="referral-label-input"
            type="text"
            placeholder="e.g. Sarah - Instagram"
            value={newReferralLabel}
            onChange={(e) => setNewReferralLabel(e.target.value)}
            className="w-full rounded-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200"
          />
        </div>
      </div>
      <div>
        <label htmlFor="referral-discount-input" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
          Discount
        </label>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Discount type" className="flex overflow-hidden rounded-sm border border-gray-300 dark:border-slate-600">
            <button
              type="button"
              aria-pressed={newReferralDiscountType === 'percent'}
              onClick={() => setNewReferralDiscountType('percent')}
              className={`px-3 py-1.5 text-xs font-medium ${newReferralDiscountType === 'percent' ? 'bg-[#007A78] text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
            >
              % off
            </button>
            <button
              type="button"
              aria-pressed={newReferralDiscountType === 'flat'}
              onClick={() => setNewReferralDiscountType('flat')}
              className={`px-3 py-1.5 text-xs font-medium ${newReferralDiscountType === 'flat' ? 'bg-[#007A78] text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
            >
              ₹ off
            </button>
          </div>
          <input
            id="referral-discount-input"
            type="number"
            min={0}
            max={newReferralDiscountType === 'percent' ? 100 : undefined}
            value={newReferralDiscountValue}
            onChange={(e) => setNewReferralDiscountValue(Number(e.target.value))}
            className="w-24 rounded-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200"
          />
        </div>
      </div>
      {editingReferralCode && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {isRenamingReferralCode
            ? `${editingReferralCode} will stop working at checkout; buyers must use ${newReferralCode.trim()}. Its past sales stay counted here. `
            : ''}
          Changes apply to new bookings only. Tickets already sold keep their discount.
        </p>
      )}
      {referralCodeError && <p className="text-xs text-red-500">{referralCodeError}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={isSavingReferralCode}
          onClick={handleSaveReferralCode}
          className="rounded-sm bg-[#007A78] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#006361] disabled:opacity-50"
        >
          {isSavingReferralCode ? 'Saving…' : editingReferralCode ? 'Save changes' : 'Save code'}
        </button>
        <button
          type="button"
          onClick={closeReferralForm}
          className="rounded-sm px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );

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
    closeReferralForm();
    setDeletingReferralCode(null);
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

  // purchaseKey -> its non-cancelled tickets, same-name tickets kept together.
  const purchases = useMemo(() => {
    const map = new Map<string, Attendee[]>();
    attendees.forEach((a) => {
      const key = purchaseKey(a);
      if (!key || a.status === 'cancelled') return;
      map.set(key, [...(map.get(key) ?? []), a]);
    });
    map.forEach((members) =>
      members.sort(
        (x, y) =>
          (x.bookingGroupId ?? x.id).localeCompare(y.bookingGroupId ?? y.id) || x.ticketId.localeCompare(y.ticketId)
      )
    );
    return map;
  }, [attendees]);

  // Other tickets bought together with this one, or null if it was bought alone.
  const getPurchaseMembers = useCallback(
    (attendee: Attendee): Attendee[] | null => {
      const key = purchaseKey(attendee);
      const members = key ? purchases.get(key) : undefined;
      return members && members.length > 1 ? members : null;
    },
    [purchases]
  );

  // Opens the "who is here?" checklist. The scanned/tapped ticket (plus its
  // same-name group, which that one QR admits) starts ticked; the rest of the
  // booking is listed so staff can tick them too.
  const openGroupCheckIn = useCallback(
    (attendee: Attendee): boolean => {
      const members = getPurchaseMembers(attendee);
      if (!members) return false;
      const sameName = getGroupMembers(attendee) ?? [attendee];
      setPendingGroup({ members, focusIds: sameName.map((m) => m.id) });
      return true;
    },
    [getPurchaseMembers, getGroupMembers]
  );

  // Sets exactly the ticked tickets to checked-in. Tickets already checked
  // in keep their original check-in time.
  const handleGroupCheckIn = useCallback(
    (checkedInIds: Set<string>) => {
      const companyId = profile?.companyId;
      if (!pendingGroup || !companyId || !selectedEventId) return;
      const changes = pendingGroup.members
        .map((a) => ({ attendee: a, shouldBeIn: checkedInIds.has(a.id) }))
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

      const arrivedNow = changes.filter((c) => c.shouldBeIn).map((c) => c.attendee.name);
      const undone = changes.length - arrivedNow.length;
      setScanFeedback({
        type: 'success',
        message:
          arrivedNow.length > 0
            ? `Checked in ${arrivedNow.length === 1 ? arrivedNow[0] : `${arrivedNow.length} people`}. ${checkedInIds.size} of ${pendingGroup.members.length} in this booking arrived.`
            : `Checked out ${undone === 1 ? '1 person' : `${undone} people`}.`,
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

      if (openGroupCheckIn(match)) return;
      setPendingAttendee(match);
    },
    [attendees, selectedEvent, isEventDateInFuture, openGroupCheckIn]
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
      if (!target) return;
      if (openGroupCheckIn(target)) return;
      setPendingAttendee(target);
    },
    [attendees, selectedEvent, isEventDateInFuture, openGroupCheckIn]
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

              {/* Referral codes — organizer-typed discount codes to attribute sales to promoters.
                  Hidden entirely when the event's toggle is off, not just disabled-looking. */}
              {selectedEvent.registrationMode !== 'rsvp' && selectedEvent.referralCodesEnabled && (
                <Card className="shadow-sm border-gray-200 dark:border-slate-800 dark:bg-[#1E293B]">
                  <CardContent className="py-4">
                    <button
                      type="button"
                      onClick={() => setIsReferralSectionOpen((open) => !open)}
                      aria-expanded={isReferralSectionOpen}
                      aria-controls="referral-codes-panel"
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Referral codes</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {(() => {
                            const codes = selectedEvent.referralCodes ?? [];
                            const sold = codes.reduce((s, c) => s + (referralCodeStats.get(c.code)?.ticketsSold ?? 0), 0);
                            return codes.length === 0
                              ? 'No codes yet'
                              : `${codes.length} ${codes.length === 1 ? 'code' : 'codes'} · ${sold} sold`;
                          })()}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          Enabled
                        </span>
                        <ChevronDown
                          size={18}
                          aria-hidden="true"
                          className={`text-slate-400 transition-transform ${isReferralSectionOpen ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </button>

                    {isReferralSectionOpen && (
                      <div id="referral-codes-panel" className="mt-3">
                        {selectedEvent.referralCodes && selectedEvent.referralCodes.length > 0 && (
                          <div className="mb-3 flex flex-col divide-y divide-gray-100 dark:divide-slate-800">
                            {selectedEvent.referralCodes.map((entry) => {
                              const codeStats = referralCodeStats.get(entry.code) ?? { ticketsSold: 0, totalDiscount: 0 };
                              if (editingReferralCode === entry.code) {
                                return <div key={entry.code} className="py-2.5">{referralCodeForm}</div>;
                              }
                              if (deletingReferralCode === entry.code) {
                                return (
                                  <div key={entry.code} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                                    <div className="min-w-0">
                                      <p className="text-sm text-slate-700 dark:text-slate-200">
                                        Delete <span className="font-mono font-semibold">{entry.code}</span>?
                                      </p>
                                      <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {codeStats.ticketsSold > 0
                                          ? `The ${codeStats.ticketsSold} tickets sold keep their discount, but the code stops working and its stats are hidden.`
                                          : 'The code will stop working at checkout.'}
                                      </p>
                                      {referralCodeError && <p className="text-xs text-red-500">{referralCodeError}</p>}
                                    </div>
                                    <div className="flex shrink-0 gap-2">
                                      <button
                                        type="button"
                                        disabled={isSavingReferralCode}
                                        onClick={() => handleDeleteReferralCode(entry.code)}
                                        className="rounded-sm bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                      >
                                        {isSavingReferralCode ? 'Deleting…' : 'Delete'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => { setDeletingReferralCode(null); setReferralCodeError(null); }}
                                        className="rounded-sm px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div key={entry.code} className="flex items-center justify-between gap-3 py-2.5">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                      <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">{entry.code}</span>
                                      <button
                                        type="button"
                                        onClick={() => navigator.clipboard?.writeText(entry.code)}
                                        className="text-[10px] text-[#007A78] hover:underline"
                                      >
                                        Copy
                                      </button>
                                      {can(Permission.EDIT_EVENT) && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => startEditReferralCode(entry)}
                                            className="text-[10px] text-[#007A78] hover:underline"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => { closeReferralForm(); setDeletingReferralCode(entry.code); }}
                                            className="text-[10px] text-red-600 hover:underline dark:text-red-400"
                                          >
                                            Delete
                                          </button>
                                        </>
                                      )}
                                    </div>
                                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                      {entry.label} · {entry.discountType === 'percent' ? `${entry.discountValue}% off` : `₹${entry.discountValue} off`}
                                    </p>
                                  </div>
                                  <p className="shrink-0 text-right text-xs font-medium text-slate-700 dark:text-slate-200">{codeStats.ticketsSold} sold</p>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {can(Permission.EDIT_EVENT) && (
                          isAddingReferralCode ? (
                            referralCodeForm
                          ) : (
                            <button
                              type="button"
                              onClick={startAddReferralCode}
                              className="rounded-sm border border-dashed border-gray-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-[#007A78] hover:bg-gray-50 dark:hover:bg-slate-800"
                            >
                              + Add code
                            </button>
                          )
                        )}
                      </div>
                    )}
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
                  {attendees.length === 0 ? 'No tickets sold for this event yet' : 'No attendees match your search'}
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
                      bookedWith={(() => {
                        if (attendee.status === 'cancelled') return undefined;
                        const members = getPurchaseMembers(attendee);
                        if (!members) return undefined;
                        // This row already stands for its own same-name group.
                        const ownIds = new Set((getGroupMembers(attendee) ?? [attendee]).map((m) => m.id));
                        const others = members.filter((m) => !ownIds.has(m.id));
                        if (others.length === 0) return undefined;
                        return {
                          others: others.map(({ id, name, status }) => ({ id, name, status })),
                          size: members.length,
                          arrived: members.filter((m) => m.status === 'checked_in').length,
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
        focusIds={pendingGroup?.focusIds ?? []}
        tierOrder={selectedEvent?.tiers.map((t) => t.name) ?? []}
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