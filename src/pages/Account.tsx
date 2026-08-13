import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { FiEdit2, FiLogOut, FiCreditCard, FiHelpCircle, FiSettings, FiSun, FiMoon } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { ROUTES } from '../constants/routes.constants';
//import ThemeToggle from '../components/ui/ThemeToggle';

const Account: React.FC = () => {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/login');
    };

    const handleEditProfile = () => {
        navigate('/events/account/edit');
    };

    return (
        <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-16">
            {/* ── Header ── */}
            <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-4 py-3 shadow-xs">
                <div className="w-10" />
                <div className="flex-1 text-center">
                    <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">Organizer Account</h1>
                </div>
                {/* <ThemeToggle /> */}
            </header>

            {/* ── Profile section ── */}
            <div className="flex flex-col py-6 items-center">
                <div className="relative mb-3">
                    {profile?.profilePictureUrl ? (
                        <img
                            src={profile.profilePictureUrl}
                            alt="Profile"
                            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-2 border-[#007A78] dark:border-[#2DD4BF] shadow-md"
                        />
                    ) : (
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-sm border-2 border-[#007A78] dark:border-[#2DD4BF] shadow-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-14 h-14 text-slate-400 dark:text-slate-500">
                                <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}

                    <button
                        onClick={handleEditProfile}
                        className="absolute bottom-0 right-0 p-2 rounded-full bg-[#007A78] hover:bg-[#006361] text-white dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5] dark:text-slate-950 shadow-md transition-all active:scale-95"
                        title="Edit Profile"
                    >
                        <FiEdit2 size={14} />
                    </button>
                </div>

                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {profile?.fullName || 'Organizer User'}
                </h2>
                <p className="text-xs font-semibold text-[#007A78] dark:text-[#2DD4BF] mt-0.5">
                    {profile?.organizationName || 'Sellar Events Partner'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {profile?.email || 'organizer@sellar.in'}
                </p>
            </div>

            {/* ── Theme selector & Quick links ── */}
            <div className="flex-1 p-4">
                <div className="w-full max-w-2xl mx-auto space-y-4">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">Quick Actions</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Link
                            to="/plans"
                            className="flex items-center gap-3 bg-white dark:bg-[#1E293B] p-4 rounded-sm shadow-sm border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:border-[#007A78]/50 dark:hover:border-[#2DD4BF]/50 transition-all"
                        >
                            <div className="p-2.5 rounded-sm bg-[#007A78]/10 text-[#007A78] dark:bg-[#2DD4BF]/15 dark:text-[#2DD4BF]">
                                <FiCreditCard className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-bold flex-1">Subscription & Plans</span>
                            <span className="text-slate-400 font-bold">→</span>
                        </Link>

                        <Link to={`${ROUTES.EVENTS}/${ROUTES.EVENTS_SUPPORT}`}
                            className="flex items-center gap-3 bg-white dark:bg-[#1E293B] p-4 rounded-sm shadow-sm border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:border-[#007A78]/50 dark:hover:border-[#2DD4BF]/50 transition-all"
                        >
                            <div className="p-2.5 rounded-sm bg-[#007A78]/10 text-[#007A78] dark:bg-[#2DD4BF]/15 dark:text-[#2DD4BF]">
                            <div className="p-2.5 rounded-sm bg-[#007A78]/10 text-[#007A78] dark:bg-[#2DD4BF]/15 dark:text-[#2DD4BF]">
                                <FiHelpCircle className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-bold flex-1">Help & Support</span>
                            <span className="text-slate-400 font-bold">→</span>
                        </Link>

                        <Link
                            to="/events/settings"
                            className="flex items-center gap-3 bg-white dark:bg-[#1E293B] p-4 rounded-sm shadow-sm border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:border-[#007A78]/50 dark:hover:border-[#2DD4BF]/50 transition-all sm:col-span-2"
                        >
                            <div className="p-2.5 rounded-sm bg-slate-500/10 text-slate-500 dark:text-slate-400">
                                <FiSettings className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-bold flex-1">Platform Settings</span>
                            <span className="text-slate-400 font-bold">→</span>
                        </Link>
                    </div>

                    <div className="mt-8 flex flex-col items-center">
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 rounded-sm bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 transition-colors shadow-xs"
                        >
                            <FiLogOut className="w-4 h-4" />
                            Logout Account
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Account;