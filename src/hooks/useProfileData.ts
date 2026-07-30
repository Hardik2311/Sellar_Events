import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '../lib/firebase';

export interface ProfileData {
  name: string;
  email: string;
  phone: string;
  aadhaarNumber: string;
  organizationName: string;
  eventCategory: string;
  website: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  profilePicture: string;
  instagram: string;
  facebook: string;
  twitter: string;
  whatsappNumber: string;
  role: string;
}

export const useProfileData = (userId?: string, companyId?: string) => {
  const [profile, setProfile] = useState<Partial<ProfileData>>({});
  const [resolvedCompanyIdState, setResolvedCompanyIdState] = useState<string | undefined>(companyId);
  // NEW: explicit "have we finished at least one attempt" flag instead of
  // inferring completion from Object.keys(profile).length, which stayed
  // stuck at 0 forever if any early-return path fired.
  const [hasFetched, setHasFetched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfileData = useCallback(async () => {
    // userId now comes ONLY from the prop (which itself comes from
    // AuthContext's single onAuthStateChanged listener). No second
    // listener here, no auth.currentUser race.
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let targetCompanyId = companyId;

      // 1. Resolve true companyId with explicit error logging
      if (!targetCompanyId || targetCompanyId === userId) {
        try {
          const q = query(collection(db, 'companies'), where('ownerUID', '==', userId));
          const querySnap = await getDocs(q);

          if (!querySnap.empty) {
            targetCompanyId = querySnap.docs[0].id;
            console.log('✅ Successfully resolved Company ID:', targetCompanyId);
          } else {
            console.warn('⚠️ No company document found matching ownerUID:', userId);
          }
        } catch (e) {
          console.error('🚨 Firestore Query Blocked (Check Security Rules or Indexes for ownerUID):', e);
        }
      }

      const finalCompanyId = targetCompanyId || userId;
      setResolvedCompanyIdState(finalCompanyId);

      console.log(`🔍 Fetching separate database sources for Company: ${finalCompanyId}`);

      // 2. Define References
      const userDocRef = doc(db, 'companies', finalCompanyId, 'users', userId);
      const companyRootDocRef = doc(db, 'companies', finalCompanyId);
      const companyBusinessDocRef = doc(db, 'companies', finalCompanyId, 'business_info', 'profile');

      // 3. Fetch all documents concurrently and log individual failures
      const [userSnap, rootSnap, companySnap] = await Promise.all([
        getDoc(userDocRef).catch(e => { console.error('❌ Error reading user doc:', e); return null; }),
        getDoc(companyRootDocRef).catch(e => { console.error('❌ Error reading root doc:', e); return null; }),
        getDoc(companyBusinessDocRef).catch(e => { console.error('❌ Error reading business_info doc:', e); return null; })
      ]);

      const userData = userSnap?.exists() ? userSnap.data() : {};
      const rootCompanyData = rootSnap?.exists() ? rootSnap.data() : {};
      const companyData = companySnap?.exists() ? companySnap.data() : {};

      const companyAddress = companyData.address || {};

      // 4. Map the data based on your exact Firestore structure
      setProfile({
        name: userData.fullName || rootCompanyData.name || auth.currentUser?.displayName || '',
        email: userData.email || rootCompanyData.email || auth.currentUser?.email || '',
        phone: rootCompanyData.ownerPhoneNumber || userData.phone || '',
        aadhaarNumber: userData.aadhaarNumber || companyData.aadhaarNumber || '',
        profilePicture: userData.profilePictureUrl || auth.currentUser?.photoURL || '',
        instagram: userData.instagram || companyData.instagram || '',
        facebook: userData.facebook || companyData.facebook || '',
        twitter: userData.twitter || companyData.twitter || '',
        whatsappNumber: companyData.whatsappNumber || rootCompanyData.ownerPhoneNumber || '',
        role: userData.role || 'admin',
        organizationName: companyData.organizationName || rootCompanyData.name || '',
        eventCategory: companyData.eventCategory || '',
        website: companyData.website || '',
        streetAddress: companyAddress.street || '',
        city: companyAddress.city || '',
        state: companyAddress.state || '',
        postalCode: companyAddress.postalCode || '',
      });
    } catch (err) {
      console.error('Error in fetchProfileData:', err);
      setError('Failed to load profile information.');
    } finally {
      setLoading(false);
      setHasFetched(true); // ALWAYS mark complete, success or failure
    }
  }, [userId, companyId]);

  // Single effect, driven purely by the userId/companyId props that
  // ultimately come from AuthContext. No second onAuthStateChanged.
  useEffect(() => {
    if (userId) {
      fetchProfileData();
    } else {
      setLoading(false);
    }
  }, [fetchProfileData, userId]);

  const refetch = () => {
    fetchProfileData();
  };

  const saveData = async (data: Partial<ProfileData>) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User is not authenticated.');

    const effectiveUserId = userId || currentUser.uid;
    const effectiveCompanyId = resolvedCompanyIdState || companyId || effectiveUserId;

    const {
      organizationName,
      eventCategory,
      website,
      streetAddress,
      city,
      state,
      postalCode,
      role,
      ...userFields
    } = data;

    const userDocRef = doc(db, 'companies', effectiveCompanyId, 'users', effectiveUserId);
    const companyBusinessDocRef = doc(db, 'companies', effectiveCompanyId, 'business_info', 'profile');
    const companyRootDocRef = doc(db, 'companies', effectiveCompanyId);

    const promises: Promise<any>[] = [];

    if (userFields.name && currentUser.displayName !== userFields.name) {
      promises.push(updateProfile(currentUser, { displayName: userFields.name }));
    }

    const userUpdateData: Record<string, any> = {};
    if (userFields.name !== undefined) userUpdateData.fullName = userFields.name;
    if (userFields.phone !== undefined) {
      userUpdateData.phone = userFields.phone;
      userUpdateData.phoneNumber = userFields.phone;
    }
    if (userFields.aadhaarNumber !== undefined) userUpdateData.aadhaarNumber = userFields.aadhaarNumber;
    if (userFields.profilePicture !== undefined) userUpdateData.profilePictureUrl = userFields.profilePicture;
    if (userFields.instagram !== undefined) userUpdateData.instagram = userFields.instagram;
    if (userFields.facebook !== undefined) userUpdateData.facebook = userFields.facebook;
    if (userFields.twitter !== undefined) userUpdateData.twitter = userFields.twitter;
    if (userFields.whatsappNumber !== undefined) userUpdateData.whatsappNumber = userFields.whatsappNumber;

    if (Object.keys(userUpdateData).length > 0) {
      promises.push(setDoc(userDocRef, userUpdateData, { merge: true }));
    }

    const companyUpdateData: Record<string, any> = {
      ...(organizationName !== undefined && { organizationName, name: organizationName }),
      ...(eventCategory !== undefined && { eventCategory }),
      ...(website !== undefined && { website }),
      ...(userFields.whatsappNumber !== undefined && { whatsappNumber: userFields.whatsappNumber }),
      ...(userFields.phone !== undefined && { ownerPhoneNumber: userFields.phone }),
      updatedAt: serverTimestamp(),
    };

    const addressUpdate: Record<string, any> = {};
    if (streetAddress !== undefined) addressUpdate.street = streetAddress;
    if (city !== undefined) addressUpdate.city = city;
    if (state !== undefined) addressUpdate.state = state;
    if (postalCode !== undefined) addressUpdate.postalCode = postalCode;

    if (Object.keys(addressUpdate).length > 0) {
      companyUpdateData.address = addressUpdate;
    }

    promises.push(setDoc(companyBusinessDocRef, companyUpdateData, { merge: true }));

    const rootCompanyUpdate: Record<string, any> = {};
    if (organizationName !== undefined) rootCompanyUpdate.name = organizationName;
    if (userFields.phone !== undefined) rootCompanyUpdate.ownerPhoneNumber = userFields.phone;

    if (Object.keys(rootCompanyUpdate).length > 0) {
      promises.push(setDoc(companyRootDocRef, rootCompanyUpdate, { merge: true }));
    }

    await Promise.all(promises);
  };

  return { profile, loading, error, saveData, refetch, hasFetched };
};

export default useProfileData;