import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../lib/firebase'

import {
  FiUser,
  FiMail,
  FiPhone,
  FiLock,
  FiEye,
  FiEyeOff,
  FiTag,
  FiGlobe,
  FiMessageCircle,
  FiMapPin,
  FiMap,
  FiCheckCircle,
  FiFileText,
} from 'react-icons/fi';
import { Building2Icon, PinIcon } from 'lucide-react';
import {
  FloatingLabelInput,
  FloatingLabelSelect,
  Spinner,
  Stepper,
  AuthHeroPanel,
} from '../components/ui/AuthUIComponents';

const eventCategoryOptions = [
  { value: 'Wedding', label: 'Wedding' },
  { value: 'Corporate', label: 'Corporate' },
  { value: 'Birthday', label: 'Birthday' },
  { value: 'Concert', label: 'Concert / Show' },
  { value: 'Conference', label: 'Conference' },
  { value: 'Exhibition', label: 'Exhibition' },
  { value: 'Other', label: 'Other' },
];

const indianStates = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Delhi',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Manipur', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
].map((s) => ({ value: s, label: s }));

interface SignupFormData {
  // Step 1 — account
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  // Step 2 — organizer / event details
  organizationName: string;
  eventCategory: string;
  customEventCategory: string;
  website: string;
  whatsappNumber: string;
  gstinNumber: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
}

const initialFormData: SignupFormData = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  organizationName: '',
  eventCategory: '',
  customEventCategory: '',
  website: '',
  whatsappNumber: '',
  gstinNumber: '',
  streetAddress: '',
  city: '',
  state: '',
  postalCode: '',
};

/**
 * Signup page — UI ONLY, two steps in one flow:
 *  1) Account details (name, email, phone, password)
 *  2) Organizer / event details (organization, category, address, contact)
 *
 * No image assets required — the hero panel is a CSS gradient.
 * Wire `handleFinishSetup` up to your real registration call later.
 */
