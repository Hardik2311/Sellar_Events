import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMail, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { ROUTES } from '../constants/routes.constants';
import {
  FloatingLabelInput,
  Spinner,
  AuthHeroPanel,
} from '../components/ui/AuthUIComponents';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email) {
      setError('Please enter your registered email address.');
      return;
    }

   setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}${ROUTES.RESET_PASSWORD}`,
        handleCodeInApp: false,
      });
      setSuccessMessage(`Password reset link sent to ${email}. Check your inbox.`);
      setEmail('');
    } catch (err: any) {
      console.error('Reset password error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError('Failed to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* ================= MOBILE VIEW ================= */}
      <div className="relative min-h-screen w-screen flex flex-col lg:hidden bg-white dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC]">
        <AuthHeroPanel className="w-full h-64 shrink-0" />

        <div className="w-full bg-[#F9FAFB] dark:bg-[#1E293B] p-6 py-8 rounded-t-3xl flex-1 z-20 -mt-6 border-t border-slate-200 dark:border-slate-800 shadow-xl overflow-y-auto">
          <div className="w-full max-w-sm mx-auto">
            <h1 className="text-2xl font-bold mb-1 text-slate-900 dark:text-white">Forgot Password?</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              Enter your email and we'll send you a link to reset your password.
            </p>

            {successMessage ? (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center space-y-4">
                <div className="mx-auto bg-green-100 dark:bg-green-800/40 w-12 h-12 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                  <FiCheckCircle size={24} />
                </div>
                <p className="text-green-800 dark:text-green-300 font-medium text-sm">
                  {successMessage}
                </p>
                <Link
                  to={ROUTES.LOGIN}
                  className="block w-full bg-[#007A78] dark:bg-[#2DD4BF] text-white dark:text-slate-950 font-semibold py-3 rounded-xl hover:bg-[#006361] dark:hover:bg-[#22b8a5] transition text-sm"
                >
                  Back to Login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <FloatingLabelInput
                  id="email"
                  type="email"
                  label="Email Address"
                  icon={<FiMail size={20} />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-14 text-lg"
                />

                {error && (
                  <p className="text-red-500 text-sm text-center font-medium">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-[#007A78] hover:bg-[#006361] text-white dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5] dark:text-slate-950 font-bold transition-all text-base shadow-xs disabled:opacity-50"
                >
                  {loading ? <Spinner /> : 'Send Reset Link'}
                </button>

                <div className="text-center pt-2">
                  <Link
                    to={ROUTES.LOGIN}
                    className="inline-flex items-center text-sm font-medium text-slate-600 dark:text-slate-400"
                  >
                    <FiArrowLeft className="mr-2" />
                    Back to Login
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* ================= DESKTOP VIEW ================= */}
      <div className="hidden lg:flex h-screen w-screen items-center justify-center bg-white dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC]">
        <div className="flex w-full h-full overflow-hidden bg-white dark:bg-[#0F172A]">
          <AuthHeroPanel className="w-1/2 h-full" />

          <div className="w-1/2 flex items-center justify-center bg-[#F9FAFB] dark:bg-[#1E293B] border-l border-slate-200 dark:border-slate-800">
            <div className="grow overflow-hidden flex flex-col justify-center">
              <div className="w-full max-w-md mx-auto px-4">
                <h1 className="text-3xl font-extrabold mb-1 text-left text-slate-900 dark:text-white">Forgot Password</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  Enter your email and we'll send you a reset link.
                </p>

                {successMessage ? (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center space-y-4">
                    <FiCheckCircle className="mx-auto text-green-600 dark:text-green-400" size={28} />
                    <p className="text-green-700 dark:text-green-300 font-medium">{successMessage}</p>
                    <Link
                      to={ROUTES.LOGIN}
                      className="block w-full py-3.5 rounded-xl bg-[#007A78] hover:bg-[#006361] text-white dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5] dark:text-slate-950 font-bold transition-all text-base text-center"
                    >
                      Back to Login
                    </Link>
                  </div>
                ) : (
                  <form onSubmit={handleReset} className="space-y-5">
                    <FloatingLabelInput
                      id="email-desktop"
                      type="email"
                      label="Email Address"
                      icon={<FiMail size={18} />}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />

                    {error && (
                      <p className="text-red-500 text-sm text-center font-medium">{error}</p>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 rounded-xl bg-[#007A78] hover:bg-[#006361] text-white dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5] dark:text-slate-950 font-bold transition-all text-base shadow-xs disabled:opacity-50"
                    >
                      {loading ? <Spinner /> : 'Send Reset Link'}
                    </button>

                    <div className="text-center">
                      <Link to={ROUTES.LOGIN} className="text-sm font-medium text-slate-600 dark:text-slate-400 inline-flex items-center">
                        <FiArrowLeft className="mr-2" />
                        Back to Login
                      </Link>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ForgotPasswordPage;