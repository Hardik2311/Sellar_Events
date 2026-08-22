import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FiCamera, FiCheck, FiX, FiArrowLeft, FiUser } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useProfileData } from '../hooks/useProfileData';
import { storage } from '../lib/firebase';
//import ThemeToggle from '../components/ui/ThemeToggle';
import IdentityDocumentUpload, { type DocFile } from '../components/IdentityUpload';
import ImageOptionsModal from '../components/ui/ImageOptionModal';
import { compressImage } from '../lib/identityCompression';

interface ProfileFormData {
    name: string;
    email: string;
    phone: string;
    aadhaarNumber: string;
    panNumber: string;
    organizationName: string;
    eventCategory: string;
    customEventCategory: string;
    website: string;
    gstinNumber: string;
    gstType: string;
    streetAddress: string;
    landmark: string;
    city: string;
    state: string;
    postalCode: string;
    profilePicture: string;
    aadhaarDocUrls: DocFile[];
    panDocUrls: DocFile[];
    instagram: string;
    facebook: string;
    twitter: string;
    whatsappNumber: string;
}

const emptyProfile: ProfileFormData = {
    name: '',
    email: '',
    phone: '',
    aadhaarNumber: '',
    panNumber: '',
    organizationName: '',
    eventCategory: '',
    customEventCategory: '',
    website: '',
    gstinNumber: '',
    gstType: 'none',
    streetAddress: '',
    landmark: '',
    city: '',
    state: '',
    postalCode: '',
    profilePicture: '',
    aadhaarDocUrls: [],
    panDocUrls: [],
    instagram: '',
    facebook: '',
    twitter: '',
    whatsappNumber: '',
};

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
];

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white dark:bg-[#1E293B] rounded-sm border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-200">
        <div className="px-5 py-3 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
            <span className="text-xs font-extrabold tracking-wider uppercase text-[#007A78] dark:text-[#2DD4BF]">{title}</span>
        </div>
        <div className="p-5">{children}</div>
    </div>
);

const inputClass =
    'w-full h-11 border border-slate-300 dark:border-slate-700 rounded-sm text-sm bg-white dark:bg-slate-900 outline-none ' +
    'transition-all px-3.5 py-2.5 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ' +
    'focus:border-[#007A78] dark:focus:border-[#2DD4BF] focus:ring-2 focus:ring-[#007A78]/20 dark:focus:ring-[#2DD4BF]/20 font-medium';

const selectClass = `${inputClass} appearance-none bg-no-repeat pr-9`;

const selectArrowStyle: React.CSSProperties = {
    backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.75rem center',
    backgroundSize: '16px',
};

const LabeledField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">{label}</label>
        {children}
    </div>
);

