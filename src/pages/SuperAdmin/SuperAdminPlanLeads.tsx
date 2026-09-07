import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, updateDoc, increment, collectionGroup } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Search, Zap, ArrowLeft, Plus } from 'lucide-react';

interface CompanyData {
  id: string;
  name?: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  eventCredits?: number;
}

const SUPER_ADMIN_UIDS: string[] = [];

const SuperAdminPlanLeads: React.FC = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [creditInputs, setCreditInputs] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUid(user?.uid ?? null);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  
  const isSuperAdmin = SUPER_ADMIN_UIDS.length === 0 || (!!currentUid && SUPER_ADMIN_UIDS.includes(currentUid));

  useEffect(() => {
    if (!authChecked || !isSuperAdmin) {
      setLoading(false);
      return;
    }

    const fetchCompanies = async () => {
      try {
        const companyMap = new Map<string, CompanyData>();

        const companiesSnap = await getDocs(collection(db, 'companies'));
        companiesSnap.forEach((d) => {
          const data = d.data();
          companyMap.set(d.id, {
            id: d.id,
            name: data.name || 'Unknown Company',
            ownerName: 'Unknown',
            email: 'N/A',
            phone: data.ownerPhoneNumber || 'N/A',
            eventCredits: data.eventCredits ?? 0,
          });
        });

        const usersQuery = await getDocs(collectionGroup(db, 'users'));
        usersQuery.forEach((userDoc) => {
          const userData = userDoc.data();
          const parentCompany = userDoc.ref.parent.parent;
          const compId = userData.companyId || (parentCompany ? parentCompany.id : null);

          if (compId && companyMap.has(compId) && (userData.role === 'Owner' || userData.role === 'owner' || userData.role === 'admin')) {
            const existing = companyMap.get(compId)!;
            if (userData.name) existing.ownerName = userData.name;
            if (userData.email) existing.email = userData.email;
            if (userData.phoneNumber) existing.phone = userData.phoneNumber;
            companyMap.set(compId, existing);
          }
        });

        setCompanies(Array.from(companyMap.values()));
      } catch (err) {
        console.error(err);
        alert('Error fetching companies.');
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, [authChecked, isSuperAdmin]);

  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companies;
    const q = searchQuery.toLowerCase();
    return companies.filter((c) =>
      [c.name, c.ownerName, c.email, c.phone, c.id].some((field) => field && field.toLowerCase().includes(q))
    );
  }, [companies, searchQuery]);

  const handleAddCredits = async (companyId: string) => {
    const amount = parseInt(creditInputs[companyId] || '0', 10);
    if (!amount || amount <= 0) {
      alert('Enter a valid number of credits to add.');
      return;
    }
    setSavingId(companyId);
    try {
      await updateDoc(doc(db, 'companies', companyId), {
        eventCredits: increment(amount),
      });
      setCompanies((prev) =>
        prev.map((c) => (c.id === companyId ? { ...c, eventCredits: (c.eventCredits || 0) + amount } : c))
      );
      setCreditInputs((prev) => ({ ...prev, [companyId]: '' }));
    } catch (err) {
      console.error(err);
      alert('Failed to add credits. Check Firestore rules / your Super Admin access.');
    } finally {
      setSavingId(null);
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
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-6 py-4 relative">
        <div className="absolute left-6 top-1/2 -translate-y-1/2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Manage Credits</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Allot event credits to any company directly</p>
        </div>
      </header>

      <main className="grow overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto max-w-4xl flex flex-col gap-4">

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by company name, owner, email, or phone..."
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-sm shadow-sm focus:ring-1 focus:ring-[#007A78] dark:focus:ring-[#2DD4BF] outline-none"
            />
          </div>

          {filteredCompanies.length === 0 ? (
            <div className="text-center p-10 text-slate-400 dark:text-slate-500 bg-white dark:bg-[#1E293B] rounded-md border border-slate-200 dark:border-slate-800">
              No companies found.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredCompanies.map((company) => (
                <div
                  key={company.id}
                  className="bg-white dark:bg-[#1E293B] rounded-md shadow-sm border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-base font-bold text-slate-800 dark:text-white">{company.name}</h3>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-[#007A78] dark:text-[#2DD4BF] bg-[#007A78]/10 dark:bg-[#2DD4BF]/15 px-2 py-0.5 rounded uppercase">
                        <Zap size={10} /> {company.eventCredits ?? 0} credits
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{company.ownerName} · {company.email}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{company.phone}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 truncate">{company.id}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min={1}
                      value={creditInputs[company.id] || ''}
                      onChange={(e) => setCreditInputs((prev) => ({ ...prev, [company.id]: e.target.value }))}
                      placeholder="Qty"
                      className="w-20 rounded-sm border border-slate-200 dark:border-slate-700 bg-[#F9FAFB] dark:bg-slate-800 px-2 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-[#007A78] dark:focus:ring-[#2DD4BF]"
                    />
                    <button
                      onClick={() => handleAddCredits(company.id)}
                      disabled={savingId === company.id}
                      className="flex items-center gap-1 rounded-sm bg-[#007A78] dark:bg-[#2DD4BF] px-3 py-2 text-xs font-bold text-white dark:text-slate-950 hover:bg-[#006361] dark:hover:bg-[#22b8a5] disabled:opacity-60"
                    >
                      <Plus size={13} />
                      {savingId === company.id ? 'Adding...' : 'Add Credits'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SuperAdminPlanLeads;