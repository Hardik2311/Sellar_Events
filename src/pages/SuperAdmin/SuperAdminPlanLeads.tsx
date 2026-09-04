import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { Search, ArrowLeft } from "lucide-react";
import BackButton from "../../components/ui/BackButton";

type PlanLead = {
  id: string;
  companyName?: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  planEvents?: number;   // 1 / 10 / 20
  planPrice?: number;
  salesStatus?: string;  // "Pending" | "Interested" | "Not interested" | "Issue"
  createdAt?: any;
};

// TODO: Diksha — paste your Super Admin UIDs here
const SUPER_ADMIN_UIDS: string[] = [];

type FilterType = "all" | "Pending" | "Interested" | "Not interested" | "Issue";

const toDateStr = (date: Date) => date.toISOString().split("T")[0];

function SuperAdminPlanLeads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<PlanLead[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [datePreset, setDatePreset] = useState("today");

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const [customStartDate, setCustomStartDate] = useState(() => toDateStr(new Date()));
  const [customEndDate, setCustomEndDate] = useState(() => toDateStr(new Date()));

  const [appliedFilters, setAppliedFilters] = useState<{ start: number; end: number }>(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start: start.getTime(), end: end.getTime() };
  });

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
    if (preset === "custom") return;

    const start = new Date();
    const end = new Date();

    switch (preset) {
      case "yesterday":
        start.setDate(start.getDate() - 1);
        end.setDate(end.getDate() - 1);
        break;
      case "last7":
        start.setDate(start.getDate() - 6);
        break;
      case "last30":
        start.setDate(start.getDate() - 29);
        break;
    }

    setCustomStartDate(toDateStr(start));
    setCustomEndDate(toDateStr(end));
  };

  const handleApplyFilters = () => {
    const start = customStartDate ? new Date(customStartDate) : new Date(0);
    start.setHours(0, 0, 0, 0);
    const end = customEndDate ? new Date(customEndDate) : new Date();
    end.setHours(23, 59, 59, 999);
    setAppliedFilters({ start: start.getTime(), end: end.getTime() });
    setActiveFilter("all");
  };

  const isSuperAdmin = SUPER_ADMIN_UIDS.length === 0 || (!!currentUid && SUPER_ADMIN_UIDS.includes(currentUid));

  useEffect(() => {
    if (!authChecked) return;
    if (!isSuperAdmin) return;

    const fetchLeads = async () => {
      const snap = await getDocs(collection(db, "event_plan_leads"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as PlanLead[];
      setLeads(list);
    };

    fetchLeads();
  }, [authChecked, currentUid]);

  const handleStatusChange = async (id: string, newSalesStatus: string) => {
    try {
      await updateDoc(doc(db, "event_plan_leads", id), { salesStatus: newSalesStatus });
      setLeads(prev => prev.map(l => l.id === id ? { ...l, salesStatus: newSalesStatus } : l));
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status.");
    }
  };

  const handleDeleteLead = async (id: string) => {
    const confirmDelete = window.confirm("Are you sure you want to permanently delete this lead?");
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "event_plan_leads", id));
      setLeads(prev => prev.filter(l => l.id !== id));
    } catch (error) {
      console.error("Error deleting lead:", error);
      alert("Failed to delete lead.");
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "--";
    const date = typeof timestamp.toDate === "function" ? timestamp.toDate() : new Date(timestamp);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const dateFilteredLeads = useMemo(() => {
    return leads.filter(lead => {
      if (!lead.createdAt) return false;
      const date = typeof lead.createdAt.toDate === "function"
        ? lead.createdAt.toDate()
        : new Date(lead.createdAt);
      return (
        date.getTime() >= appliedFilters.start &&
        date.getTime() <= appliedFilters.end
      );
    });
  }, [leads, appliedFilters]);

  const stats = useMemo(() => ({
    total: dateFilteredLeads.length,
    pending: dateFilteredLeads.filter(l => (l.salesStatus || "Pending") === "Pending").length,
    interested: dateFilteredLeads.filter(l => l.salesStatus === "Interested").length,
    notInterested: dateFilteredLeads.filter(l => l.salesStatus === "Not interested").length,
  }), [dateFilteredLeads]);

  const filteredLeads = useMemo(() => {
    let list = activeFilter === "all"
      ? dateFilteredLeads
      : dateFilteredLeads.filter(l => (l.salesStatus || "Pending") === activeFilter);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(l =>
        l.companyName?.toLowerCase().includes(q) ||
        l.ownerName?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.phone?.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });
  }, [dateFilteredLeads, activeFilter, sortOrder, searchQuery]);

  const toggleFilter = (f: FilterType) =>
    setActiveFilter(prev => (prev === f ? "all" : f));

    if (!authChecked) {
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
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-6 py-4 relative">
        <div className="absolute left-6 top-1/2 -translate-y-1/2">
          <BackButton />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Plan Leads</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">From the Recharge / Buy Credits page</p>
        </div>
      </header>

      <main className="grow overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto max-w-6xl flex flex-col gap-4">

          {/* Date filter */}
          <div className="bg-white dark:bg-[#1E293B] p-4 rounded-md shadow-sm border border-gray-200 dark:border-slate-800">
            <div className="grid grid-cols-1 gap-3">
              <select
                value={datePreset}
                onChange={(e) => handleDatePresetChange(e.target.value)}
                className="w-full p-2 text-sm bg-[#F9FAFB] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm outline-none focus:ring-1 focus:ring-[#007A78] dark:focus:ring-[#2DD4BF]"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7">Last 7 Days</option>
                <option value="last30">Last 30 Days</option>
                <option value="custom">Custom</option>
              </select>

              <div className="grid grid-cols-2 gap-4">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => { setCustomStartDate(e.target.value); setDatePreset("custom"); }}
                  className="w-full p-2 text-sm bg-[#F9FAFB] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm outline-none"
                />
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => { setCustomEndDate(e.target.value); setDatePreset("custom"); }}
                  className="w-full p-2 text-sm bg-[#F9FAFB] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm outline-none"
                />
              </div>
            </div>

            <div className="flex justify-center mt-2">
              <button
                onClick={handleApplyFilters}
                className="w-full md:w-fit mt-2 px-10 py-2 bg-[#007A78] dark:bg-[#2DD4BF] text-white dark:text-slate-950 text-sm font-semibold rounded-sm hover:bg-[#006361] dark:hover:bg-[#22b8a5]"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Filter cards */}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
            {([
              ['all', 'Total Leads', stats.total],
              ['Pending', 'Pending', stats.pending],
              ['Interested', 'Interested', stats.interested],
              ['Not interested', 'Not Interested', stats.notInterested],
            ] as const).map(([key, label, value]) => (
              <button
                key={key}
                onClick={() => toggleFilter(key as FilterType)}
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

          {/* Search, sort & table */}
          <div className="bg-white dark:bg-[#1E293B] p-4 rounded-md shadow-sm border border-gray-200 dark:border-slate-800">
            <div className="flex flex-col md:flex-row justify-between items-center gap-3 mb-4">
              <div className="relative w-full md:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, or phone..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm shadow-sm focus:ring-1 focus:ring-[#007A78] dark:focus:ring-[#2DD4BF] outline-none"
                />
              </div>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
                className="w-full md:w-auto p-2 text-sm bg-[#F9FAFB] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm outline-none cursor-pointer focus:ring-1 focus:ring-[#007A78] dark:focus:ring-[#2DD4BF]"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="bg-[#F9FAFB] dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="p-3 text-left">Company / Owner</th>
                    <th className="p-3 text-left">Phone</th>
                    <th className="p-3 text-left">Plan</th>
                    <th className="p-3 text-left">Last Updated</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400 dark:text-slate-500">No leads found.</td>
                    </tr>
                  ) : (
                    filteredLeads.map((lead) => (
                      <tr key={lead.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3">
                          <p className="font-bold text-slate-800 dark:text-white">{lead.companyName || lead.ownerName || "-"}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{lead.email || "-"}</p>
                        </td>
                        <td className="p-3 font-medium text-slate-700 dark:text-slate-200">{lead.phone || "-"}</td>
                        <td className="p-3">
                          <span className="bg-[#007A78]/10 dark:bg-[#2DD4BF]/15 text-[#007A78] dark:text-[#2DD4BF] px-2 py-1 rounded-sm text-xs font-bold">
                            {lead.planEvents ? `${lead.planEvents} Events` : "-"}{lead.planPrice ? ` · ₹${lead.planPrice.toLocaleString('en-IN')}` : ''}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">{formatDate(lead.createdAt)}</td>

                        <td className="p-3">
                          <select
                            value={lead.salesStatus || "Pending"}
                            onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                            className={`text-xs font-bold p-1.5 rounded-sm border cursor-pointer outline-none ${
                              lead.salesStatus === "Interested" ? "bg-[#007A78]/10 text-[#007A78] border-[#007A78]/30 dark:bg-[#2DD4BF]/15 dark:text-[#2DD4BF] dark:border-[#2DD4BF]/30" :
                              lead.salesStatus === "Not interested" ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900" :
                              lead.salesStatus === "Issue" ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-900" :
                              "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900"
                            }`}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Interested">Interested</option>
                            <option value="Not interested">Not interested</option>
                            <option value="Issue">Issue</option>
                          </select>
                        </td>

                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleDeleteLead(lead.id)}
                            className="text-red-500 hover:text-red-700 p-1.5 bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900 rounded-sm transition-colors text-xs font-bold"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default SuperAdminPlanLeads;