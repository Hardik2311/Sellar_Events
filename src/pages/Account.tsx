import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { FiEdit2, FiLogOut, FiCreditCard, FiHelpCircle, FiSettings } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';

const Account: React.FC = () => {
    const navigate = useNavigate();
    const { user, profile } = useAuth();

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/login');
    };

    const handleEditProfile = () => {
        // TODO: point this at your edit-profile route once it exists
        navigate('/events/account/edit');
    };

    return (
        <div className="flex min-h-screen flex-col bg-gray-100">
            {/* ── Header ── */}
            <header className="flex shrink-0 items-center justify-between border-b border-slate-300 bg-gray-100 p-4">
                <div className="w-10" />
                <div className="flex-1 text-center">
                    <h1 className="text-2xl font-bold text-slate-800">Account</h1>
                </div>
                <div className="w-10" />
            </header>

            {/* ── Profile section ── */}
            <div className="flex flex-col py-6 items-center">
                <div className="relative mb-2">
                    {false ? (
                        <img
                            className="w-32 h-32 rounded-full object-cover border border-white shadow-lg bg-white"
                            src=""
                            alt="Profile"
                        />
                    ) : (
                        <div className="w-32 h-32 rounded-full border border-white shadow-lg bg-gray-200 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 text-gray-400">
                                <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}

                    <button
                        onClick={handleEditProfile}
                        className="absolute -top-1 -right-1 bg-white p-1.5 rounded-full shadow-lg hover:bg-gray-200 transition focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center"
                        aria-label="Edit profile"
                    >
                        <FiEdit2 className="w-5 h-5 text-gray-700" />
                    </button>
                </div>

                <h2 className="text-2xl font-semibold text-slate-900">{profile?.fullName}</h2>
                <p className="text-base text-gray-500">{profile?.email}</p>
                <span className="mt-2 inline-block rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
                    {profile?.role}
                </span>
            </div>

            {/* ── Quick links ── */}
            <div className="flex-1 bg-gray-100 p-2">
                <div className="w-full max-w-2xl mx-auto">
                    <h2 className="text-xl font-semibold text-slate-800 mb-4 px-2">Quick Actions</h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Link
                            to="/plans"
                            className="flex items-center gap-3 bg-white p-4 rounded-sm shadow-md border border-gray-200 text-gray-800 hover:shadow-lg transition"
                        >
                            <FiCreditCard className="w-5 h-5 text-slate-500" />
                            <span className="text-lg font-medium flex-1">Plans</span>
                            <span className="text-xl text-gray-600">→</span>
                        </Link>

                        <Link
                            to="/support"
                            className="flex items-center gap-3 bg-white p-4 rounded-sm shadow-md border border-gray-200 text-gray-800 hover:shadow-lg transition"
                        >
                            <FiHelpCircle className="w-5 h-5 text-slate-500" />
                            <span className="text-lg font-medium flex-1">Support</span>
                            <span className="text-xl text-gray-600">→</span>
                        </Link>

                        <Link
                            to="/settings"
                            className="flex items-center gap-3 bg-white p-4 rounded-sm shadow-md border border-gray-200 text-gray-800 hover:shadow-lg transition sm:col-span-2"
                        >
                            <FiSettings className="w-5 h-5 text-slate-500" />
                            <span className="text-lg font-medium flex-1">Settings</span>
                            <span className="text-xl text-gray-600">→</span>
                        </Link>
                    </div>

                    <div className="mt-8 flex flex-col items-center">
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 rounded-sm bg-red-500 py-3 px-8 font-semibold text-white transition hover:bg-red-600"
                        >
                            <FiLogOut className="w-4 h-4" />
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Account;