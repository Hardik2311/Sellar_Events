import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket, Users, ChevronRight, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { ROUTES } from '../../constants/routes.constants';

const TILES = [
    {
        key: 'tickets',
        title: 'Support Tickets',
        description: 'Tickets raised from the Help & Support page',
        icon: Ticket,
        path: ROUTES.EVENTS_SUPER_ADMIN_TICKETS,
    },
    {
        key: 'leads',
        title: 'Plan Leads',
        description: 'Leads generated from the Recharge / Buy Credits page',
        icon: Users,
        path: ROUTES.EVENTS_SUPER_ADMIN_LEADS,
    },
];

const SuperAdminHub: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="flex min-h-screen w-full flex-col bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-16">
            {/* Header */}
            <header className="sticky top-0 z-20 flex shrink-0 items-center justify-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-6 py-4 relative">
                <div className="absolute left-6 top-1/2 -translate-y-1/2">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                </div>
                <div className="text-center">
                    <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Super Admin</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Manage tickets and leads across all companies</p>
                </div>
            </header>

            <main className="grow overflow-y-auto p-4 lg:p-6">
                <div className="mx-auto max-w-3xl flex flex-col gap-4">
                    <Card className="shadow-sm border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
                        <CardContent className="pt-5 flex items-center gap-3">
                            <div className="p-2.5 rounded-sm bg-[#007A78]/10 dark:bg-[#2DD4BF]/15 text-[#007A78] dark:text-[#2DD4BF]">
                                <ShieldCheck size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Access level</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">Super Admin</p>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {TILES.map((tile) => {
                            const Icon = tile.icon;
                            return (
                                <button
                                    key={tile.key}
                                    onClick={() => navigate(tile.path)}
                                    className="group flex flex-col gap-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] px-5 py-5 text-left shadow-sm hover:border-[#007A78] dark:hover:border-[#2DD4BF] hover:shadow-md transition-all"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="p-2.5 rounded-sm bg-[#007A78]/10 dark:bg-[#2DD4BF]/15 text-[#007A78] dark:text-[#2DD4BF]">
                                            <Icon size={20} />
                                        </div>
                                        <ChevronRight
                                            size={18}
                                            className="text-slate-300 dark:text-slate-600 group-hover:text-[#007A78] dark:group-hover:text-[#2DD4BF] group-hover:translate-x-0.5 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{tile.title}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{tile.description}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SuperAdminHub;