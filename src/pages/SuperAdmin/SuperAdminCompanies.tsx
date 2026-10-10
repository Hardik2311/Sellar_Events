import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Search, ArrowLeft, Trash2, AlertTriangle, X } from 'lucide-react';
import { deleteCompanyData } from '../../lib/AuthOperations';

interface CompanyData {
  id: string;
  name?: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  pack?: string;
  validity?: string;
  isTrial?: boolean;
}

// Keep in sync with functions/companies/DeleteCompany.js and isSuperAdmin() in firestore.rules.
const SUPER_ADMIN_UIDS: string[] = ['sR4lj7OfkAc7DhdxfHhuC7XAzLC2'];

const SuperAdminCompanies: React.FC = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<CompanyData | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUid(user?.uid ?? null);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  const isSuperAdmin = !!currentUid && SUPER_ADMIN_UIDS.includes(currentUid);

  const fetchCompanies = async () => {
    setLoading(true);
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
          pack: data.pack || 'N/A',
          validity: data.validity || 'N/A',
          isTrial: !!data.isTrial,
        });
      });

      // Per-company reads (not a collectionGroup scan) so one unreadable
      // company doesn't break the whole listing — same reasoning as
      // SuperAdminPlanLeads.tsx.
      await Promise.all(
        Array.from(companyMap.keys()).map(async (compId) => {
          try {
            const usersSnap = await getDocs(collection(db, 'companies', compId, 'users'));
            usersSnap.forEach((userDoc) => {
              const userData = userDoc.data();
              if (userData.role === 'Owner' || userData.role === 'owner' || userData.role === 'admin') {
                const existing = companyMap.get(compId)!;
                if (userData.name) existing.ownerName = userData.name;
                if (userData.email) existing.email = userData.email;
                if (userData.phoneNumber) existing.phone = userData.phoneNumber;
                companyMap.set(compId, existing);
              }
            });
          } catch (err) {
            console.error(`Failed to load users for company ${compId}:`, err);
          }
        })
      );

      setCompanies(Array.from(companyMap.values()));
    } catch (err) {
      console.error(err);
      alert('Error fetching companies.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authChecked || !isSuperAdmin) {
      setLoading(false);
      return;
    }
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, isSuperAdmin]);

  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companies;
    const q = searchQuery.toLowerCase();
    return companies.filter((c) =>
      [c.name, c.ownerName, c.email, c.phone, c.id].some((field) => field && field.toLowerCase().includes(q))
    );
  }, [companies, searchQuery]);

  const openConfirm = (company: CompanyData) => {
    setConfirmTarget(company);
  };

  const closeConfirm = () => {
    setConfirmTarget(null);
  };

  const handleDelete = async () => {
    if (!confirmTarget) return;
    setDeletingId(confirmTarget.id);
    try {
      await deleteCompanyData({ companyId: confirmTarget.id });
      setCompanies((prev) => prev.filter((c) => c.id !== confirmTarget.id));
      closeConfirm();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to delete company.');
    } finally {
      setDeletingId(null);
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
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Manage Companies</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Delete a company and its users — this cannot be undone</p>
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
                      <span className="text-[10px] font-bold text-[#007A78] dark:text-[#2DD4BF] bg-[#007A78]/10 dark:bg-[#2DD4BF]/15 px-2 py-0.5 rounded uppercase">
                        {company.pack}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${company.validity === 'active' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : 'text-red-600 dark:text-red-400 bg-red-500/10'}`}>
                        {company.validity}{company.isTrial ? ' · trial' : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{company.ownerName} · {company.email}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{company.phone}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 truncate">{company.id}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openConfirm(company)}
                      disabled={deletingId === company.id}
                      className="flex items-center gap-1 rounded-sm bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      <Trash2 size={13} />
                      {deletingId === company.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {confirmTarget && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-md bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 shadow-lg p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle size={18} />
                <h2 className="text-sm font-extrabold">Delete company?</h2>
              </div>
              <button onClick={closeConfirm} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              This permanently deletes <span className="font-bold text-slate-800 dark:text-white">{confirmTarget.name}</span> ({confirmTarget.id}),
              every user in it, and all of its data. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={closeConfirm}
                className="rounded-sm px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deletingId === confirmTarget.id}
                className="rounded-sm bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletingId === confirmTarget.id ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminCompanies;
