import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldOff,
  LayoutDashboard,
  CalendarPlus,
  Users,
  Compass,
  Settings,
  BarChart3,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { Permission } from '../types/permissions.types';
import { ROUTES } from '../constants/routes.constants';

const accessibleRoutes = [
  { name: 'Dashboard', description: 'View performance metrics and activity overview.', path: ROUTES.EVENTS, permission: Permission.VIEW_DASHBOARD, icon: LayoutDashboard },
  { name: 'Create Event', description: 'Set up a new event with tickets and details.', path: ROUTES.EVENTS_CREATE, permission: Permission.VIEW_CREATE_EVENT, icon: CalendarPlus },
  { name: 'Attendees', description: 'View and manage registered attendees.', path: ROUTES.EVENTS_ATTENDEES, permission: Permission.VIEW_ATTENDEES, icon: Users },
  { name: 'My Events', description: 'Browse events you have organized.', path: ROUTES.EVENTS_DISCOVER, permission: Permission.VIEW_MY_EVENTS, icon: Compass },
  { name: 'Settings', description: 'Configure event, company, and app settings.', path: ROUTES.EVENTS_SETTINGS, permission: Permission.VIEW_SETTINGS, icon: Settings },
  { name: 'Reports', description: 'Track sales, expenses, and overall performance.', path: ROUTES.EVENTS_REPORTS, permission: Permission.VIEW_REPORTS, icon: BarChart3 },
];

const VISIBLE_COUNT = 5;

const PermissionDeniedPage: React.FC = () => {
  const { can, loading } = usePermissions();
  const [showAll, setShowAll] = useState(false);

  if (loading) return null;

  const allowedPages = accessibleRoutes.filter((route) => can(route.permission));
  const visiblePages = showAll ? allowedPages : allowedPages.slice(0, VISIBLE_COUNT);
  const hasMore = allowedPages.length > VISIBLE_COUNT;

  return (
    <div className="fixed inset-0 z-50 flex w-full flex-col items-center justify-center bg-slate-100 dark:bg-[#0F172A] px-4 py-10">
      <div className="w-full max-w-sm rounded-sm border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-6 shadow-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 dark:bg-[#2DD4BF]/10">
          <ShieldOff size={26} className="text-[#007A78] dark:text-[#2DD4BF]" />
        </div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Access denied</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
          You don't have permission to view this page. Ask your organizer/admin if you think this should be unlocked for you.
        </p>

        {allowedPages.length > 0 && (
          <div className="text-left space-y-2 mb-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Pages you can access
            </p>
            {visiblePages.map((page) => {
              const Icon = page.icon;
              return (
                <Link
                  key={page.path}
                  to={page.path}
                  className="flex items-center gap-3 rounded-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 hover:border-[#007A78] dark:hover:border-[#2DD4BF] transition-colors group"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-orange-50 dark:bg-[#2DD4BF]/10 text-[#007A78] dark:text-[#2DD4BF] shrink-0">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{page.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{page.description}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-[#007A78] dark:group-hover:text-[#2DD4BF] shrink-0" />
                </Link>
              );
            })}
            {hasMore && (
              <button
                onClick={() => setShowAll((prev) => !prev)}
                className="w-full rounded-sm border border-dashed border-gray-300 dark:border-slate-700 py-2 text-xs font-semibold text-[#007A78] dark:text-[#2DD4BF] hover:bg-orange-50 dark:hover:bg-[#2DD4BF]/10"
              >
                {showAll ? '↑ Show less' : `↓ Show ${allowedPages.length - VISIBLE_COUNT} more`}
              </button>
            )}
          </div>
        )}

        <Link
          to={ROUTES.EVENTS}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#007A78] dark:text-[#2DD4BF] hover:underline"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default PermissionDeniedPage;