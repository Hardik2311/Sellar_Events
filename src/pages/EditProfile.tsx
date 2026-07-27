import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FiCamera, FiCheck, FiX, FiArrowLeft } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useProfileData } from '../hooks/useProfileData';
import { storage } from '../lib/firebase';

interface ProfileData {
    name: string;
    email: string;
    phone: string;
    aadhaarNumber: string;
    organizationName: string;
    website: string;
    profilePicture: string;
    instagram: string;
    facebook: string;
    twitter: string;
    whatsappNumber: string;
}

const emptyProfile: ProfileData = {
    name: '',
    email: '',
    phone: '',
    aadhaarNumber: '',
    organizationName: '',
    website: '',
    profilePicture: '',
    instagram: '',
    facebook: '',
    twitter: '',
    whatsappNumber: '',
};

// ─── Small shared bits (mirrors the SectionCard / LabeledField pattern) ────
const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white rounded-sm border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-100">
            <span className="text-[11px] font-bold tracking-widest uppercase text-slate-500">{title}</span>
        </div>
        <div className="p-4">{children}</div>
    </div>
);

const inputClass =
    'w-full border border-slate-200 rounded-sm text-sm bg-slate-50 outline-none ' +
    'transition-all px-3 py-2 text-slate-800 focus:border-slate-400 focus:bg-white';

const LabeledField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
        {children}
    </div>
);

