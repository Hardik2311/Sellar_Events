import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { normalizeDocFiles, type DocFile } from '../components/IdentityUpload';
import { logDebug } from '../lib/debugLog';

export interface UserProfile {
  fullName: string;
  email: string;
  role: string;
  companyId: string;
  phone?: string;
  aadhaarNumber?: string;
  panNumber?: string;
  gstinNumber?: string;
  gstType?: string;
  aadhaarDocUrls?: DocFile[];
  panDocUrls?: DocFile[];
  instagram?: string;
  facebook?: string;
  twitter?: string;
  whatsappNumber?: string;
  profilePictureUrl?: string;
  organizationName?: string;
  website?: string;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// PAN + Aadhaar (number and at least one uploaded doc each) are required
// before an organizer can create/publish events — collected at signup, but
// this also catches accounts that predate that requirement or never
// finished it, gating them until they fill it in via Edit Profile.
export const isProfileComplete = (profile: UserProfile | null): boolean =>
  !!(
    profile &&
    profile.aadhaarNumber?.trim() &&
    profile.panNumber?.trim() &&
    (profile.aadhaarDocUrls?.length ?? 0) > 0 &&
    (profile.panDocUrls?.length ?? 0) > 0
  );

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Guards against overlapping loadProfile() calls racing each other — e.g.
  // onAuthStateChanged firing again (token refresh, a login right after a
  // logout) while a SLOWER earlier call (still in its 1200ms companyId
  // retry loop) is still in flight. Without this, the older call can
  // resolve AFTER the newer one and silently overwrite the correct profile
  // with stale data — no error, just the UI quietly reverting to wrong
  // state. Only the invocation matching the current generation is allowed
  // to commit its result.
  const generationRef = useRef(0);

  const loadProfile = async (firebaseUser: User | null, myGeneration: number, retryCount = 0) => {
    if (!firebaseUser) {
      if (myGeneration === generationRef.current) setProfile(null);
      return;
    }

    let companyId: string | undefined = undefined;
    try {
      // No forced refresh — `true` reissues the ID token over the network
      // on every single auth resolution even when the cached one is still
      // valid, adding a full round-trip to every load for no benefit here.
      // Custom-claim changes (e.g. a fresh signup's companyId claim) are
      // refreshed explicitly elsewhere (SignUp.tsx calls getIdToken(true)
      // itself right after creating the company).
      const tokenResult = await firebaseUser.getIdTokenResult();
      companyId = tokenResult.claims.companyId as string | undefined;
    } catch (e) {
      console.warn('Could not read id token claims:', e);
    }

    if (!companyId) {
      try {
        const q = query(collection(db, 'companies'), where('ownerUID', '==', firebaseUser.uid));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          companyId = querySnap.docs[0].id;
        }
      } catch (e) {
        console.warn('Could not query company by ownerUID in AuthContext:', e);
      }
    }

    if (myGeneration !== generationRef.current) return; // superseded while awaiting above

    if (!companyId) {
      // Claim propagation ya ownerUID query dono transient ho sakte hain
      // (fresh signup / newly created company). Turant permanent fallback
      // set karne se pehle 2 baar thoda ruk ke retry karo.
      if (retryCount < 2) {
        await new Promise((res) => setTimeout(res, 1200));
        return loadProfile(firebaseUser, myGeneration, retryCount + 1);
      }
      // Retries ke baad bhi company nahi mili — ab genuinely "no company yet".
      if (myGeneration === generationRef.current) {
        setProfile({
          fullName: firebaseUser.displayName || 'Organizer User',
          email: firebaseUser.email || '',
          role: 'admin',
          companyId: '',
        });
      }
      return;
    }

    try {
      const userDocRef = doc(db, 'companies', companyId, 'users', firebaseUser.uid);
      const companyDocRef = doc(db, 'companies', companyId, 'business_info', 'profile');
      const companyRootRef = doc(db, 'companies', companyId);

      const [userSnap, companySnap, rootSnap] = await Promise.all([
        getDoc(userDocRef).catch(() => null),
        getDoc(companyDocRef).catch(() => null),
        getDoc(companyRootRef).catch(() => null),
      ]);

      if (myGeneration !== generationRef.current) return; // superseded while awaiting above

      const userData = userSnap && userSnap.exists() ? userSnap.data() : {};
      const companyData = companySnap && companySnap.exists() ? companySnap.data() : {};
      const rootData = rootSnap && rootSnap.exists() ? rootSnap.data() : {};
      const mergedCompany = { ...rootData, ...companyData };
      const role = userData.role || mergedCompany.role || 'admin';
      const isOwnerRole = role === 'admin';

      // Identity (PAN/Aadhaar) and social/contact details are personal to
      // each user — a team member must complete their OWN KYC and enter
      // their OWN social handles, not silently inherit the owner's, or the
      // isProfileComplete() gate below would consider them "done" just
      // because the owner happened to be. Only the owner (whose identity
      // legitimately IS the business's, for back-compat with data saved
      // before per-user storage existed) still falls back to company data.
      setProfile({
        fullName: userData.fullName || userData.name || mergedCompany.fullName || firebaseUser.displayName || 'Organizer User',
        email: userData.email || mergedCompany.email || firebaseUser.email || '',
        role,
        companyId,
        phone: userData.phone || rootData.ownerPhoneNumber || mergedCompany.phone,
        aadhaarNumber: userData.aadhaarNumber || (isOwnerRole ? mergedCompany.aadhaarNumber : undefined),
        panNumber: userData.panNumber || (isOwnerRole ? mergedCompany.panNumber : undefined),
        gstinNumber: userData.gstinNumber || mergedCompany.gstinNumber,
        gstType: userData.gstType || mergedCompany.gstType,
        aadhaarDocUrls: normalizeDocFiles(userData.aadhaarDocUrls),
        panDocUrls: normalizeDocFiles(userData.panDocUrls),
        instagram: userData.instagram || (isOwnerRole ? mergedCompany.instagram : undefined),
        facebook: userData.facebook || (isOwnerRole ? mergedCompany.facebook : undefined),
        twitter: userData.twitter || (isOwnerRole ? mergedCompany.twitter : undefined),
        whatsappNumber: userData.whatsappNumber || (isOwnerRole ? (mergedCompany.whatsappNumber || rootData.ownerPhoneNumber) : undefined),
        profilePictureUrl: userData.profilePictureUrl || userData.profilePicture || mergedCompany.profilePictureUrl || firebaseUser.photoURL || undefined,
        organizationName: mergedCompany.organizationName || rootData.name || userData.organizationName,
        website: mergedCompany.website || userData.website,
      });
    } catch (e) {
      console.warn('Error reading user document:', e);
      if (myGeneration === generationRef.current) {
        setProfile({
          fullName: firebaseUser.displayName || 'Organizer User',
          email: firebaseUser.email || '',
          role: 'admin',
          companyId,
        });
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const myGeneration = ++generationRef.current;
      logDebug('auth:stateChanged', { hasUser: !!firebaseUser, generation: myGeneration });
      setUser(firebaseUser);
      await loadProfile(firebaseUser, myGeneration);
      if (myGeneration === generationRef.current) {
        setLoading(false);
        logDebug('auth:loadingResolved', { generation: myGeneration });
      }
    });

    return () => unsubscribe();
  }, []);

  const refreshProfile = async () => {
    const myGeneration = ++generationRef.current;
    await loadProfile(auth.currentUser, myGeneration);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};