const EditProfile: React.FC = () => {
    const navigate = useNavigate();
    const { user, profile: authProfile, loading: authLoading } = useAuth();
    const { profile, loading: dataLoading, saveData, refetch } =
        useProfileData(user?.uid, authProfile?.companyId);

    const [formData, setFormData] = useState<ProfileFormData>(emptyProfile);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [photoRemoved, setPhotoRemoved] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showPhotoMenu, setShowPhotoMenu] = useState(false);

    // FIXED: Added loading checks and Object.keys check so it only maps real data
    useEffect(() => {
        if (!dataLoading && !authLoading && profile && Object.keys(profile).length > 0) {
            const rawCategory = profile.eventCategory || '';
            const isStandardCategory = eventCategoryOptions.some((opt) => opt.value === rawCategory);

            const loaded: ProfileFormData = {
                name: profile.name || authProfile?.fullName || user?.displayName || '',
                email: profile.email || authProfile?.email || user?.email || '',
                phone: profile.phone || authProfile?.phone || '',
                aadhaarNumber: profile.aadhaarNumber || authProfile?.aadhaarNumber || '',
                panNumber: profile.panNumber || authProfile?.panNumber || '',
                organizationName: profile.organizationName || authProfile?.organizationName || '',
                eventCategory: isStandardCategory ? rawCategory : rawCategory ? 'Other' : '',
                customEventCategory: isStandardCategory ? '' : rawCategory,
                website: profile.website || authProfile?.website || '',
                gstinNumber: profile.gstinNumber || authProfile?.gstinNumber || '',
                gstType: profile.gstType || authProfile?.gstType || 'none',
                streetAddress: profile.streetAddress || '',
                landmark: profile.landmark || '',
                city: profile.city || '',
                state: profile.state || '',
                postalCode: profile.postalCode || '',
                profilePicture: profile.profilePicture || authProfile?.profilePictureUrl || user?.photoURL || '',
                aadhaarDocUrls: profile.aadhaarDocUrls || authProfile?.aadhaarDocUrls || [],
                panDocUrls: profile.panDocUrls || authProfile?.panDocUrls || [],
                instagram: profile.instagram || authProfile?.instagram || '',
                facebook: profile.facebook || authProfile?.facebook || '',
                twitter: profile.twitter || authProfile?.twitter || '',
                whatsappNumber: profile.whatsappNumber || authProfile?.whatsappNumber || '',
            };

            setFormData(loaded);
            setPreviewUrl(loaded.profilePicture || null);
        }
    }, [profile, dataLoading, authLoading, user, authProfile]);

    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [aadhaarError, setAadhaarError] = useState<string | null>(null);
    const [postalCodeError, setPostalCodeError] = useState<string | null>(null);
    const [whatsappError, setWhatsappError] = useState<string | null>(null);
    const [gstinError, setGstinError] = useState<string | null>(null);
    const [panError, setPanError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (/^\d{0,10}$/.test(value)) {
            setFormData((prev) => ({ ...prev, phone: value }));
            setPhoneError(value.length > 0 && value.length < 10 ? 'Phone number must be exactly 10 digits.' : null);
        }
    };

    const handleAadhaarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (/^\d{0,12}$/.test(value)) {
            setFormData((prev) => ({ ...prev, aadhaarNumber: value }));
            setAadhaarError(value.length > 0 && value.length < 12 ? 'Aadhaar number must be exactly 12 digits.' : null);
        }
    };

    const handlePanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.toUpperCase();
        if (/^[0-9A-Z]{0,10}$/.test(value)) {
            setFormData((prev) => ({ ...prev, panNumber: value }));
            setPanError(value.length > 0 && value.length < 10 ? 'PAN must be exactly 10 characters.' : null);
        }
    };

    const handlePostalCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (/^\d{0,6}$/.test(value)) {
            setFormData((prev) => ({ ...prev, postalCode: value }));
            setPostalCodeError(value.length > 0 && value.length < 6 ? 'Pincode must be exactly 6 digits.' : null);
        }
    };

    const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (/^\d{0,10}$/.test(value)) {
            setFormData((prev) => ({ ...prev, whatsappNumber: value }));
            setWhatsappError(value.length > 0 && value.length < 10 ? 'WhatsApp number must be exactly 10 digits.' : null);
        }
    };

    const handleGstinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.toUpperCase();
        if (/^[0-9A-Z]{0,15}$/.test(value)) {
            setFormData((prev) => ({ ...prev, gstinNumber: value }));
            setGstinError(
                value.length > 0 && value.length < 15 ? 'GSTIN must be exactly 15 characters.' : null
            );
        }
    };
    const handleClearGstin = () => {
        setFormData((prev) => ({ ...prev, gstinNumber: '' }));
        setGstinError(null);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setPhotoRemoved(false);
        }
    };

    const handleRemovePhoto = () => {
        setPreviewUrl(null);
        setImageFile(null);
        setPhotoRemoved(true);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleMenuUpload = () => {
        fileInputRef.current?.click();
        setShowPhotoMenu(false);
    };

    const handleMenuRemove = () => {
        handleRemovePhoto();
        setShowPhotoMenu(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError(null);
        setSubmitSuccess(null);

        if (formData.phone && formData.phone.length !== 10) {
            setSubmitError('Phone number must be exactly 10 digits.');
            return;
        }

        if (formData.aadhaarNumber && formData.aadhaarNumber.length !== 12) {
            setSubmitError('Aadhaar number must be exactly 12 digits.');
            return;
        }

        if (formData.postalCode && formData.postalCode.length !== 6) {
            setSubmitError('Pincode must be exactly 6 digits.');
            return;
        }

        if (formData.whatsappNumber && formData.whatsappNumber.length !== 10) {
            setSubmitError('WhatsApp number must be exactly 10 digits.');
            return;
        }

        if (formData.gstType !== 'none' && !formData.gstinNumber.trim()) {
            setSubmitError('GSTIN is required for the selected GST registration type.');
            return;
        }

        if (
            formData.gstinNumber &&
            !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gstinNumber)
        ) {
            setSubmitError('Please enter a valid 15-character GSTIN.');
            return;
        }

        if (formData.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber)) {
            setSubmitError('Please enter a valid 10-character PAN.');
            return;
        }

        if (!user) {
            setSubmitError('User session not found. Please log in again.');
            return;
        }

        const effectiveCompanyId = authProfile?.companyId || user.uid;

        setIsSubmitting(true);
        try {
            let profilePictureUrl = formData.profilePicture;

            if (imageFile) {
                const compressedImage = await compressImage(imageFile, 300, 1024);
                const imageRef = ref(storage, `companies/${effectiveCompanyId}/users/${user.uid}/profile.jpg`);
                await uploadBytes(imageRef, compressedImage, { contentType: 'image/jpeg' });
                profilePictureUrl = await getDownloadURL(imageRef);
            } else if (photoRemoved) {
                profilePictureUrl = '';
            }

            const finalCategory =
                formData.eventCategory === 'Other'
                    ? formData.customEventCategory
                    : formData.eventCategory;

            await saveData({
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                aadhaarNumber: formData.aadhaarNumber,
                panNumber: formData.panNumber,
                organizationName: formData.organizationName,
                eventCategory: finalCategory,
                website: formData.website,
                gstinNumber: formData.gstinNumber,
                gstType: formData.gstType,
                streetAddress: formData.streetAddress,
                landmark: formData.landmark,
                city: formData.city,
                state: formData.state,
                postalCode: formData.postalCode,
                instagram: formData.instagram,
                facebook: formData.facebook,
                twitter: formData.twitter,
                whatsappNumber: formData.whatsappNumber,
                profilePicture: profilePictureUrl,
                aadhaarDocUrls: formData.aadhaarDocUrls,
                panDocUrls: formData.panDocUrls,
            });

            refetch();
            setFormData((prev) => ({ ...prev, profilePicture: profilePictureUrl }));
            setPhotoRemoved(false);
            setSubmitSuccess('Profile updated successfully!');
            setTimeout(() => setSubmitSuccess(null), 3000);
        } catch (err) {
            console.error('Failed to save profile:', err);
            setSubmitError('Failed to save profile. Please check network connection and try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (authLoading || dataLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-[#0F172A]">
                <div className="w-10 h-10 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-[#007A78] dark:border-t-[#2DD4BF] animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-[#0F172A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-200 mb-16">
            {/* ── Page Header ── */}
            <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-4 py-3 shadow-xs">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
                        aria-label="Go back"
                    >
                        <FiArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">Edit Profile</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Update account, organizer & address details</p>
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 py-5 pb-36 md:pb-8">
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">

                    {/* ── Avatar banner ── */}
                    <div className="bg-white dark:bg-[#1E293B] rounded-sm border border-slate-200 dark:border-slate-800 shadow-sm px-5 py-4 flex items-center gap-6">
                        <div className="relative shrink-0">
                            <div onClick={() => setShowPhotoMenu(true)} className="relative cursor-pointer">
                                {previewUrl ? (
                                    <img
                                        src={previewUrl}
                                        alt="Profile"
                                        className="w-20 h-20 rounded-full object-cover border-2 border-[#007A78] dark:border-[#2DD4BF] shadow-md"
                                    />
                                ) : (
                                    <div className="w-20 h-20 rounded-full border-2 border-[#007A78] dark:border-[#2DD4BF] shadow-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        <FiUser size={32} className="text-slate-400 dark:text-slate-500" />
                                    </div>
                                )}
                                <div className="absolute bottom-0 right-0 p-2 rounded-full bg-[#007A78] dark:bg-[#2DD4BF] text-white dark:text-slate-950 shadow-md">
                                    <FiCamera size={12} />
                                </div>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png, image/jpeg, image/jpg"
                                className="hidden"
                                aria-label="Upload profile photo"
                                onChange={handleImageChange}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-sm font-extrabold text-slate-900 dark:text-white m-0">Profile Photo</p>
                            <button
                                type="button"
                                onClick={() => setShowPhotoMenu(true)}
                                className="text-xs font-bold text-[#007A78] dark:text-[#2DD4BF] hover:underline text-left w-fit"
                            >
                                {previewUrl ? 'Change Photo' : 'Add Photo'}
                            </button>
                        </div>
                    </div>

                    {showPhotoMenu && (
                        <ImageOptionsModal
                            title="Profile Photo"
                            hasImage={!!previewUrl}
                            onUpload={handleMenuUpload}
                            onRemove={handleMenuRemove}
                            onClose={() => setShowPhotoMenu(false)}
                        />
                    )}

                    {/* ── Personal Information + Organization Details ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <SectionCard title="Personal Information">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2">
                                    <LabeledField label="Full Name">
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            className={inputClass}
                                            placeholder="Full Name"
                                        />
                                    </LabeledField>
                                </div>

                                <div className="col-span-1 sm:col-span-2 grid grid-cols-2 gap-4">
                                    <LabeledField label="Phone Number">
                                        <input
                                            type="text"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handlePhoneChange}
                                            maxLength={10}
                                            inputMode="numeric"
                                            className={inputClass}
                                            placeholder="10-digit Phone Number"
                                        />
                                        {phoneError && <p className="text-red-500 text-[11px] font-bold mt-1 mb-0">{phoneError}</p>}
                                    </LabeledField>

                                    <LabeledField label="Email Address">
                                        <input
                                            type="email"
                                            value={formData.email}
                                            readOnly
                                            className={`${inputClass} bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed`}
                                        />
                                    </LabeledField>
                                </div>

                                <div className="col-span-1 sm:col-span-2 grid grid-cols-2 gap-4">
                                    <LabeledField label="Aadhar NUMBER">
                                        <input
                                            type="text"
                                            name="aadhaarNumber"
                                            value={formData.aadhaarNumber}
                                            onChange={handleAadhaarChange}
                                            maxLength={12}
                                            inputMode="numeric"
                                            className={inputClass}
                                            placeholder="12-digit Aadhaar Number"
                                        />
                                        {aadhaarError && <p className="text-red-500 text-[11px] font-bold mt-1 mb-0">{aadhaarError}</p>}
                                    </LabeledField>
                                    <LabeledField label="PAN Number">
                                        <input
                                            type="text"
                                            name="panNumber"
                                            value={formData.panNumber}
                                            onChange={handlePanChange}
                                            maxLength={10}
                                            className={`${inputClass} uppercase`}
                                            placeholder="10-character PAN"
                                        />
                                        {panError && <p className="text-red-500 text-[11px] font-bold mt-1 mb-0">{panError}</p>}
                                    </LabeledField>
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard title="Organization Details">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2">
                                    <LabeledField label="Organization Name">
                                        <input
                                            type="text"
                                            name="organizationName"
                                            value={formData.organizationName}
                                            onChange={handleInputChange}
                                            className={inputClass}
                                            placeholder="Organization Name"
                                        />
                                    </LabeledField>
                                </div>

                                <LabeledField label="Event Category">
                                    <select
                                        name="eventCategory"
                                        value={formData.eventCategory}
                                        onChange={handleInputChange}
                                        className={selectClass}
                                        style={selectArrowStyle}
                                    >
                                        <option value="">Select Primary Category</option>
                                        {eventCategoryOptions.map((cat) => (
                                            <option key={cat.value} value={cat.value}>
                                                {cat.label}
                                            </option>
                                        ))}
                                    </select>
                                </LabeledField>
                                <LabeledField label="Website">
                                    <input
                                        type="text"
                                        name="website"
                                        value={formData.website}
                                        onChange={handleInputChange}
                                        className={inputClass}
                                        placeholder="https://yourwebsite.com"
                                    />
                                </LabeledField>

                                {formData.eventCategory === 'Other' && (
                                    <div className="sm:col-span-2">
                                        <LabeledField label="Specify Custom Category">
                                            <input
                                                type="text"
                                                name="customEventCategory"
                                                value={formData.customEventCategory}
                                                onChange={handleInputChange}
                                                className={inputClass}
                                                placeholder="Specify Category"
                                            />
                                        </LabeledField>
                                    </div>
                                )}

                                <LabeledField label="GST Type">
                                    <select
                                        name="gstType"
                                        value={formData.gstType}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setFormData((prev) => ({
                                                ...prev,
                                                gstType: value,
                                                gstinNumber: value === 'none' ? '' : prev.gstinNumber,
                                            }));
                                            if (value === 'none') setGstinError(null);
                                        }}
                                        className={selectClass}
                                        style={selectArrowStyle}
                                    >
                                        <option value="regular_inclusive">Regular (Tax Inclusive)</option>
                                        <option value="regular_exclusive">Regular (Tax Exclusive)</option>
                                        <option value="composition">Composite</option>
                                        <option value="none">Not Registered / NA</option>
                                    </select>
                                </LabeledField>
                                <LabeledField label={formData.gstType === 'none' ? 'GSTIN' : 'GSTIN'}>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="gstinNumber"
                                            value={formData.gstinNumber}
                                            onChange={handleGstinChange}
                                            maxLength={15}
                                            disabled={formData.gstType === 'none'}
                                            className={`${inputClass} uppercase pr-8 ${formData.gstType === 'none' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            placeholder="15-character GSTIN"
                                        />
                                        {formData.gstinNumber && (
                                            <button
                                                type="button"
                                                onClick={handleClearGstin}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                                                aria-label="Clear GSTIN"
                                            >
                                                <FiX size={14} />
                                            </button>
                                        )}
                                    </div>
                                    {gstinError && <p className="text-red-500 text-[11px] font-bold mt-1 mb-0">{gstinError}</p>}
                                </LabeledField>
                            </div>
                        </SectionCard>
                    </div>

                    {/* ── Address & Location + Social Media & Contact ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <SectionCard title="Address & Location">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2">
                                    <LabeledField label="Street Address">
                                        <input
                                            type="text"
                                            name="streetAddress"
                                            value={formData.streetAddress}
                                            onChange={handleInputChange}
                                            className={inputClass}
                                            placeholder="Flat, House no., Building, Street address"
                                        />
                                    </LabeledField>
                                </div>

                                <LabeledField label="Landmark">
                                    <input
                                        type="text"
                                        name="landmark"
                                        value={formData.landmark}
                                        onChange={handleInputChange}
                                        className={inputClass}
                                        placeholder="Nearby Landmark"
                                    />
                                </LabeledField>
                                <LabeledField label="City">
                                    <input
                                        type="text"
                                        name="city"
                                        value={formData.city}
                                        onChange={handleInputChange}
                                        className={inputClass}
                                        placeholder="City / Town"
                                    />
                                </LabeledField>

                                <div className="col-span-1 sm:col-span-2 grid grid-cols-2 gap-4">
                                    <LabeledField label="State">
                                        <select
                                            name="state"
                                            value={formData.state}
                                            onChange={handleInputChange}
                                            className={selectClass}
                                            style={selectArrowStyle}
                                        >
                                            <option value="">Select State</option>
                                            {indianStates.map((st) => (
                                                <option key={st} value={st}>
                                                    {st}
                                                </option>
                                            ))}
                                        </select>
                                    </LabeledField>
                                    <LabeledField label="Pincode">
                                        <input
                                            type="text"
                                            name="postalCode"
                                            value={formData.postalCode}
                                            onChange={handlePostalCodeChange}
                                            maxLength={6}
                                            inputMode="numeric"
                                            className={inputClass}
                                            placeholder="6-digit Pincode"
                                        />
                                        {postalCodeError && <p className="text-red-500 text-[11px] font-bold mt-1 mb-0">{postalCodeError}</p>}
                                    </LabeledField>
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard title="Social Media & Contact">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <LabeledField label="WhatsApp Number">
                                    <input
                                        type="text"
                                        name="whatsappNumber"
                                        value={formData.whatsappNumber}
                                        onChange={handleWhatsappChange}
                                        maxLength={10}
                                        inputMode="numeric"
                                        className={inputClass}
                                        placeholder="10-digit WhatsApp Number"
                                    />
                                    {whatsappError && <p className="text-red-500 text-[11px] font-bold mt-1 mb-0">{whatsappError}</p>}
                                </LabeledField>
                                <LabeledField label="Instagram">
                                    <input
                                        type="text"
                                        name="instagram"
                                        value={formData.instagram}
                                        onChange={handleInputChange}
                                        className={inputClass}
                                        placeholder="@yourhandle"
                                    />
                                </LabeledField>

                                <LabeledField label="Facebook">
                                    <input
                                        type="text"
                                        name="facebook"
                                        value={formData.facebook}
                                        onChange={handleInputChange}
                                        className={inputClass}
                                        placeholder="Facebook page/profile"
                                    />
                                </LabeledField>
                                <LabeledField label="Twitter / X">
                                    <input
                                        type="text"
                                        name="twitter"
                                        value={formData.twitter}
                                        onChange={handleInputChange}
                                        className={inputClass}
                                        placeholder="@yourhandle"
                                    />
                                </LabeledField>
                            </div>
                        </SectionCard>
                    </div>

                    {/* ── Identity Documents ── */}
                    {user && (
                        <SectionCard title="Identity Documents">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <IdentityDocumentUpload
                                    label="Aadhaar (Front / Back)"
                                    docType="aadhaar"
                                    companyId={authProfile?.companyId || user.uid}
                                    userId={user.uid}
                                    existingUrls={formData.aadhaarDocUrls}
                                    onUploaded={(urls) => setFormData((prev) => ({ ...prev, aadhaarDocUrls: urls }))}
                                />
                                <IdentityDocumentUpload
                                    label="PAN Card"
                                    docType="pan"
                                    companyId={authProfile?.companyId || user.uid}
                                    userId={user.uid}
                                    existingUrls={formData.panDocUrls}
                                    onUploaded={(urls) => setFormData((prev) => ({ ...prev, panDocUrls: urls }))}
                                />
                            </div>
                        </SectionCard>
                    )}

                    {/* ── Error banner ── */}
                    {submitError && (
                        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-sm px-4 py-3 flex items-center justify-between gap-2 shadow-xs">
                            <p className="text-red-600 dark:text-red-400 text-xs font-bold m-0">{submitError}</p>
                            <button type="button" onClick={() => setSubmitError(null)} className="text-red-500 shrink-0">
                                <FiX size={16} />
                            </button>
                        </div>
                    )}

                    {/* ── Submit button ── */}
                    <div className="sticky bottom-0 z-30 bg-transparent shadow-none md:mt-1">
                        <div className="max-w-6xl mx-auto px-4 py-3.5 md:px-0">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`w-full py-3.5 rounded-sm text-white dark:text-slate-950 text-sm font-extrabold flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50 ${submitSuccess
                                    ? 'bg-emerald-600 dark:bg-emerald-400'
                                    : 'bg-[#007A78] hover:bg-[#006361] dark:bg-[#2DD4BF] dark:hover:bg-[#22b8a5]'
                                    }`}
                            >
                                {isSubmitting ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                        <span>Saving Profile Changes…</span>
                                    </div>
                                ) : submitSuccess ? (
                                    <div className="flex items-center gap-2">
                                        <FiCheck size={18} />
                                        <span>{submitSuccess}</span>
                                    </div>
                                ) : (
                                    'Save Profile Changes'
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditProfile;