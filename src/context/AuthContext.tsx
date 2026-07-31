import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface UserProfile {
  fullName: string;
  email: string;
  role: string;
  companyId: string;
  phone?: string;
  aadhaarNumber?: string;
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
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        let companyId: string | undefined = undefined;
        try {
          const tokenResult = await firebaseUser.getIdTokenResult(true);
          companyId = tokenResult.claims.companyId as string | undefined;
          console.log('[AuthContext] claims.companyId:', companyId); // ADD THIS
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

        const effectiveCompanyId = companyId || firebaseUser.uid;

        try {
          const userDocRef = doc(db, 'companies', effectiveCompanyId, 'users', firebaseUser.uid);
          const companyDocRef = doc(db, 'companies', effectiveCompanyId, 'business_info', 'profile');
          const companyRootRef = doc(db, 'companies', effectiveCompanyId);

          const [userSnap, companySnap, rootSnap] = await Promise.all([
            getDoc(userDocRef).catch(() => null),
            getDoc(companyDocRef).catch(() => null),
            getDoc(companyRootRef).catch(() => null),
          ]);

          const userData = userSnap && userSnap.exists() ? userSnap.data() : {};
          const companyData = companySnap && companySnap.exists() ? companySnap.data() : {};
          const rootData = rootSnap && rootSnap.exists() ? rootSnap.data() : {};

          const mergedCompany = { ...rootData, ...companyData };

          setProfile({
            fullName: userData.fullName || userData.name || mergedCompany.fullName || firebaseUser.displayName || 'Organizer User',
            email: userData.email || mergedCompany.email || firebaseUser.email || '',
            role: userData.role || mergedCompany.role || 'admin',
            companyId: effectiveCompanyId,
            phone: userData.phone || rootData.ownerPhoneNumber || mergedCompany.phone,
            aadhaarNumber: userData.aadhaarNumber || mergedCompany.aadhaarNumber,
            instagram: userData.instagram || mergedCompany.instagram,
            facebook: userData.facebook || mergedCompany.facebook,
            twitter: userData.twitter || mergedCompany.twitter,
            whatsappNumber: userData.whatsappNumber || mergedCompany.whatsappNumber || rootData.ownerPhoneNumber,
            profilePictureUrl: userData.profilePictureUrl || userData.profilePicture || mergedCompany.profilePictureUrl || firebaseUser.photoURL || undefined,
            organizationName: mergedCompany.organizationName || rootData.name || userData.organizationName,
            website: mergedCompany.website || userData.website,
          });
        } catch (e) {
          console.warn('Error reading user document:', e);
          setProfile({
            fullName: firebaseUser.displayName || 'Organizer User',
            email: firebaseUser.email || '',
            role: 'admin',
            companyId: effectiveCompanyId,
          });
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};