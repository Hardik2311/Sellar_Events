import React, { useEffect, useState } from 'react';
import {
  Loader2,
  LayoutDashboard,
  CalendarPlus,
  CalendarDays,
  UsersRound,
  BarChart3,
  Settings2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchPermissions, savePermissions } from '../lib/PermissionOperations';
import {
  DEFAULT_PERMISSIONS,
  PERMISSION_GROUPS,
  type PermissionsByRole,
  type RolePermissions,
} from '../types/permissions.types';
import { ROLES } from '../enum/enum';
import BackButton from '../components/ui/BackButton';

// One icon per section — matches sidebar pages, makes each block scannable at a glance.
const GROUP_ICONS: Record<string, LucideIcon> = {
  'Dashboard & General': LayoutDashboard,
  'Create Event': CalendarPlus,
  'My Events': CalendarDays,
  Attendees: UsersRound,
  Reports: BarChart3,
  Settings: Settings2,
  Expenses: Wallet,
};

const ROLE_TABS = [
  { key: 'team_leader' as const, label: 'Team Leader' },
  { key: 'team' as const, label: 'Team Member' },
];

const PermissionsSettings: React.FC = () => {
  const { profile } = useAuth();
  const [activeRole, setActiveRole] = useState<'team_leader' | 'team'>('team_leader');
  const [permissions, setPermissions] = useState<PermissionsByRole>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isOwner = profile?.role === ROLES.ORGANIZER;

  useEffect(() => {
    if (!profile?.companyId) return;
    fetchPermissions(profile.companyId).then((p) => {
      setPermissions(p);
      setLoading(false);
    });
  }, [profile?.companyId]);

  const toggle = (key: keyof RolePermissions) => {
    setPermissions((prev) => ({
      ...prev,
      [activeRole]: { ...prev[activeRole], [key]: !prev[activeRole][key] },
    }));
  };

  const resetToDefault = () => {
    setPermissions((prev) => ({ ...prev, [activeRole]: DEFAULT_PERMISSIONS[activeRole] }));
  };

  const handleSave = async () => {
    if (!profile?.companyId) return;
    setIsSaving(true);
    try {
      await savePermissions(profile.companyId, permissions);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-slate-500 dark:text-slate-400">Only the owner can manage permissions.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" size={24} />
      </div>
    );
  }

  const currentPerms = permissions[activeRole];
  const activeCount = Object.values(currentPerms).filter(Boolean).length;

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-16">
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-4 py-3 shadow-xs">
        <div className="w-[38px]" />
        <div className="flex-1 text-center">
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">Manage Permissions</h1>
        </div>
        <BackButton title="Back" />
      </header>

      <main className="grow overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-6xl xl:max-w-7xl">
          <div className="flex justify-center mb-5">
            <div className="flex rounded-sm border border-gray-300 dark:border-slate-700 p-1 bg-white dark:bg-slate-800">
              {ROLE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveRole(tab.key)}
                  className={`px-6 py-1.5 rounded-sm text-sm font-medium transition-colors ${activeRole === tab.key
                    ? 'bg-orange-50 dark:bg-[#2DD4BF]/10 text-[#007A78] dark:text-[#2DD4BF]'
                    : 'text-gray-500 dark:text-slate-400'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-[#1E293B] rounded-sm shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-800 dark:text-white">
                {ROLE_TABS.find((t) => t.key === activeRole)?.label} Permissions
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-1 rounded-sm bg-teal-50 dark:bg-teal-950 text-[#007A78] dark:text-[#2DD4BF]">
                  {activeCount} Active
                </span>
                <button
                  onClick={resetToDefault}
                  className="text-xs font-bold px-2.5 py-1 rounded-sm bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                >
                  Reset to Default
                </button>
              </div>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {PERMISSION_GROUPS.map((group) => {
                const GroupIcon = GROUP_ICONS[group.title] ?? LayoutDashboard;
                const groupActiveCount = group.items.filter((item) => currentPerms[item.key]).length;

                return (
                  <div
                    key={group.title}
                    className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 p-3"
                  >
                    <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <GroupIcon size={16} className="text-[#007A78] dark:text-[#2DD4BF]" />
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{group.title}</p>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                        {groupActiveCount}/{group.items.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
                      {group.items.map((item) => (
                        <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentPerms[item.key]}
                            onChange={() => toggle(item.key)}
                            className="h-4 w-4 accent-[#007A78] dark:accent-[#2DD4BF] cursor-pointer"
                          />
                          <span className="text-sm text-slate-600 dark:text-slate-300">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-8 py-2.5 rounded-sm bg-[#007A78] dark:bg-[#2DD4BF] text-white dark:text-slate-950 text-sm font-bold disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : `Save Changes for ${ROLE_TABS.find((t) => t.key === activeRole)?.label}`}
            </button>
            {saved && <span className="text-sm text-emerald-600">Saved!</span>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PermissionsSettings;