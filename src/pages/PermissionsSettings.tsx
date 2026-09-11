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
      <header className="relative sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-4 py-3 shadow-xs">
        <BackButton title="Back" />
        <div className="absolute left-1/2 -translate-x-1/2 text-center flex flex-col items-center justify-center max-w-[70%]">
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">Manage Permissions</h1>
        </div>
        <div className="w-[38px]"></div>
      </header>

      <main className="grow overflow-y-auto p-4 pb-36 sm:p-6 sm:pb-6">
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
                    className="rounded-sm border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 p-3"
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
                            className="h-4 w-4 appearance-none rounded-sm border border-slate-400 bg-white checked:bg-[#007A78] checked:border-[#007A78] dark:checked:bg-[#2DD4BF] dark:checked:border-[#2DD4BF] relative cursor-pointer checked:after:content-['✓'] checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-white checked:after:text-[10px] checked:after:font-bold"
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

          <div className="fixed bottom-16 left-0 right-0 z-30 mt-5 flex items-center justify-center gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm dark:border-slate-800 dark:bg-[#1E293B]/95 sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none sm:dark:bg-transparent">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-[90%] max-w-sm rounded-sm bg-[#007A78] px-8 py-2.5 text-sm font-bold text-white disabled:opacity-60 dark:bg-[#2DD4BF] dark:text-slate-950 sm:w-auto sm:max-w-none"
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