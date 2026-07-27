import { Suspense, useRef, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Users, UserCircle, Compass } from 'lucide-react';

// TODO: replace with your real logo import, same as CatalogueLayout
// import sellarLogo from '../assets/sellar-logo-heading.png';

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
    `flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all ${
      isActive
        ? 'bg-orange-50 text-[#F97316] shadow-sm border border-orange-100'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
    }`;

  return (
    <div className="h-dvh w-screen flex flex-col md:flex-row overflow-hidden bg-gray-100">
      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden md:flex flex-col w-48 bg-white border-r border-slate-200 h-full shrink-0 z-20">
        <div className="p-6 border-b border-slate-100">
          <p className="font-bold text-lg text-slate-800">Events</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} end className={({ isActive }) => sidebarLinkClass(isActive)}>
              <span>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 relative flex flex-col min-w-0 overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto pb-20 md:pb-4 scroll-smooth">
          <Suspense fallback={<div className="p-4 text-sm text-slate-500">Loading...</div>}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* --- MOBILE BOTTOM NAV --- */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full border-t border-slate-200 bg-white z-40">
        <div className="flex justify-around items-center gap-1 px-1 pt-2 pb-3">
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-sm text-[10px] transition-colors ${
                  isActive ? 'bg-[#F97316] text-white' : 'text-slate-500 hover:bg-gray-100'
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