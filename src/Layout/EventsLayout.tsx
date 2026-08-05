import { Suspense, useRef, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Users, UserCircle, Compass, Ticket } from 'lucide-react';
//import ThemeToggle from '../components/ui/ThemeToggle';

const NAV_ITEMS = [
  { to: '/events', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/events/create', label: 'Create Event', icon: <PlusCircle size={18} /> },
  { to: '/events/discover', label: 'Discover', icon: <Compass size={18} /> },
  { to: '/events/attendees', label: 'Attendees', icon: <Users size={18} /> },
  { to: '/events/account', label: 'Account', icon: <UserCircle size={18} /> },
];

const EventsLayout = () => {
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [location.pathname]);

  const sidebarLinkClass = (isActive: boolean) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
      isActive
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
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} end className={({ isActive }) => sidebarLinkClass(isActive)}>
              <span>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
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
      <nav className="md:hidden fixed bottom-0 left-0 w-full border-t border-slate-200 dark:border-slate-800 bg-[#F9FAFB] dark:bg-[#1E293B] z-40 shadow-lg">
        <div className="flex justify-around items-center gap-1 px-2 py-2">
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-bold transition-colors ${
                  isActive
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
      </nav>
    </div>
  );
};

export default EventsLayout;