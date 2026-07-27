import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  FloatingLabelInput,
  CustomButton,
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
      <div className="relative h-screen w-screen flex flex-col lg:hidden">
        <AuthHeroPanel className="w-full h-64 shrink-0" />

        <div className="w-full bg-white p-6 py-8 shadow-t-lg rounded-t-2xl flex-1 z-20 -mt-6 overflow-y-auto">
          <div className="w-full max-w-sm mx-auto">
            <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
            <p className="text-sm text-gray-500 mb-5">
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
                  className="absolute right-3 top-6.5 text-gray-400"
                >
                  {showPassword ? <FiEye size={20} /> : <FiEyeOff size={20} />}
                </button>
              </div>

              <div className="flex justify-end mt-1">
                <Link to="/forgot-password" className="text-sm font-medium text-blue-600">
                  Forgot Password?
                </Link>
              </div>

              {error && (
                <p className="text-red-500 text-sm text-center font-medium">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <CustomButton
                  variant="filled"
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-14 text-lg"
                >
                  {loading ? <Spinner /> : 'Log In'}
                </CustomButton>

                <Link to="/signup" className="flex-1">
                  <CustomButton
                    variant="outline"
                    type="button"
                    className="w-full h-14 text-lg"
                  >
                    Sign Up
                  </CustomButton>
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ================= DESKTOP VIEW ================= */}
      <div className="hidden lg:flex h-screen w-screen items-center justify-center bg-white">
        <div className="flex w-full h-full rounded-sm overflow-hidden shadow-lg bg-white">
          <AuthHeroPanel className="w-1/2 h-full" />

          <div className="w-1/2 flex items-center justify-center bg-white">
            <div className="grow overflow-hidden flex flex-col justify-center">
              <div className="w-full max-w-md mx-auto px-4">
                <h1 className="text-4xl font-bold mb-1 text-left">Login</h1>
                <p className="text-sm text-gray-500 mb-6">
                  Log in to manage your events
                </p>

                <form onSubmit={handleLogin} className="space-y-6">
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <FiEye size={20} /> : <FiEyeOff size={20} />}
                    </button>
                  </div>

                  <div className="flex justify-end">
                    <Link
                      to="/forgot-password"
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      Forgot Password?
                    </Link>
                  </div>

                  {error && (
                    <p className="text-red-500 text-sm text-center">{error}</p>
                  )}

                  <div className="flex gap-3 mt-2">
                    <CustomButton
                      variant="filled"
                      type="submit"
                      disabled={loading}
                      className="flex-1 h-12 text-lg"
                    >
                      {loading ? <Spinner /> : 'Log In'}
                    </CustomButton>

                    <Link to="/signup" className="flex-1">
                      <CustomButton
                        variant="outline"
                        type="button"
                        className="w-full h-12 text-lg"
                      >
                        Sign Up
                      </CustomButton>
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