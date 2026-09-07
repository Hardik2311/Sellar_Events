import React, { useEffect, useState, useMemo } from 'react';

import { db } from '../../lib/firebase';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  where,
  Timestamp,
  doc,
  updateDoc
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  Hash,
  Mail,
  Phone,
  Calendar,
  ChevronDown,
  Edit3,
  MessageSquare,
  Search
} from 'lucide-react';
import BackButton from '../../components/ui/BackButton';
import { Card, CardContent } from '../../components/ui/card';

interface SupportTicket {
  id: string;
  referenceNumber: string;
  fullName: string;
  email: string;
  phone: string;
  subject: string;
  description: string;
  status: 'received' | 'solved' | 'problem';
  createdAt: any;
}

// TODO: Diksha — paste your Super Admin UIDs here
const SUPER_ADMIN_UIDS: string[] = [];

const SuperAdminSupportTickets: React.FC = () => {

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'received' | 'solved' | 'problem'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest'>('recent');

  const [datePreset, setDatePreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<{ start: Date; end: Date } | null>(null);

  // --- AUTH CHECK ---
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUid(user?.uid ?? null);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const start = new Date();
    const end = new Date();

    if (preset === 'today') {
      // already today
    } else if (preset === 'yesterday') {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    } else if (preset === 'last7') {
      start.setDate(start.getDate() - 7);
    } else if (preset === 'last30') {
      start.setDate(start.getDate() - 30);
    } else {
      setStartDate('');
      setEndDate('');
      return;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const handleApplyFilters = () => {
    if (!startDate && !endDate) {
      setAppliedFilters(null);
      return;
    }
    const s = startDate ? new Date(startDate) : new Date(0);
    const e = endDate ? new Date(endDate) : new Date();
    s.setHours(0, 0, 0, 0);
    e.setHours(23, 59, 59, 999);
    setAppliedFilters({ start: s, end: e });
  };

   
  const isSuperAdmin = SUPER_ADMIN_UIDS.length === 0 || (!!currentUid && SUPER_ADMIN_UIDS.includes(currentUid));

  // --- LIVE FIRESTORE LISTENER ---
  useEffect(() => {
    if (!authChecked) return;
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);

    let q = query(collection(db, 'event_support_tickets'), orderBy('createdAt', 'desc'));
    if (appliedFilters) {
      q = query(
        collection(db, 'event_support_tickets'),
        where('createdAt', '>=', Timestamp.fromDate(appliedFilters.start)),
        where('createdAt', '<=', Timestamp.fromDate(appliedFilters.end)),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as SupportTicket[];
      setTickets(liveData);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [appliedFilters, authChecked, currentUid]);

  const stats = useMemo(() => ({
    all: tickets.length,
    received: tickets.filter(t => t.status === 'received').length,
    solved: tickets.filter(t => t.status === 'solved').length,
    problem: tickets.filter(t => t.status === 'problem').length,
  }), [tickets]);

  const filteredTickets = useMemo(() => {
    let result = activeFilter === 'all' ? tickets : tickets.filter(t => t.status === activeFilter);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        (t.referenceNumber && t.referenceNumber.toLowerCase().includes(q)) ||
        (t.phone && t.phone.toLowerCase().includes(q)) ||
        (t.fullName && t.fullName.toLowerCase().includes(q))
      );
    }

    return [...result].sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
      return sortBy === 'oldest' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
    });
  }, [tickets, activeFilter, searchQuery, sortBy]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'event_support_tickets', id), { status: newStatus });
    } catch {
      alert('Failed to update status.');
    }
  };

  const toggleFilter = (f: typeof activeFilter) =>
    setActiveFilter(prev => (prev === f ? 'all' : f));

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'solved': return 'bg-[#007A78]/10 text-[#007A78] dark:bg-[#2DD4BF]/15 dark:text-[#2DD4BF]';
      case 'problem': return 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400';
      default: return 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400';
    }
  };

    if (!authChecked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-[#0F172A]">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-[#0F172A]">
        <div className="text-center">
          <div className="text-5xl mb-3">⛔</div>
          <p className="text-red-500 font-bold text-xl">ACCESS DENIED</p>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Super Admin privileges required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-16">
      {/* Header */}
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-6 py-4 relative">
        <div className="absolute left-6 top-1/2 -translate-y-1/2">
          <BackButton />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Support Tickets</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Raised from the Help &amp; Support page</p>
        </div>
      </header>

      <main className="grow overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto max-w-6xl flex flex-col gap-4">

          {/* Date filter */}
          <Card className="shadow-sm border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
            <CardContent className="pt-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={datePreset}
                  onChange={(e) => handleDatePresetChange(e.target.value)}
                  className="w-full p-2 text-sm bg-[#F9FAFB] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm outline-none focus:ring-1 focus:ring-[#007A78] dark:focus:ring-[#2DD4BF]"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="last7">Last 7 Days</option>
                  <option value="last30">Last 30 Days</option>
                  <option value="custom">Custom</option>
                </select>
                <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                  <input
                    type="date" value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setDatePreset('custom'); }}
                    className="w-full p-2 text-sm bg-[#F9FAFB] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm outline-none"
                  />
                  <input
                    type="date" value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setDatePreset('custom'); }}
                    className="w-full p-2 text-sm bg-[#F9FAFB] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm outline-none"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-center">
                <button
                  onClick={handleApplyFilters}
                  className="w-full sm:w-auto px-10 py-2 bg-[#007A78] dark:bg-[#2DD4BF] text-white dark:text-slate-950 text-sm font-semibold rounded-sm hover:bg-[#006361] dark:hover:bg-[#22b8a5]"
                >
                  Apply
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Search + sort */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ticket no., phone, or name..."
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-sm shadow-sm focus:ring-1 focus:ring-[#007A78] dark:focus:ring-[#2DD4BF] outline-none"
              />
            </div>
            <div className="relative sm:w-48">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'recent' | 'oldest')}
                className="appearance-none w-full px-4 py-2.5 text-sm bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-sm shadow-sm focus:ring-1 focus:ring-[#007A78] dark:focus:ring-[#2DD4BF] outline-none cursor-pointer font-medium"
              >
                <option value="recent">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Filter cards */}
          <div className="grid grid-cols-3 gap-3">
            {([
              ['received', 'Pending', stats.received],
              ['solved', 'Solved', stats.solved],
              ['problem', 'Problems', stats.problem],
            ] as const).map(([key, label, value]) => (
              <button
                key={key}
                onClick={() => toggleFilter(key)}
                className={`rounded-md border-2 bg-white dark:bg-[#1E293B] px-3 py-3 text-left transition-all ${
                  activeFilter === key
                    ? 'border-[#007A78] dark:border-[#2DD4BF] shadow-md scale-[1.02]'
                    : 'border-transparent'
                }`}
              >
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
                <p className="text-lg font-extrabold text-slate-900 dark:text-white">{value}</p>
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase ml-1">
            Showing {filteredTickets.length} of {stats.all} tickets
          </p>

          {/* Ticket list */}
          <div className="flex flex-col gap-3">
            {filteredTickets.length === 0 ? (
              <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
                <CardContent className="text-center p-10 text-slate-400 dark:text-slate-500">
                  No tickets found.
                </CardContent>
              </Card>
            ) : (
              filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="bg-white dark:bg-[#1E293B] rounded-md shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden"
                >
                  <div
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    onClick={() => setExpandedId(expandedId === ticket.id ? null : ticket.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-bold text-[#007A78] dark:text-[#2DD4BF] bg-[#007A78]/10 dark:bg-[#2DD4BF]/15 px-2 py-0.5 rounded uppercase flex items-center gap-1">
                          <Hash className="w-3 h-3" /> {ticket.referenceNumber}
                        </span>
                        <h3 className="text-base font-bold text-slate-800 dark:text-white">{ticket.fullName}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-sm font-bold uppercase ${getStatusStyle(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 mt-1">
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          <a href={`mailto:${ticket.email}`} className="hover:text-[#007A78] dark:hover:text-[#2DD4BF]">{ticket.email}</a>
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          <a href={`tel:${ticket.phone}`} className="hover:text-[#007A78] dark:hover:text-[#2DD4BF]">{ticket.phone || 'N/A'}</a>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 whitespace-nowrap">
                        <Calendar className="w-3 h-3" />
                        {ticket.createdAt?.toDate ? ticket.createdAt.toDate().toLocaleString('en-IN') : 'Loading...'}
                      </p>
                      <div className="relative">
                        <select
                          value={ticket.status}
                          onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="appearance-none bg-[#F9FAFB] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold py-2 px-4 pr-9 rounded-sm cursor-pointer outline-none focus:ring-1 focus:ring-[#007A78] dark:focus:ring-[#2DD4BF]"
                        >
                          <option value="received">PENDING</option>
                          <option value="solved">SOLVED</option>
                          <option value="problem">PROBLEM</option>
                        </select>
                        <Edit3 className="w-3 h-3 absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                      </div>
                      <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${expandedId === ticket.id ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {expandedId === ticket.id && (
                    <div className="border-t border-slate-100 dark:border-slate-800 bg-[#F9FAFB] dark:bg-slate-800/40 p-4">
                      <div className="flex flex-col gap-4">
                        <div className="pl-3 border-l-4 border-[#007A78] dark:border-[#2DD4BF]">
                          <h4 className="text-[10px] font-bold text-[#007A78]/70 dark:text-[#2DD4BF]/70 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                            <MessageSquare className="w-3 h-3" /> Subject
                          </h4>
                          <p className="text-base font-bold text-slate-900 dark:text-white">{ticket.subject}</p>
                        </div>
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Description</h4>
                          <div className="bg-white dark:bg-[#1E293B] p-4 rounded-sm border border-slate-200 dark:border-slate-700">
                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SuperAdminSupportTickets;