const EditProfile: React.FC = () => {
    const navigate = useNavigate();
    const { user, profile: authProfile, loading: authLoading } = useAuth();
    const { profile, loading: dataLoading, error: dataError, saveData, refetch } =
        useProfileData(user?.uid, authProfile?.tenantId);

    const [formData, setFormData] = useState<ProfileData>(emptyProfile);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Profile async load hota hai, isliye jab available ho tab form fill karo
    useEffect(() => {
        if (profile) {
            const loaded: ProfileData = {
                name: profile.name || '',
                email: profile.email || '',
                phone: profile.phone || '',
                aadhaarNumber: profile.aadhaarNumber || '',
                organizationName: profile.organizationName || '',
                website: profile.website || '',
                profilePicture: profile.profilePicture || '',
                instagram: profile.instagram || '',
                facebook: profile.facebook || '',
                twitter: profile.twitter || '',
                whatsappNumber: profile.whatsappNumber || '',
            };
            setFormData(loaded);
            setPreviewUrl(loaded.profilePicture || null);
        }
    }, [profile]);

    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [aadhaarError, setAadhaarError] = useState<string | null>(null);
    const [whatsappError, setWhatsappError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (/^\d{0,10}$/.test(value)) {
            setFormData((prev) => ({ ...prev, whatsappNumber: value }));
            setWhatsappError(value.length > 0 && value.length < 10 ? 'WhatsApp number must be exactly 10 digits.' : null);
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleRemovePhoto = () => {
        setPreviewUrl(null);
        setImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
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

        if (formData.whatsappNumber && formData.whatsappNumber.length !== 10) {
            setSubmitError('WhatsApp number must be exactly 10 digits.');
            return;
        }

        if (!user || !authProfile?.tenantId) {
            setSubmitError('User session not found. Please log in again.');
            return;
        }

        setIsSubmitting(true);
        try {
            let profilePictureUrl = formData.profilePicture;

            if (imageFile) {
                const imageRef = ref(storage, `tenants/${authProfile.tenantId}/users/${user.uid}/profile.jpg`);
                await uploadBytes(imageRef, imageFile);
                profilePictureUrl = await getDownloadURL(imageRef);
            }

            await saveData({
                ...formData,
                profilePicture: profilePictureUrl,
                ...(profile.role !== 'admin' && { organizationName: undefined, website: undefined }),
            });

            refetch();
            setSubmitSuccess('Profile updated successfully!');
            setTimeout(() => setSubmitSuccess(null), 2500);
        } catch (err) {
            console.error('Failed to save profile:', err);
            setSubmitError('Failed to save profile. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const submitBtnClass = submitSuccess
    ? 'bg-gradient-to-br from-green-400 to-green-600 shadow-green-200/60'
    : isSubmitting
        ? 'bg-orange-200'
        : 'bg-gradient-to-br from-orange-400 to-orange-600 shadow-orange-200/60';

    if (authLoading || dataLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-100">
                <div className="w-10 h-10 rounded-full border-[3px] border-slate-200 border-t-orange-500 animate-spin" />
            </div>
        );
    }

    if (dataError) {
        return (
            <div className="flex min-h-screen items-center justify-center text-red-500">
                {dataError}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100">
            <div className="max-w-3xl mx-auto px-4 py-3 pb-24">

                {/* ── Page Header ── */}
                <div className="flex items-center gap-3 mb-4">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-full hover:bg-slate-200 transition"
                        aria-label="Go back"
                    >
                        <FiArrowLeft className="w-5 h-5 text-slate-700" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-900 m-0">Edit Profile</h1>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                    {/* ── Avatar banner ── */}
                    <div className="bg-white rounded-sm border border-slate-100 shadow-sm px-5 py-4 flex items-center gap-6">
                        <div className="relative shrink-0">
                            {previewUrl ? (
                                <img
                                    src={previewUrl}
                                    alt="Profile"
                                    className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md shadow-sky-200"
                                />
                            ) : (
                                <div className="w-20 h-20 rounded-full border-2 border-white shadow-md shadow-sky-200 bg-gray-200 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-gray-400">
                                        <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-orange-500 border-2 border-white flex items-center justify-center text-white"
                                aria-label="Change photo"
                            >
                                <FiCamera size={10} />
                            </button>
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
                            <p className="text-sm font-semibold text-slate-700 m-0">Profile Photo</p>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-xs font-medium text-orange-600 hover:underline"
                                >
                                    {previewUrl ? 'Change Photo' : 'Add Photo'}
                                </button>
                                {previewUrl && (
                                    <button
                                        type="button"
                                        onClick={handleRemovePhoto}
                                        className="text-xs font-medium text-red-500 hover:underline"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Personal Information ── */}
                    <SectionCard title="Personal Information">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            <LabeledField label="Phone Number">
                                <input
                                    type="text"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handlePhoneChange}
                                    maxLength={10}
                                    inputMode="numeric"
                                    className={inputClass}
                                    placeholder="Phone Number"
                                />
                                {phoneError && <p className="text-red-500 text-[11px] mt-1 mb-0">{phoneError}</p>}
                            </LabeledField>
                            <LabeledField label="Email Address">
                                <input
                                    type="email"
                                    value={formData.email}
                                    readOnly
                                    className={`${inputClass} bg-slate-100 text-slate-400 cursor-not-allowed`}
                                />
                            </LabeledField>
                            <LabeledField label="Aadhaar Number">
                                <input
                                    type="text"
                                    name="aadhaarNumber"
                                    value={formData.aadhaarNumber}
                                    onChange={handleAadhaarChange}
                                    maxLength={12}
                                    inputMode="numeric"
                                    className={inputClass}
                                    placeholder="Aadhaar Number"
                                />
                                {aadhaarError && <p className="text-red-500 text-[11px] mt-1 mb-0">{aadhaarError}</p>}
                            </LabeledField>
                        </div>
                    </SectionCard>

                    {/* ── Organization Information ── */}
                    <SectionCard title="Organization Information">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            <LabeledField label="Website">
                                <input
                                    type="text"
                                    name="website"
                                    value={formData.website}
                                    onChange={handleInputChange}
                                    className={inputClass}
                                    placeholder="https://"
                                />
                            </LabeledField>
                        </div>
                    </SectionCard>

                    {/* ── Social Media ── */}
                    <SectionCard title="Social Media">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            <LabeledField label="WhatsApp Number">
                                <input
                                    type="text"
                                    name="whatsappNumber"
                                    value={formData.whatsappNumber}
                                    onChange={handleWhatsappChange}
                                    maxLength={10}
                                    inputMode="numeric"
                                    className={inputClass}
                                    placeholder="WhatsApp Number"
                                />
                                {whatsappError && <p className="text-red-500 text-[11px] mt-1 mb-0">{whatsappError}</p>}
                            </LabeledField>
                        </div>
                    </SectionCard>

                    {/* ── Error banner ── */}
                    {submitError && (
                        <div className="bg-red-50 border border-red-200 rounded-sm px-4 py-2.5 flex items-center gap-2">
                            <button type="button" onClick={() => setSubmitError(null)} className="text-red-500 shrink-0">
                                <FiX size={14} />
                            </button>
                            <p className="text-red-500 text-sm m-0">{submitError}</p>
                        </div>
                    )}

                    {/* ── Submit button ── */}
                    <div className="sticky bottom-0 left-0 right-0 sm:static bg-slate-100 sm:bg-transparent pt-2 sm:pt-0 -mx-4 sm:mx-0 px-4 sm:px-0 pb-2 sm:pb-0 z-10">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={[
                                'w-full py-4 rounded-sm text-white text-[15px] font-semibold border-0',
                                'flex items-center justify-center gap-2 shadow-lg transition-all duration-300',
                                isSubmitting ? 'cursor-not-allowed' : 'cursor-pointer',
                                submitBtnClass,
                            ].join(' ')}
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 rounded-sm border-2 border-white/40 border-t-white animate-spin" />
                                    Saving…
                                </>
                            ) : submitSuccess ? (
                                <>
                                    <FiCheck size={18} />
                                    {submitSuccess}
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditProfile;