import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { deleteTeamMember } from '../../lib/AuthOperations';
import { useAuth } from '../../context/AuthContext';
import { ROLES, canManageUsers } from '../../enum/enum'
import BackButton from '../../components/ui/BackButton';
import { UserAddModal } from '../UserAdd'; // NEW

interface CompanyUser {
  uid: string;
  name?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role?: string;
}

const ROLE_LABELS: Record<string, string> = {
  [ROLES.ORGANIZER]: 'Organizer',
  [ROLES.TEAM_LEADER]: 'Team Leader',
  [ROLES.TEAM]: 'Team Member',
};

const ManageUsersPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name?: string; email?: string; phone?: string; role?: string }>({});

  const allowed = canManageUsers(profile?.role);

  const loadUsers = async (companyId: string) => {
    try {
      const snap = await getDocs(collection(db, 'companies', companyId, 'users'));
      setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as CompanyUser)));
    } catch (e) {
      console.error(e);
      setError('Failed to load users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!profile?.companyId) {
      setError('Company information missing.');
      setIsLoading(false);
      return;
    }
    if (!allowed) {
      setError('You do not have permission to manage users.');
      setIsLoading(false);
      return;
    }

    loadUsers(profile.companyId);
  }, [profile, authLoading, allowed]);

  const handleEdit = (u: CompanyUser) => {
    setEditingUid(u.uid);
    setEditForm({ name: u.name || u.fullName || '', email: u.email, phone: u.phone, role: u.role });
  };

  const handleSave = async () => {
    if (!editingUid || !profile?.companyId) return;
    await updateDoc(doc(db, 'companies', profile.companyId, 'users', editingUid), {
      name: editForm.name?.trim() || '',
      phone: editForm.phone?.trim() || '',
      role: editForm.role || '',
    });
    setUsers((prev) => prev.map((u) => (u.uid === editingUid ? { ...u, ...editForm } : u)));
    setEditingUid(null);
  };

  const [deletingUid, setDeletingUid] = useState<string | null>(null); // NEW state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false); // NEW state — Add User popup

  const handleDelete = async (u: CompanyUser) => {
    if (u.role === ROLES.ORGANIZER) return; // safety guard
    if (!profile?.companyId) return;
    if (!window.confirm(`Remove ${u.name}? This permanently deletes their login access.`)) return;

    setDeletingUid(u.uid);
    try {
      await deleteTeamMember({ companyId: profile.companyId, targetUid: u.uid });
      setUsers((prev) => prev.filter((x) => x.uid !== u.uid));
    } catch (err: any) {
      alert(err.message || 'Failed to delete user.');
    } finally {
      setDeletingUid(null);
    }
  };

  if (isLoading) return <div className="p-6 text-center text-slate-500">Loading users…</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 dark:bg-[#0F172A]">
      <header className="flex items-center justify-between p-3 bg-white dark:bg-[#1E293B] border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <BackButton title="Back" />
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Manage Users</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-3 py-1.5 rounded-sm bg-[#007A78] dark:bg-[#2DD4BF] text-white dark:text-slate-950 text-sm font-bold"
        >
          Add User
        </button>
      </header>

      <main className="flex-1 p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {users.length === 0 && (
          <p className="col-span-full text-center text-slate-500 py-10">No users yet.</p>
        )}
        {users.map((u) => (
          <div key={u.uid} className="bg-white dark:bg-[#1E293B] rounded-sm shadow-sm border border-slate-200 dark:border-slate-800 p-2.5 self-start">
            {editingUid === u.uid ? (
              <div className="space-y-1.5">
                <div>
                  <label className="text-[10px] text-slate-400">Name</label>
                  <input className="w-full border rounded px-2 py-1 text-sm dark:bg-[#0F172A] dark:border-slate-700"
                    value={editForm.name || ''} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Email</label>
                  <input disabled className="w-full border rounded px-2 py-1 text-sm bg-slate-100 text-slate-500 dark:bg-slate-800 dark:border-slate-700 cursor-not-allowed"
                    value={editForm.email || ''} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Phone</label>
                  <input className="w-full border rounded px-2 py-1 text-sm dark:bg-[#0F172A] dark:border-slate-700"
                    value={editForm.phone || ''} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} />
                </div>
                {u.role !== ROLES.ORGANIZER ? (
                  <select className="w-full border rounded px-2 py-1 text-sm dark:bg-[#0F172A] dark:border-slate-700"
                    value={editForm.role || ''} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}>
                    <option value={ROLES.TEAM_LEADER}>Team Leader</option>
                    <option value={ROLES.TEAM}>Team Member</option>
                  </select>
                ) : (
                  <p className="text-xs text-slate-400">Owner role can't be changed</p>
                )}
                <div className="flex gap-1.5">
                  <button onClick={() => setEditingUid(null)} className="flex-1 text-xs py-1 border rounded">Cancel</button>
                  <button onClick={handleSave} className="flex-1 text-xs py-1 border rounded text-[#007A78]">Save</button>
                </div>
              </div>
            ) : (
              <>
                <p className="font-semibold text-sm truncate">{u.name || u.fullName || 'No name'}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {ROLE_LABELS[u.role || ''] || u.role}
                </span>
                <p className="text-[10px] text-slate-500 mt-1 truncate">{u.email}</p>
                <p className="text-[10px] text-slate-400">{u.phone}</p>
                <div className="flex gap-1.5 mt-2">
                  <button onClick={() => handleEdit(u)} className="flex-1 text-xs py-1 border rounded">Edit</button>
                  {u.role !== ROLES.ORGANIZER && (
                    <button
                      onClick={() => handleDelete(u)}
                      disabled={deletingUid === u.uid}
                      className="flex-1 text-xs py-1 border rounded text-red-500 disabled:opacity-50"
                    >
                      {deletingUid === u.uid ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </main>

      <UserAddModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onCreated={() => {
          if (profile?.companyId) loadUsers(profile.companyId);
        }}
      />
    </div>
  );
};

export default ManageUsersPage;