import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
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
} from 'react-icons/fi';
import { Building2Icon, PinIcon } from 'lucide-react';
import {
  FloatingLabelInput,
  FloatingLabelSelect,
  CustomButton,
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

      const cred = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const createTenant = httpsCallable(functions, 'createTenant');
      await createTenant({
        fullName: formData.fullName,
        organizationName: formData.organizationName,
        eventCategory: finalCategory,
        website: formData.website,
        whatsappNumber: formData.whatsappNumber,
        address: {
          street: formData.streetAddress,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
        },
      });
      await cred.user.getIdToken(true);
      setSubmitSuccess(true);
      navigate('/events');
    } catch (err: any) {
      console.error('Signup error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please log in instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak — please use at least 6 characters.');
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
                  className={`gap-4 ${formData.eventCategory === 'Other' ? 'flex flex-col md:flex-row' : 'grid grid-cols-1'
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
                    className={formData.eventCategory === 'Other' ? 'md:w-1/2' : 'w-full'}
                  />
                  {formData.eventCategory === 'Other' && (
                    <FloatingLabelInput
                      id="customEventCategory"
                      label="Specify Category"
                      icon={<FiTag size={20} />}
                      value={formData.customEventCategory}
                      onChange={(e) => handleChange('customEventCategory', e.target.value)}
                      required
                      className="md:w-1/2"
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
        <div className="fixed lg:absolute bottom-0 left-0 lg:left-auto right-0 lg:w-1/2 p-2 h-[110px] bg-gray-100 border-t border-gray-200 z-50 shadow-lg">
          <div className="max-w-md mx-auto space-y-2">
            {step === 1 ? (
              <CustomButton
                type="button"
                variant="filled"
                onClick={handleContinue}
                className="w-full h-12 text-lg"
              >
                Continue
              </CustomButton>
            ) : (
              <CustomButton
                type="button"
                variant="filled"
                onClick={handleFinishSetup}
                disabled={isSubmitting}
                className="w-full h-12 text-lg"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <Spinner />
                    <span>Setting up...</span>
                  </div>
                ) : submitSuccess ? (
                  <div className="flex items-center justify-center gap-2">
                    <FiCheckCircle />
                    <span>Account Created</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>Complete Registration</span>
                    <FiCheckCircle />
                  </div>
                )}
              </CustomButton>
            )}

            {step === 1 && (
              <p className="text-center text-sm text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-blue-600 hover:underline">
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