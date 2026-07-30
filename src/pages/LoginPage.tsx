import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  FloatingLabelInput,
  Spinner,
  AuthHeroPanel,
} from '../components/ui/AuthUIComponents';

/**
 * Login page — UI ONLY.
 * Wire `handleLogin` up to your real auth call (Firebase/API) later.
 * No image assets required — the hero panel is a CSS gradient.
 */
const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/events');
    } catch (err: any) {
      console.error('Login error:', err);
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found'
      ) {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError('Login failed. Please try again.');
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
            <h1 className="text-2xl font-bold mb-1 text-slate-900 dark:text-white">Welcome back</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              Log in to manage your events
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
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

              <div className="relative">
                <FloatingLabelInput
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  label="Password"
                  icon={<FiLock size={20} />}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

              <div className="flex justify-end mt-1">
                <Link to="/forgot-password" className="text-sm font-bold text-[#007A78] dark:text-[#2DD4BF] hover:underline">
                  Forgot Password?
                </Link>
              </div>

              {error && (
                <p className="text-red-500 text-sm text-center font-medium">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3.5 rounded-xl bg-[#007A78] hover:bg-[#006361] text-white dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5] dark:text-slate-950 font-bold transition-all text-base shadow-xs disabled:opacity-50"
                >
                  {loading ? <Spinner /> : 'Log In'}
                </button>

                <Link to="/signup" className="flex-1">
                  <button
                    type="button"
                    className="w-full py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-base"
                  >
                    Sign Up
                  </button>
                </Link>
              </div>
            </form>
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
                <h1 className="text-3xl font-extrabold mb-1 text-left text-slate-900 dark:text-white">Login</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  Log in to manage your events
                </p>

                <form onSubmit={handleLogin} className="space-y-5">
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

                  <div className="relative">
                    <FloatingLabelInput
                      id="password-desktop"
                      type={showPassword ? 'text' : 'password'}
                      label="Password"
                      icon={<FiLock size={16} />}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPassword ? <FiEye size={20} /> : <FiEyeOff size={20} />}
                    </button>
                  </div>

                  <div className="flex justify-end">
                    <Link
                      to="/forgot-password"
                      className="text-sm font-bold text-[#007A78] dark:text-[#2DD4BF] hover:underline"
                    >
                      Forgot Password?
                    </Link>
                  </div>

                  {error && (
                    <p className="text-red-500 text-sm text-center font-medium">{error}</p>
                  )}

                  <div className="flex gap-3 mt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-3.5 rounded-xl bg-[#007A78] hover:bg-[#006361] text-white dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5] dark:text-slate-950 font-bold transition-all text-base shadow-xs disabled:opacity-50"
                    >
                      {loading ? <Spinner /> : 'Log In'}
                    </button>

                    <Link to="/signup" className="flex-1">
                      <button
                        type="button"
                        className="w-full py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-base"
                      >
                        Sign Up
                      </button>
                    </Link>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;