const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState<SignupFormData>(initialFormData);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleChange = (field: keyof SignupFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateStep1 = (): boolean => {
    if (
      !formData.fullName.trim() ||
      !formData.email.trim() ||
      !formData.phone.trim() ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      setError('Please fill out all required fields.');
      return false;
    }
    if (formData.phone.length !== 10) {
      setError('Phone number must be exactly 10 digits.');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    const finalCategory =
      formData.eventCategory === 'Other'
        ? formData.customEventCategory
        : formData.eventCategory;

    if (
      !formData.organizationName.trim() ||
      !finalCategory.trim() ||
      !formData.streetAddress.trim() ||
      !formData.city.trim() ||
      !formData.state.trim() ||
      !formData.postalCode.trim()
    ) {
      setError('Please fill out all required fields.');
      return false;
    }
    if (formData.postalCode.length !== 6) {
      setError('Pincode must be exactly 6 digits.');
      return false;
    }
    if (
      formData.gstinNumber.trim() &&
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
        formData.gstinNumber.trim()
      )
    ) {
      setError('Please enter a valid 15-character GSTIN.');
      return false;
    }
    return true;
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validateStep1()) return;
    setStep(2);
  };

  const handleFinishSetup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    if (!validateStep2()) return;

    setIsSubmitting(true);

    try {
      const finalCategory =
        formData.eventCategory === 'Other'
          ? formData.customEventCategory
          : formData.eventCategory;

      let user = auth.currentUser;

      // 1. Create or Sign-In the User
      if (!user || user.email !== formData.email) {
        try {
          const cred = await createUserWithEmailAndPassword(
            auth,
            formData.email,
            formData.password
          );
          user = cred.user;
        } catch (err: any) {
          // If the account was already created on a previous failed attempt, log them in instead
          if (err.code === 'auth/email-already-in-use') {
            const cred = await signInWithEmailAndPassword(
              auth,
              formData.email,
              formData.password
            );
            user = cred.user;
          } else {
            throw err; // Re-throw other errors (e.g., weak password)
          }
        }
      }

      // 2. Wait for auth state to propagate to Functions SDK
      await new Promise<void>((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((u) => {
          if (u && u.uid === user!.uid) {
            unsubscribe();
            resolve();
          }
        });
      });

      const token = await user!.getIdToken(true);

      // 3. Execute Cloud Function
      const createCompany = httpsCallable(functions, 'createCompany');
      await createCompany({
        token,
        fullName: formData.fullName,
        organizationName: formData.organizationName,
        eventCategory: finalCategory,
        website: formData.website,
        whatsappNumber: formData.whatsappNumber,
        gstinNumber: formData.gstinNumber.trim().toUpperCase(),
        address: {
          street: formData.streetAddress,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
        },
      });
      setSubmitSuccess(true);
      navigate('/events');
    } catch (err: any) {
      console.error('Signup error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please log in instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak — please use at least 6 characters.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('This email exists, but the password provided is incorrect.');
      } else {
        setError('Signup failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStepClick = (target: number) => {
    if (target === 1) setStep(1);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-200">
      {/* Left panel — CSS gradient, no image */}
      <AuthHeroPanel
        className="hidden lg:flex w-1/2 h-full"
        subtitle="Create your organizer account and start listing events in minutes."
      />

      {/* Right content */}
      <div className="flex flex-col h-screen overflow-hidden bg-white w-full lg:w-1/2">
        <div className="shrink-0 bg-white pt-4 pb-2 px-4 shadow-sm z-40 flex justify-center">
          <div className="w-full max-w-xs">
            <Stepper totalSteps={2} currentStep={step} onStepClick={handleStepClick} />
          </div>
        </div>

        <div className="grow px-4 pb-32 overflow-y-auto">
          <div className="mt-3 mb-3">
            <h1 className="text-3xl font-bold">
              {step === 1 ? 'Create your account' : 'Organizer Details'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {step === 1
                ? 'Start with the basics — we’ll get your event profile set up next.'
                : 'Tell us about the events you plan so guests know who they’re booking with.'}
            </p>
          </div>

          <div className="bg-white py-4 w-full mx-auto">
            {error && (
              <div className="sticky top-0 z-50 bg-red-50 border border-red-200 text-red-600 text-sm text-center p-3 rounded-md font-medium shadow-sm mb-4">
                {error}
              </div>
            )}

            {/* ── STEP 1 : ACCOUNT ── */}
            {step === 1 && (
              <form onSubmit={handleContinue} className="flex flex-col space-y-4">
                <FloatingLabelInput
                  id="fullName"
                  label="Full Name"
                  icon={<FiUser size={20} />}
                  value={formData.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  required
                />

                <FloatingLabelInput
                  id="email"
                  type="email"
                  label="Email Address"
                  icon={<FiMail size={20} />}
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  required
                />

                <FloatingLabelInput
                  id="phone"
                  label="Phone Number"
                  icon={<FiPhone size={20} />}
                  inputMode="numeric"
                  value={formData.phone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    if (digits.length <= 10) handleChange('phone', digits);
                  }}
                  required
                />

                <div className="relative">
                  <FloatingLabelInput
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    label="Password"
                    icon={<FiLock size={18} />}
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <FiEye size={20} /> : <FiEyeOff size={20} />}
                  </button>
                </div>

                <div className="relative">
                  <FloatingLabelInput
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    label="Confirm Password"
                    icon={<FiLock size={18} />}
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showConfirm ? <FiEye size={20} /> : <FiEyeOff size={20} />}
                  </button>
                </div>
              </form>
            )}

            {/* ── STEP 2 : ORGANIZER / EVENT DETAILS ── */}
            {step === 2 && (
              <form onSubmit={handleFinishSetup} className="flex flex-col space-y-4">
                <FloatingLabelInput
                  id="organizationName"
                  label="Organization / Brand Name"
                  icon={<Building2Icon size={20} />}
                  value={formData.organizationName}
                  onChange={(e) => handleChange('organizationName', e.target.value)}
                  required
                />

                <div
                  className={`gap-4 grid grid-cols-1 ${formData.eventCategory === 'Other' ? 'md:grid-cols-2' : ''
                    }`}
                >
                  <FloatingLabelSelect
                    id="eventCategory"
                    label="Primary Event Category"
                    icon={<FiTag size={20} />}
                    value={formData.eventCategory}
                    onChange={(e) => handleChange('eventCategory', e.target.value)}
                    options={eventCategoryOptions}
                    required
                    className="w-full min-w-0"
                  />
                  {formData.eventCategory === 'Other' && (
                    <FloatingLabelInput
                      id="customEventCategory"
                      label="Specify Category"
                      icon={<FiTag size={20} />}
                      value={formData.customEventCategory}
                      onChange={(e) => handleChange('customEventCategory', e.target.value)}
                      required
                      className="w-full min-w-0"
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FloatingLabelInput
                    id="website"
                    label="Website (optional)"
                    icon={<FiGlobe size={20} />}
                    value={formData.website}
                    onChange={(e) => handleChange('website', e.target.value)}
                    placeholder=" "
                  />
                  <FloatingLabelInput
                    id="whatsappNumber"
                    label="WhatsApp Number"
                    icon={<FiMessageCircle size={20} />}
                    inputMode="numeric"
                    value={formData.whatsappNumber}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      if (digits.length <= 10) handleChange('whatsappNumber', digits);
                    }}
                  />
                </div>

                <FloatingLabelInput
                  id="gstinNumber"
                  label="GSTIN (optional)"
                  icon={<FiFileText size={20} />}
                  value={formData.gstinNumber}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    if (value.length <= 15) handleChange('gstinNumber', value);
                  }}
                  maxLength={15}
                  placeholder=" "
                />

                <FloatingLabelInput
                  id="streetAddress"
                  label="Street Address / Venue Area"
                  icon={<FiMapPin size={20} />}
                  value={formData.streetAddress}
                  onChange={(e) => handleChange('streetAddress', e.target.value)}
                  required
                />

                <div className="grid grid-cols-2 gap-4">
                  <FloatingLabelInput
                    id="city"
                    label="City"
                    icon={<FiMapPin size={20} />}
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    required
                  />
                  <FloatingLabelInput
                    id="postalCode"
                    label="Pincode"
                    icon={<PinIcon size={20} />}
                    inputMode="numeric"
                    value={formData.postalCode}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      if (digits.length <= 6) handleChange('postalCode', digits);
                    }}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FloatingLabelSelect
                    id="state"
                    label="State"
                    icon={<FiMap size={20} />}
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                    options={indianStates}
                    required
                  />
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Sticky footer action */}
        <div className="fixed lg:absolute bottom-0 left-0 lg:left-auto right-0 lg:w-1/2 p-3 h-[110px] bg-[#F9FAFB] dark:bg-[#1E293B] border-t border-slate-200 dark:border-slate-800 z-50 shadow-xl">
          <div className="max-w-md mx-auto space-y-2">
            {step === 1 ? (
              <button
                type="button"
                onClick={handleContinue}
                className="w-full py-3.5 rounded-xl bg-[#007A78] hover:bg-[#006361] text-white dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5] dark:text-slate-950 font-bold transition-all text-base shadow-xs"
              >
                Continue to Organization Setup
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinishSetup}
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-[#007A78] hover:bg-[#006361] text-white dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5] dark:text-slate-950 font-bold transition-all text-base shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <Spinner />
                    <span>Setting up account...</span>
                  </div>
                ) : submitSuccess ? (
                  <div className="flex items-center justify-center gap-2">
                    <FiCheckCircle size={18} />
                    <span>Account Created Successfully!</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>Complete Registration</span>
                    <FiCheckCircle size={18} />
                  </div>
                )}
              </button>
            )}

            {step === 1 && (
              <p className="text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                Already have an account?{' '}
                <Link to="/login" className="font-extrabold text-[#007A78] dark:text-[#2DD4BF] hover:underline">
                  Log in
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;