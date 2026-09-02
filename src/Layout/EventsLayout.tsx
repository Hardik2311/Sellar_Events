import { Suspense, useRef, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Users, UserCircle, Compass, Ticket, IndianRupee, UserPlus, Share2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useExpenses } from '../hooks/useExpenses';
import { usePermissions } from '../hooks/usePermissions';
import { Permission } from '../types/permissions.types';
import { ExpenseModal } from '../components/ExpenseModal';
import { fetchEventDashboardData } from '../lib/fetchEventDashboardData';
import type { EventSummary } from '../types/event.types';
import { UserAddModal } from '../pages/UserAdd';
import { ShareLinkPickerModal } from '../components/ShareLinkPickerModal';
import { canManageUsers } from '../enum/enum';
import type { JSX } from 'react';
import ShowWrapper from '../components/ShowWrapper';

const NAV_ITEMS = [
  { to: '/events', label: 'Dashboard', icon: <LayoutDashboard size={18} />, permission: Permission.VIEW_DASHBOARD },
  { to: '/events/attendees', label: 'Attendees', icon: <Users size={18} />, permission: Permission.VIEW_ATTENDEES },
  { to: '/events/discover', label: 'Discover', icon: <Compass size={18} />, permission: Permission.VIEW_MY_EVENTS },
  { to: '/events/account', label: 'Account', icon: <UserCircle size={18} />, permission: null },
];

// NEW — only shown when canManageUsers(profile.role) is true — opens Add User as a popup (not a route)
const USER_MANAGEMENT_ITEM = { label: 'Add User', icon: <UserPlus size={18} /> };

const MOBILE_LEFT_ITEMS = [
  { to: '/events', label: 'Dashboard', icon: <LayoutDashboard size={18} />, permission: Permission.VIEW_DASHBOARD },
  { to: '/events/discover', label: 'Discover', icon: <Compass size={18} />, permission: Permission.VIEW_MY_EVENTS },
];

const MOBILE_RIGHT_ITEMS = [
  { to: '/events/attendees', label: 'Attendees', icon: <Users size={18} />, permission: Permission.VIEW_ATTENDEES },
  { to: '/events/account', label: 'Account', icon: <UserCircle size={18} />, permission: null },
];

// const MOBILE_QUICK_LINKS = [
//   { to: '/events/create', label: 'Create Event', icon: <PlusCircle size={20} /> },
// ];

const EventsLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();
  const { can } = usePermissions();
  const showManageUsers = canManageUsers(profile?.role);
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.permission || can(item.permission));
  const visibleMobileLeft = MOBILE_LEFT_ITEMS.filter((item) => !item.permission || can(item.permission));
  const visibleMobileRight = MOBILE_RIGHT_ITEMS.filter((item) => !item.permission || can(item.permission));

  const fanActions = [
    {
      key: 'add-event',
      label: 'Add Event',
      icon: <PlusCircle size={20} />,
      onClick: () => navigate('/events/create'),
    },
    showManageUsers && {
      key: 'add-user',
      label: USER_MANAGEMENT_ITEM.label,
      icon: USER_MANAGEMENT_ITEM.icon,
      onClick: () => setIsUserAddModalOpen(true),
    },
    {
      key: 'add-expense',
      label: 'Add Expense',
      icon: <IndianRupee size={18} />,
      onClick: () => setIsExpenseModalOpen(true),
    },
    {
      key: 'share',
      label: 'Share',
      icon: <Share2 size={18} />,
      onClick: () => setIsShareLinkModalOpen(true),
    },
  ].filter(Boolean) as { key: string; label: string; icon: JSX.Element; onClick: () => void }[];
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isUserAddModalOpen, setIsUserAddModalOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [isShareLinkModalOpen, setIsShareLinkModalOpen] = useState(false); // Combined Share popup (View Store / WhatsApp / Copy Link)
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const { addExpense } = useExpenses(profile?.companyId, undefined);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
    setIsQuickActionsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!profile?.companyId) {
      setEventsLoading(false);
      return;
    }
    fetchEventDashboardData({
      companyId: profile.companyId,
      startDate: '2000-01-01',
      endDate: '2100-01-01',
      cacheKey: `event_list_cache_v2_${profile.companyId}`,
    })
      .then((result) => setEvents(result.events))
      .catch((e) => console.error('Failed to load events for expense modal:', e))
      .finally(() => setEventsLoading(false));
  }, [profile?.companyId]);

  const sidebarLinkClass = (isActive: boolean) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${isActive
      ? 'bg-[#007A78]/10 text-[#007A78] dark:bg-[#2DD4BF]/15 dark:text-[#2DD4BF] shadow-xs'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
    }`;

  return (
    <div className="h-dvh w-screen flex flex-col md:flex-row overflow-hidden bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC]">
      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden md:flex flex-col w-56 bg-white dark:bg-[#1E293B] border-r border-slate-200 dark:border-slate-800 h-full shrink-0 z-20">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#007A78] dark:bg-[#2DD4BF] text-white dark:text-slate-950 shadow-xs">
              <Ticket size={20} className="rotate-[-10deg]" />
            </div>
            <div>
              <p className="font-extrabold text-base text-slate-900 dark:text-white">
                Sellar <span className="text-[#007A78] dark:text-[#2DD4BF]">Events</span>
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold">
                Platform
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3.5 space-y-1.5">
          {visibleNavItems.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} end className={({ isActive }) => sidebarLinkClass(isActive)}>
              <span>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}

          {/* NEW — divider separating main nav from Quick Actions */}
          <div className="my-2 border-t border-slate-200 dark:border-slate-800" />

          {/* NEW — Quick Actions section: Create Event, Add User, Add Expense, Share (Share last) */}
          <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Quick Actions
          </p>

          {can(Permission.VIEW_CREATE_EVENT) && (
            <NavLink to="/events/create" end className={({ isActive }) => sidebarLinkClass(isActive)}>
              <span><PlusCircle size={18} /></span>
              <span>Create Event</span>
            </NavLink>
          )}

          {showManageUsers && (
            <button
              onClick={() => setIsUserAddModalOpen(true)}
              className={sidebarLinkClass(false)}
            >
              <span>{USER_MANAGEMENT_ITEM.icon}</span>
              <span>{USER_MANAGEMENT_ITEM.label}</span>
            </button>
          )}
          <ShowWrapper permission={Permission.ADD_EXPENSE}>
            <button onClick={() => setIsExpenseModalOpen(true)} className={sidebarLinkClass(false)}>
              <span><IndianRupee size={18} /></span>
              <span>Add Expense</span>
            </button>
          </ShowWrapper>

          {/* Share — opens combined popup directly (View Store / WhatsApp / Share Link) */}
          <button onClick={() => setIsShareLinkModalOpen(true)} className={sidebarLinkClass(false)}>
            <span><Share2 size={18} /></span>
            <span>Share</span>
          </button>
        </nav>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 relative flex flex-col min-w-0 overflow-hidden bg-white dark:bg-[#0F172A]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto pb-20 md:pb-4 scroll-smooth">
          <Suspense fallback={
            <div className="flex h-64 w-full items-center justify-center">
              <div className="flex items-center gap-3 rounded-2xl bg-[#F9FAFB] dark:bg-[#1E293B] px-5 py-3 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#007A78] dark:border-[#2DD4BF] border-t-transparent" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Loading...</span>
              </div>
            </div>
          }>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* --- MOBILE BOTTOM NAV --- */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-40">
        {/* Backdrop — tap outside to close the quick actions popup */}
        {isQuickActionsOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/20"
            onClick={() => setIsQuickActionsOpen(false)}
          />
        )}

        {isQuickActionsOpen && (
          <div className="absolute bottom-[calc(100%+0.75rem)] left-1/2 -translate-x-1/2 z-40 flex flex-col-reverse items-center gap-2 w-52">
            {fanActions.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setIsQuickActionsOpen(false);
                  item.onClick();
                }}
                className="w-full flex items-center justify-center gap-2 rounded-sm bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 shadow-lg px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 active:scale-95 transition-transform"
              >
                <span className="text-[#007A78] dark:text-[#2DD4BF]">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="relative flex justify-around items-center gap-1 px-2 py-2 border-t border-slate-200 dark:border-slate-800 bg-[#F9FAFB] dark:bg-[#1E293B] shadow-lg">
          {/* Left group */}
          <div className="flex-1 flex items-center gap-1">
            {visibleMobileLeft.map(({ to, icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  `flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-bold transition-colors ${isActive
                    ? 'bg-[#007A78] text-white dark:bg-[#2DD4BF] dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'
                  }`
                }
              >
                {icon}
                <span className="truncate">{label}</span>
              </NavLink>
            ))}
          </div>

          {/* Center quick actions "+" button */}
          <div className="shrink-0 flex justify-center px-1">
            <button
              onClick={() => setIsQuickActionsOpen((v) => !v)}
              aria-label="Quick actions"
              className="relative -top-5 h-14 w-14 rounded-full bg-[#007A78] dark:bg-[#2DD4BF] text-white dark:text-slate-950 shadow-lg flex items-center justify-center active:scale-95 transition-transform"
            >
              <PlusCircle
                size={28}
                className={`transition-transform duration-200 ${isQuickActionsOpen ? 'rotate-45' : ''}`}
              />
            </button>
          </div>

          {/* Right group */}
          <div className="flex-1 flex items-center gap-1">
            {visibleMobileRight.map(({ to, icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  `flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-bold transition-colors ${isActive
                    ? 'bg-[#007A78] text-white dark:bg-[#2DD4BF] dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'
                  }`
                }
              >
                {icon}
                <span className="truncate">{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </nav >

      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        events={events}
        eventsLoading={eventsLoading}
        onSave={async data => {
          if (!profile?.companyId) return;
          // Save under whichever real event the user picked inside the
          // modal's own EventListCard — not a hardcoded placeholder.
          await addExpense(profile.companyId, data.eventId, data);
        }}
      />
      <UserAddModal
        isOpen={isUserAddModalOpen}
        onClose={() => setIsUserAddModalOpen(false)}
      />
      <ShareLinkPickerModal
        isOpen={isShareLinkModalOpen}
        onClose={() => setIsShareLinkModalOpen(false)}
        events={events}
        eventsLoading={eventsLoading}
      />
    </div >
  );
};

export default EventsLayout;