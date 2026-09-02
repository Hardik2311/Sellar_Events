import React from 'react';
import { Link } from 'react-router-dom';
import { Users, ShieldCheck } from 'lucide-react';
import { ROUTES } from '../constants/routes.constants';
import BackButton from '../components/ui/BackButton';
import { useAuth } from '../context/AuthContext';
import { canManageUsers, ROLES } from '../enum/enum';

const UserSettingsHub: React.FC = () => {
    const { profile } = useAuth();
    const showManageUsers = canManageUsers(profile?.role);
    const isOwner = profile?.role === ROLES.ORGANIZER;

    return (
        <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-16">
            <header className="relative sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-4 py-3 shadow-xs">
                <BackButton title="Back" />
                <div className="absolute left-1/2 -translate-x-1/2 text-center flex flex-col items-center justify-center max-w-[70%]">
                    <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate">User Settings</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">Manage users and their permissions</p>
                </div>
                <div className="w-[38px]"></div>
            </header>

            <main className="grow overflow-y-auto p-4 sm:p-6">
                <div className="mx-auto max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {showManageUsers && (
                        <Link
                            to={`/${ROUTES.EVENTS}/${ROUTES.EVENTS_SETTINGS_USERS}`.replace('//', '/')}
                            className="flex items-start gap-3 bg-white dark:bg-[#1E293B] p-4 rounded-sm shadow-sm border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:border-[#007A78]/50 dark:hover:border-[#2DD4BF]/50 transition-all"
                        >
                            <div className="p-2.5 rounded-sm bg-[#007A78]/10 text-[#007A78] dark:bg-[#2DD4BF]/15 dark:text-[#2DD4BF] shrink-0">
                                <Users className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-bold">Manage Users</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Add Team Leaders and Team Members
                                </p>
                            </div>
                        </Link>
                    )}

                    {isOwner && (
                        <Link
                            to={`/${ROUTES.EVENTS}/${ROUTES.EVENTS_SETTINGS_PERMISSIONS}`.replace('//', '/')}
                            className="flex items-start gap-3 bg-white dark:bg-[#1E293B] p-4 rounded-sm shadow-sm border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:border-[#007A78]/50 dark:hover:border-[#2DD4BF]/50 transition-all"
                        >
                            <div className="p-2.5 rounded-sm bg-[#007A78]/10 text-[#007A78] dark:bg-[#2DD4BF]/15 dark:text-[#2DD4BF] shrink-0">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-bold">Permissions</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Set what Team Leaders and Team Members can access
                                </p>
                            </div>
                        </Link>
                    )}
                </div>
            </main>
        </div>
    );
};

export default UserSettingsHub;