import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Loader2, CheckCircle, AlertCircle, X, Copy, Check } from 'lucide-react';

interface EventSubdomainModalProps {
  companyId: string;
  forceOpen?: boolean;
  onClose?: () => void;
}

export default function EventSubdomainModal({ companyId, forceOpen, onClose }: EventSubdomainModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [prefix, setPrefix] = useState('');
  const suffix = 'events'; // fixed — all links are -events
  const [subdomain, setSubdomain] = useState('');

  const [existingSubdomain, setExistingSubdomain] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [availability, setAvailability] = useState<'idle' | 'available' | 'taken'>('idle');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const checkExistingSubdomain = async () => {
      if (!companyId) return;
      try {
        const docRef = doc(db, 'companies', companyId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.subdomain) {
            setExistingSubdomain(data.subdomain);
            if (data.subdomain.endsWith('-events')) {
              setPrefix(data.subdomain.replace('-events', ''));
            } else {
              setPrefix(data.subdomain);
            }
          }

          if (forceOpen || (!data.subdomain && !sessionStorage.getItem('eventSubdomainDismissed'))) {
            setIsVisible(true);
          }
        }
      } catch (error) {
        console.error('Error fetching subdomain:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingSubdomain();
  }, [companyId, forceOpen]);

  useEffect(() => {
    if (!prefix) {
      setSubdomain('');
      setAvailability('idle');
      return;
    }
    const formattedPrefix = prefix.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/-$/, '');
    const combined = `${formattedPrefix}-${suffix}`;
    setSubdomain(combined);

    if (combined === existingSubdomain) {
      setAvailability('available');
    } else {
      setAvailability('idle');
    }
  }, [prefix, existingSubdomain]);

  useEffect(() => {
    const checkAvailability = async () => {
      if (!subdomain || subdomain.length < 3 || subdomain === existingSubdomain) return;

      setIsChecking(true);
      try {
        const companiesRef = collection(db, 'companies');
        const q = query(companiesRef, where('domainAliases', 'array-contains', subdomain));
        const querySnapshot = await getDocs(q);
        setAvailability(querySnapshot.empty ? 'available' : 'taken');
      } catch (error) {
        console.error('Error checking subdomain:', error);
      } finally {
        setIsChecking(false);
      }
    };

    const timeoutId = setTimeout(() => {
      if (subdomain.length >= 3 && subdomain !== existingSubdomain) {
        checkAvailability();
      }
    }, 600);

    return () => clearTimeout(timeoutId);
  }, [subdomain, existingSubdomain]);

  const handleClaimSubdomain = async () => {
    if (availability !== 'available' || !companyId) return;

    setIsSaving(true);
    try {
      const companyDocRef = doc(db, 'companies', companyId);
      const docSnap = await getDoc(companyDocRef);
      let updatedAliases = [subdomain];

      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentAliases = data.domainAliases || [];
        updatedAliases = currentAliases.filter((alias: string) => alias !== existingSubdomain);
        if (!updatedAliases.includes(subdomain)) {
          updatedAliases.push(subdomain);
        }
      }

      await updateDoc(companyDocRef, {
        subdomain,
        domainAliases: updatedAliases,
      });

      closeModal();
    } catch (error) {
      console.error('Error saving subdomain:', error);
      alert('Failed to update link. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const closeModal = () => {
    sessionStorage.setItem('eventSubdomainDismissed', 'true');
    setIsVisible(false);
    if (onClose) onClose();
  };

  if (isLoading || !isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-md shadow-2xl max-w-md w-full p-6 md:p-8 animate-in zoom-in duration-300 relative">
        <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors p-1">
          <X size={20} />
        </button>

        <div className="text-center mb-6 mt-2">
          <div className="w-16 h-16 bg-[#007A78]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔗</span>
          </div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
            {existingSubdomain ? 'Update Store Link' : 'Claim Link'}
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            This is the unique link you&apos;ll share with attendees for your events.
          </p>
          {existingSubdomain && (
            <div className="flex items-center justify-between bg-gray-100 border border-gray-200 rounded-md px-3 py-2 mt-4">
              <span className="text-xs font-bold text-gray-600 truncate">
                https://{existingSubdomain}.sellar.in
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`https://${existingSubdomain}.sellar.in`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="ml-2 p-1 text-gray-500 hover:text-gray-800"
              >
                {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
              </button>
            </div>
          )}
        </div>

        <div className="mb-6">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
            Choose a Name
          </label>

          <div className="flex items-center justify-between w-full gap-1.5 sm:gap-2 mb-2">
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="my-brand"
              className="flex-1 min-w-0 p-2.5 sm:p-3 bg-white border border-gray-200 rounded-md text-[13px] sm:text-sm font-bold text-slate-800 outline-none focus:border-[#007A78] focus:ring-1 focus:ring-[#007A78] transition-all text-right shadow-sm"
              autoFocus
            />
            <span className="text-gray-400 font-bold text-base sm:text-lg select-none shrink-0">-events</span>
            <div className="bg-gray-100 px-2 sm:px-3 py-2.5 sm:py-3 border border-gray-200 rounded-md text-gray-500 font-bold text-[13px] sm:text-sm select-none shadow-sm shrink-0">
              .sellar.in
            </div>
          </div>

          <div className="h-6 mt-2 flex items-center justify-center text-xs font-bold">
            {subdomain.length > 0 && subdomain.length < 3 && (
              <span className="text-orange-500 flex items-center gap-1"><AlertCircle size={14} /> Name is too short</span>
            )}
            {isChecking && (
              <span className="text-blue-500 flex items-center gap-1"><Loader2 size={14} className="animate-spin" /> Checking availability...</span>
            )}
            {!isChecking && availability === 'available' && subdomain === existingSubdomain && (
              <span className="text-gray-500 flex items-center gap-1">This is your current link</span>
            )}
            {!isChecking && availability === 'available' && subdomain !== existingSubdomain && (
              <span className="text-green-600 flex items-center gap-1"><CheckCircle size={14} /> Available to claim!</span>
            )}
            {!isChecking && availability === 'taken' && (
              <span className="text-red-500 flex items-center gap-1"><AlertCircle size={14} /> Already taken</span>
            )}
          </div>
        </div>

        <button
          onClick={handleClaimSubdomain}
          disabled={availability !== 'available' || isSaving || subdomain === existingSubdomain}
          className={`w-full py-3.5 rounded-md font-black text-[12px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
            availability === 'available' && !isSaving && subdomain !== existingSubdomain
              ? 'bg-[#007A78] text-white shadow-lg active:scale-95'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
          {isSaving ? 'Updating...' : existingSubdomain ? 'Update Link' : 'Save Link'}
        </button>
      </div>
    </div>
  );
}