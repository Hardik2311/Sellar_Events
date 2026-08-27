import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiLock, FiEye, FiEyeOff, FiCheckCircle } from 'react-icons/fi';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { ROUTES } from '../constants/routes.constants';
import {
  FloatingLabelInput,
  Spinner,
  AuthHeroPanel,
} from '../components/ui/AuthUIComponents';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const oobCode = searchParams.get('oobCode');

  const [verifying, setVerifying] = useState(true);
  const [validCode, setValidCode] = useState(false);
  const [email, setEmail] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setError('Invalid or missing reset link.');
      setVerifying(false);
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((verifiedEmail) => {
        setEmail(verifiedEmail);
        setValidCode(true);
      })
      .catch(() => {
        setError('This reset link is invalid or has expired. Please request a new one.');
      })
      .finally(() => setVerifying(false));
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || !confirmPassword) {
      setError('Please fill in both fields.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode as string, newPassword);
      setSuccess(true);
      setTimeout(() => navigate(ROUTES.LOGIN), 2500);
    } catch (err: any) {
      console.error('Confirm reset error:', err);
      if (err.code === 'auth/expired-action-code') {
        setError('This reset link has expired. Please request a new one.');
      } else if (err.code === 'auth/invalid-action-code') {
        setError('This reset link is invalid or already used.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Use at least 6 characters.');
      } else {
        setError('Failed to reset password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderBody = () => {
    if (verifying) {
      return (
        <div className="flex justify-center py-10">
          <Spinner size={28} />
        </div>
      );
    }

    if (success) {
      return (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center space-y-4">
          <FiCheckCircle className="mx-auto text-green-600 dark:text-green-400" size={28} />
          <p className="text-green-700 dark:text-green-300 font-medium text-sm">
            Password reset successfully. Redirecting to login...
          </p>
        </div>
      );
    }

    if (!validCode) {
      return (
        <div className="space-y-4 text-center">
          <p className="text-red-500 text-sm font-medium">{error}</p>
          <Link
            to={ROUTES.FORGOT_PASSWORD}
            className="inline-block text-sm font-bold text-[#007A78] dark:text-[#2DD4BF] hover:underline"
          >
            Request a new link
          </Link>
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2 mb-2">
          Resetting password for <span className="font-semibold">{email}</span>
        </p>

        <div className="relative">
          <FloatingLabelInput
            id="new-password"
            type={showPassword ? 'text' : 'password'}
            label="New Password"
            icon={<FiLock size={20} />}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            disabled={loading}
            className="h-14 text-lg pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-6.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            {showPassword ? <FiEye size={20} /> : <FiEyeOff size={20} />}
          </button>
        </div>

        <FloatingLabelInput
          id="confirm-password"
          type={showPassword ? 'text' : 'password'}
          label="Confirm Password"
          icon={<FiLock size={20} />}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={loading}
          className="h-14 text-lg"
        />

        {error && (
          <p className="text-red-500 text-sm text-center font-medium">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-[#007A78] hover:bg-[#006361] text-white dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5] dark:text-slate-950 font-bold transition-all text-base shadow-xs disabled:opacity-50"
        >
          {loading ? <Spinner /> : 'Reset Password'}
        </button>
      </form>
    );
  };

  return (
    <>
      {/* ================= MOBILE VIEW ================= */}
      <div className="relative min-h-screen w-screen flex flex-col lg:hidden bg-white dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC]">
        <AuthHeroPanel className="w-full h-64 shrink-0" />
        <div className="w-full bg-[#F9FAFB] dark:bg-[#1E293B] p-6 py-8 rounded-t-3xl flex-1 z-20 -mt-6 border-t border-slate-200 dark:border-slate-800 shadow-xl overflow-y-auto">
          <div className="w-full max-w-sm mx-auto">
            <h1 className="text-2xl font-bold mb-1 text-slate-900 dark:text-white">Reset Password</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              Choose a new password for your account
            </p>
            {renderBody()}
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
                <h1 className="text-3xl font-extrabold mb-1 text-left text-slate-900 dark:text-white">Reset Password</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  Choose a new password for your account
                </p>
                {renderBody()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ResetPassword;