import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  type User,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { doc, setDoc } from 'firebase/firestore';
import { auth, functions, db } from '../lib/firebase'
import { mapGstRegistrationType } from '../lib/gstMapping';

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
  FiCreditCard,
} from 'react-icons/fi';
import { Building2Icon, PinIcon } from 'lucide-react';
import {
  FloatingLabelInput,
  FloatingLabelSelect,
  Spinner,
  Stepper,
  AuthHeroPanel,
} from '../components/ui/AuthUIComponents';
import SmokeScreenLoader from '../components/ui/SmokeScreenLoader';
import IdentityDocumentUpload, { type DocFile } from '../components/IdentityUpload';
import FloatingEventIcons from '../components/ui/FloatingEventIcons';

const eventCategoryOptions = [
  { value: 'Concert', label: 'Concert / Show' },
  { value: 'Conference', label: 'Conference' },
  { value: 'Exhibition', label: 'Exhibition' },
  { value: 'Fitness', label: 'Fitness / Run / Sports' },
  { value: 'Workshop', label: 'Workshop / Masterclass' },
  { value: 'Meetup', label: 'Meetup / Networking' },
  { value: 'Festival', label: 'Festival / Fair' },
  { value: 'Webinar', label: 'Webinar / Online Event' },
  { value: 'Other', label: 'Other' },
];

const indianStates = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Delhi',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Manipur', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
].map((s) => ({ value: s, label: s }));

const gstRegistrationOptions = [
  { value: 'regular_inclusive', label: 'Regular (Tax Inclusive)' },
  { value: 'regular_exclusive', label: 'Regular (Tax Exclusive)' },
  { value: 'composition', label: 'Composite' },
  { value: 'none', label: 'Not Registered / NA' },
];

const PHONE_REGEX = /^[6-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  gstRegistrationType: string;
  gstinNumber: string;
  aadhaarNumber: string;
  panNumber: string;
  aadhaarDocUrls: DocFile[];
  panDocUrls: DocFile[];
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
  gstRegistrationType: 'none',
  gstinNumber: '',
  aadhaarNumber: '',
  panNumber: '',
  aadhaarDocUrls: [],
  panDocUrls: [],
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
  const [showSmokeScreen, setShowSmokeScreen] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null); // set once step 1 account is created
  const [aadhaarError, setAadhaarError] = useState<string | null>(null);
  const [panError, setPanError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

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
    if (!EMAIL_REGEX.test(formData.email.trim())) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (!PHONE_REGEX.test(formData.phone)) {
      setError('Please enter a valid 10-digit mobile number.');
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

    if (!formData.organizationName.trim() || !finalCategory.trim()) {
      setError('Please fill out all required fields.');
      return false;
    }
    if (formData.whatsappNumber.trim().length !== 10) {
      setError('WhatsApp number must be exactly 10 digits.');
      return false;
    }
    // Pincode format sirf tab check hoga jab user ne kuch bhara ho
    if (formData.postalCode.trim() && formData.postalCode.length !== 6) {
      setError('Pincode must be exactly 6 digits.');
      return false;
    }
    if (
      formData.gstRegistrationType !== 'none' &&
      !formData.gstinNumber.trim()
    ) {
      setError('GSTIN is required for the selected GST registration type.');
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
    if (!formData.aadhaarNumber.trim() || formData.aadhaarNumber.trim().length !== 12) {
      setError('Aadhaar number is required and must be exactly 12 digits.');
      return false;
    }
    if (
      !formData.panNumber.trim() ||
      !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber.trim())
    ) {
      setError('A valid 10-character PAN is required.');
      return false;
    }
    if (formData.aadhaarDocUrls.length === 0) {
      setError('Please upload your Aadhaar document (front/back).');
      return false;
    }
    if (formData.panDocUrls.length === 0) {
      setError('Please upload your PAN card document.');
      return false;
    }
    return true;
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validateStep1()) return;

    setIsSubmitting(true);
    try {
      let user = auth.currentUser;

      if (!user || user.email !== formData.email) {
        try {
          const cred = await createUserWithEmailAndPassword(
            auth,
            formData.email,
            formData.password
          );
          user = cred.user;
        } catch (err: any) {
          if (err.code === 'auth/email-already-in-use') {
            const cred = await signInWithEmailAndPassword(
              auth,
              formData.email,
              formData.password
            );
            user = cred.user;
          } else {
            throw err;
          }
        }
      }

      // wait for auth state to propagate before letting the user upload documents
      await new Promise<void>((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((u) => {
          if (u && u.uid === user!.uid) {
            unsubscribe();
            resolve();
          }
        });
      });

      setAuthUser(user);
      setStep(2);
    } catch (err: any) {
      console.error('Account creation error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please log in instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak — please use at least 6 characters.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('This email exists, but the password provided is incorrect.');
      } else {
        setError('Could not create your account. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishSetup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    if (!validateStep2()) return;

    if (!authUser) {
      setError('Session expired — please go back and continue from step 1.');
      return;
    }

    setIsSubmitting(true);
    setShowSmokeScreen(true); // 👈 click hote hi turant poora smoke screen overlay dikhao

    try {
      const finalCategory =
        formData.eventCategory === 'Other'
          ? formData.customEventCategory
          : formData.eventCategory;

      const token = await authUser.getIdToken(true);

      // Execute Cloud Function
      const { gstScheme, taxType } = mapGstRegistrationType(formData.gstRegistrationType);

      const createCompany = httpsCallable(functions, 'createCompany');
      const result = await createCompany({
        token,
        fullName: formData.fullName,
        organizationName: formData.organizationName,
        eventCategory: finalCategory,
        website: formData.website,
        whatsappNumber: formData.whatsappNumber,
        gstRegistrationType: formData.gstRegistrationType,
        gstinNumber: formData.gstinNumber.trim().toUpperCase(),
        address: {
          street: formData.streetAddress,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
        },
        aadhaarNumber: formData.aadhaarNumber.trim(),
        panNumber: formData.panNumber.trim().toUpperCase(),
        aadhaarDocUrls: formData.aadhaarDocUrls,
        panDocUrls: formData.panDocUrls,
      });

      const companyId = (result.data as { companyId?: string } | undefined)?.companyId;
      if (companyId) {
        const settingsRef = doc(db, 'companies', companyId, 'settings', 'general');
        await setDoc(
          settingsRef,
          {
            gstScheme,
            taxType,
            enableTax: gstScheme !== 'none',
          },
          { merge: true }
        );
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        navigate('/events');
      }, 2500);
    } catch (err: any) {
      console.error('Signup error:', err);
      setShowSmokeScreen(false);
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
    <>
      <SmokeScreenLoader isVisible={showSmokeScreen} />
      <div className="flex h-screen overflow-hidden bg-gray-200">
        <div className="hidden lg:block relative w-1/2 h-full overflow-hidden">
          <AuthHeroPanel
            className="w-full h-full"
            subtitle="Create your organizer account and start listing events in minutes."
          />
          <FloatingEventIcons iconClassName="text-white" />
        </div>

        {/* Right content */}
        <div className="flex flex-col h-screen overflow-hidden bg-white dark:bg-slate-900 w-full lg:w-1/2">
          <div className="shrink-0 bg-white dark:bg-slate-900 pt-4 pb-2 px-4 shadow-sm z-40 flex justify-center">
            <div className="w-full max-w-xs">
              <Stepper totalSteps={2} currentStep={step} onStepClick={handleStepClick} />
            </div>
          </div>

          <div className="grow px-4 pb-32 overflow-y-auto">
            <div className="mt-3 mb-3">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {step === 1 ? 'Create your account' : 'Organizer Details'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {step === 1
                  ? 'Start with the basics — we’ll get your event profile set up next.'
                  : 'Tell us about the events you plan so guests know who they’re booking with.'}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 py-4 w-full mx-auto">
              {error && (
                <div className="sticky top-0 z-50 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm text-center p-3 rounded-md font-medium shadow-sm mb-4">
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

                  <div className="flex flex-col gap-1">
                    <FloatingLabelInput
                      id="email"
                      type="email"
                      label="Email Address"
                      icon={<FiMail size={20} />}
                      value={formData.email}
                      onChange={(e) => {
                        const value = e.target.value;
                        handleChange('email', value);
                        setEmailError(
                          value.trim().length > 0 && !EMAIL_REGEX.test(value.trim())
                            ? 'Enter a valid email address.'
                            : null
                        );
                      }}
                      required
                    />
                    {emailError && (
                      <p className="text-red-500 text-[11px] font-bold mb-0">{emailError}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <FloatingLabelInput
                      id="phone"
                      label="Phone Number"
                      icon={<FiPhone size={20} />}
                      inputMode="numeric"
                      value={formData.phone}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        if (digits.length <= 10) handleChange('phone', digits);
                        setPhoneError(
                          digits.length === 10 && !PHONE_REGEX.test(digits)
                            ? 'Enter a valid 10-digit mobile number.'
                            : null
                        );
                      }}
                      required
                    />
                    {phoneError && (
                      <p className="text-red-500 text-[11px] font-bold mb-0">{phoneError}</p>
                    )}
                  </div>

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
                    label="Organization / Brand Name *"
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
                      label="Primary Event Category *"
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
                        label="Specify Category *"
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
                      label="WhatsApp Number *"
                      icon={<FiMessageCircle size={20} />}
                      inputMode="numeric"
                      value={formData.whatsappNumber}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        if (digits.length <= 10) handleChange('whatsappNumber', digits);
                      }}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FloatingLabelSelect
                      id="gstRegistrationType"
                      label="GST Registration Type *"
                      icon={<FiFileText size={20} />}
                      value={formData.gstRegistrationType}
                      onChange={(e) => {
                        const value = e.target.value;
                        handleChange('gstRegistrationType', value);
                        if (value === 'none') handleChange('gstinNumber', '');
                      }}
                      options={gstRegistrationOptions}
                      required
                    />
                    <FloatingLabelInput
                      id="gstinNumber"
                      label={formData.gstRegistrationType === 'none' ? 'GSTIN (not applicable)' : 'GSTIN *'}
                      icon={<FiFileText size={20} />}
                      value={formData.gstinNumber}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase();
                        if (value.length <= 15) handleChange('gstinNumber', value);
                      }}
                      maxLength={15}
                      placeholder=" "
                      required={formData.gstRegistrationType !== 'none'}
                      disabled={formData.gstRegistrationType === 'none'}
                      className={formData.gstRegistrationType === 'none' ? 'opacity-50 cursor-not-allowed' : ''}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <FloatingLabelInput
                        id="aadhaarNumber"
                        label="Aadhaar Number *"
                        icon={<FiCreditCard size={20} />}
                        inputMode="numeric"
                        value={formData.aadhaarNumber}
                        required
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '');
                          if (digits.length <= 12) handleChange('aadhaarNumber', digits);
                          setAadhaarError(
                            digits.length > 0 && digits.length < 12
                              ? 'Aadhaar number must be exactly 12 digits.'
                              : null
                          );
                        }}
                      />
                      {aadhaarError && (
                        <p className="text-red-500 text-[11px] font-bold mb-0">{aadhaarError}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <FloatingLabelInput
                        id="panNumber"
                        label="PAN Number *"
                        icon={<FiCreditCard size={20} />}
                        value={formData.panNumber}
                        maxLength={10}
                        required
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase();
                          if (/^[0-9A-Z]{0,10}$/.test(value)) handleChange('panNumber', value);
                          setPanError(
                            value.length > 0 && value.length < 10
                              ? 'PAN must be exactly 10 characters.'
                              : null
                          );
                        }}
                      />
                      {panError && <p className="text-red-500 text-[11px] font-bold mb-0">{panError}</p>}
                    </div>
                  </div>

                  {authUser && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <IdentityDocumentUpload
                        label="Aadhaar (Front / Back) *"
                        docType="aadhaar"
                        companyId={authUser.uid}
                        userId={authUser.uid}
                        existingUrls={formData.aadhaarDocUrls}
                        onUploaded={(urls) => handleChange('aadhaarDocUrls', urls as any)}
                      />
                      <IdentityDocumentUpload
                        label="PAN Card *"
                        docType="pan"
                        companyId={authUser.uid}
                        userId={authUser.uid}
                        existingUrls={formData.panDocUrls}
                        onUploaded={(urls) => handleChange('panDocUrls', urls as any)}
                      />
                    </div>
                  )}

                  <FloatingLabelInput
                    id="streetAddress"
                    label="Street Address / Venue Area (optional)"
                    icon={<FiMapPin size={20} />}
                    value={formData.streetAddress}
                    onChange={(e) => handleChange('streetAddress', e.target.value)}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FloatingLabelInput
                      id="city"
                      label="City (optional)"
                      icon={<FiMapPin size={20} />}
                      value={formData.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                    />
                    <FloatingLabelInput
                      id="postalCode"
                      label="Pincode (optional)"
                      icon={<PinIcon size={20} />}
                      inputMode="numeric"
                      value={formData.postalCode}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        if (digits.length <= 6) handleChange('postalCode', digits);
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FloatingLabelSelect
                      id="state"
                      label="State (optional)"
                      icon={<FiMap size={20} />}
                      value={formData.state}
                      onChange={(e) => handleChange('state', e.target.value)}
                      options={indianStates}
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
    </>
  );
};

export default Signup;