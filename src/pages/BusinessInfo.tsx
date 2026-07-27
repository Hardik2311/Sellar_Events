import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes.constants';
import {
  FloatingLabelInput,
  FloatingLabelSelect,
  CustomButton,
  Spinner,
  Stepper,
  AuthHeroPanel,
} from '../components/ui/AuthUIComponents';
import {
  FiTag,
  FiGlobe,
  FiMessageCircle,
  FiMapPin,
  FiMap,
  FiCheckCircle,
} from 'react-icons/fi';
import { Building2Icon, PinIcon } from 'lucide-react';
import { createOrganizerAccount } from '../lib/AuthOperations';
import { saveLeadProgress } from '../lib/Lead';

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

interface Step1State {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

const BusinessInfoPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const step1 = location.state as Step1State | undefined;

  const [organizationName, setOrganizationName] = useState('');
  const [eventCategory, setEventCategory] = useState('');
  const [customEventCategory, setCustomEventCategory] = useState('');
  const [website, setWebsite] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Guard: if someone lands here directly (refresh, shared link) without
  // having gone through Step 1, send them back — we need that data.
  if (!step1?.email || !step1?.password) {
    return <Navigate to={ROUTES.SIGNUP} replace />;
  }

  const validate = (): boolean => {
    const finalCategory = eventCategory === 'Other' ? customEventCategory : eventCategory;
    if (
      !organizationName.trim() ||
      !finalCategory.trim() ||
      !streetAddress.trim() ||
      !city.trim() ||
      !state.trim() ||
      !postalCode.trim()
    ) {
      setError('Please fill out all required fields.');
      return false;
    }
    if (postalCode.length !== 6) {
      setError('Pincode must be exactly 6 digits.');
      return false;
    }
    return true;
  };

  const handleFinishSetup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const finalCategory = eventCategory === 'Other' ? customEventCategory : eventCategory;

      await createOrganizerAccount({
        fullName: step1.fullName,
        email: step1.email,
        phone: step1.phone,
        password: step1.password,
        organizationName,
        eventCategory: finalCategory,
        website,
        whatsappNumber,
        address: { street: streetAddress, city, state, postalCode },
      });

      await saveLeadProgress(step1.email, {
        fullName: step1.fullName,
        phoneNumber: step1.phone,
        status: 'Completed',
        currentStep: 'Signup Complete',
      });

      localStorage.removeItem('sellar_events_onboarding_data');
      setSuccess(true);

      // AuthContext's onAuthStateChanged will pick up the now-signed-in
      // user + claims automatically; we just need to route them in.
      navigate(ROUTES.HOME, { replace: true });
    } catch (err: any) {
      console.error('Signup error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please log in instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak — please use at least 6 characters.');
      } else if (err.code === 'functions/already-exists') {
        setError('This account is already set up. Please log in instead.');
      } else {
        setError('Signup failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-200">
      <AuthHeroPanel
        className="hidden lg:flex w-1/2 h-full"
        subtitle="Tell us about your events so guests know who they're booking with."
      />

      <div className="flex flex-col h-screen overflow-hidden bg-white w-full lg:w-1/2">
        <div className="shrink-0 bg-white pt-4 pb-2 px-4 shadow-sm z-40 flex justify-center">
          <div className="w-full max-w-xs">
            <Stepper
              totalSteps={2}
              currentStep={2}
              onStepClick={(target) => target === 1 && navigate(ROUTES.SIGNUP)}
            />
          </div>
        </div>

        <div className="grow px-4 pb-32 overflow-y-auto">
          <div className="mt-3 mb-3">
            <h1 className="text-3xl font-bold">Organizer Details</h1>
            <p className="text-sm text-gray-500 mt-1">
              Tell us about the events you plan so guests know who they're booking with.
            </p>
          </div>

          <div className="bg-white py-4 w-full mx-auto">
            {error && (
              <div className="sticky top-0 z-50 bg-red-50 border border-red-200 text-red-600 text-sm text-center p-3 rounded-md font-medium shadow-sm mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleFinishSetup} className="flex flex-col space-y-4">
              <FloatingLabelInput
                id="organizationName"
                label="Organization / Brand Name"
                icon={<Building2Icon size={20} />}
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
              />

              <div
                className={`gap-4 ${eventCategory === 'Other' ? 'flex flex-col md:flex-row' : 'grid grid-cols-1'}`}
              >
                <FloatingLabelSelect
                  id="eventCategory"
                  label="Primary Event Category"
                  icon={<FiTag size={20} />}
                  value={eventCategory}
                  onChange={(e) => setEventCategory(e.target.value)}
                  options={eventCategoryOptions}
                  required
                  className={eventCategory === 'Other' ? 'md:w-1/2' : 'w-full'}
                />
                {eventCategory === 'Other' && (
                  <FloatingLabelInput
                    id="customEventCategory"
                    label="Specify Category"
                    icon={<FiTag size={20} />}
                    value={customEventCategory}
                    onChange={(e) => setCustomEventCategory(e.target.value)}
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
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
                <FloatingLabelInput
                  id="whatsappNumber"
                  label="WhatsApp Number"
                  icon={<FiMessageCircle size={20} />}
                  inputMode="numeric"
                  value={whatsappNumber}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    if (digits.length <= 10) setWhatsappNumber(digits);
                  }}
                />
              </div>

              <FloatingLabelInput
                id="streetAddress"
                label="Street Address / Venue Area"
                icon={<FiMapPin size={20} />}
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-4">
                <FloatingLabelInput
                  id="city"
                  label="City"
                  icon={<FiMapPin size={20} />}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                />
                <FloatingLabelInput
                  id="postalCode"
                  label="Pincode"
                  icon={<PinIcon size={20} />}
                  inputMode="numeric"
                  value={postalCode}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    if (digits.length <= 6) setPostalCode(digits);
                  }}
                  required
                />
              </div>

              <FloatingLabelSelect
                id="state"
                label="State"
                icon={<FiMap size={20} />}
                value={state}
                onChange={(e) => setState(e.target.value)}
                options={indianStates}
                required
              />
            </form>
          </div>
        </div>

        <div className="fixed lg:absolute bottom-0 left-0 lg:left-auto right-0 lg:w-1/2 p-2 h-[110px] bg-gray-100 border-t border-gray-200 z-50 shadow-lg">
          <div className="max-w-md mx-auto space-y-2">
            <CustomButton
              type="button"
              variant="filled"
              onClick={handleFinishSetup}
              disabled={submitting}
              className="w-full h-12 text-lg"
            >
              {submitting ? (
                <div className="flex items-center justify-center gap-2">
                  <Spinner />
                  <span>Setting up...</span>
                </div>
              ) : success ? (
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessInfoPage;