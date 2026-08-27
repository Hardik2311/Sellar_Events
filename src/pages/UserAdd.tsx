import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { addTeamMember } from '../lib/AuthOperations';
import { ROLES, CREATABLE_ROLES } from '../enum/enum';

const ROLE_LABELS: Record<string, string> = {
  [ROLES.TEAM_LEADER]: 'Team Leader',
  [ROLES.TEAM]: 'Team Member',
};

interface UserAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void; // ManageUsersPage list refresh karne ke liye
}

export const UserAddModal: React.FC<UserAddModalProps> = ({ isOpen, onClose, onCreated }) => {
  const { profile } = useAuth();
  const allowedRoles = profile?.role ? CREATABLE_ROLES[profile.role] || [] : [];

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string>(allowedRoles[0] || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setName(''); setPhone(''); setEmail(''); setPassword('');
    setRole(allowedRoles[0] || '');
    setError(null); setSuccess(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!profile?.companyId) {
      setError('Company information not found. Please log in again.');
      return;
    }
    if (!name.trim() || !phone.trim() || !email.trim() || !password.trim() || !role) {
      setError('Please fill out all fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addTeamMember({
        companyId: profile.companyId,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password,
        role,
      });
      setSuccess(`${ROLE_LABELS[role] || role} "${name.trim()}" created successfully!`);
      setName(''); setPhone(''); setEmail(''); setPassword('');
      onCreated?.();
      setTimeout(() => {
        resetForm();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-[#1E293B] rounded-sm shadow-xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Add Team Member</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              They'll log in with this exact email and password.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-sm text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        {allowedRoles.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-center py-6">
            You don't have permission to add team members.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <input
                className="border rounded-sm px-3 py-2 dark:bg-[#0F172A] dark:border-slate-700 dark:text-white"
                placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting} required
              />
              <input
                className="border rounded-sm px-3 py-2 dark:bg-[#0F172A] dark:border-slate-700 dark:text-white"
                placeholder="Phone Number" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value)}
                disabled={isSubmitting} required
              />
            </div>
            <input
              className="w-full border rounded-sm px-3 py-2 dark:bg-[#0F172A] dark:border-slate-700 dark:text-white"
              type="email" placeholder="Gmail / Email Address" value={email} onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting} required
            />
            <input
              className="w-full border rounded-sm px-3 py-2 dark:bg-[#0F172A] dark:border-slate-700 dark:text-white"
              type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting} required
            />
            <select
              className="w-full border rounded-sm px-3 py-2 dark:bg-[#0F172A] dark:border-slate-700 dark:text-white"
              value={role} onChange={(e) => setRole(e.target.value)} disabled={isSubmitting}
            >
              {allowedRoles.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
              ))}
            </select>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-emerald-600">{success}</p>}

            <button
              type="submit" disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-3 rounded-sm bg-[#007A78] dark:bg-[#2DD4BF] text-white dark:text-slate-950 font-bold disabled:opacity-60"
            >
              {isSubmitting ? 'Adding…' : 'Add User'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default UserAddModal;