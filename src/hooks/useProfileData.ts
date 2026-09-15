import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { mapGstRegistrationType, reverseMapGstScheme } from '../lib/gstMapping';
import { normalizeDocFiles, type DocFile } from '../components/IdentityUpload';

export interface ProfileData {
  name: string;
  email: string;
  phone: string;
  aadhaarNumber: string;
  panNumber: string;
  organizationName: string;
  eventCategory: string;
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
      const companySettingsDocRef = doc(db, 'companies', finalCompanyId, 'settings', 'general');

      // 3. Fetch all documents concurrently and log individual failures
      const [userSnap, rootSnap, companySnap, settingsSnap] = await Promise.all([
        getDoc(userDocRef).catch(e => { console.error('❌ Error reading user doc:', e); return null; }),
        getDoc(companyRootDocRef).catch(e => { console.error('❌ Error reading root doc:', e); return null; }),
        getDoc(companyBusinessDocRef).catch(e => { console.error('❌ Error reading business_info doc:', e); return null; }),
        getDoc(companySettingsDocRef).catch(e => { console.error('❌ Error reading settings/general doc:', e); return null; })
      ]);

      const userData = userSnap?.exists() ? userSnap.data() : {};
      const rootCompanyData = rootSnap?.exists() ? rootSnap.data() : {};
      const companyData = companySnap?.exists() ? companySnap.data() : {};
      const settingsData = settingsSnap?.exists() ? settingsSnap.data() : {};

      const role = userData.role || 'admin';
      const isOwnerRole = role === 'admin';
      const companyAddress = companyData.address || {};
      const userAddress = userData.address || {};

      // Identity docs, address and social handles are personal to each
      // user — a team member must see (and complete) their OWN copy, not
      // the owner's shared business_info data. Only the owner still falls
      // back to business_info for these, for back-compat with data saved
      // before per-user storage existed.
      setProfile({
        name: userData.fullName || rootCompanyData.name || auth.currentUser?.displayName || '',
        email: userData.email || rootCompanyData.email || auth.currentUser?.email || '',
        phone: rootCompanyData.ownerPhoneNumber || userData.phone || '',
        aadhaarNumber: userData.aadhaarNumber || (isOwnerRole ? companyData.aadhaarNumber : '') || '',
        panNumber: userData.panNumber || (isOwnerRole ? companyData.panNumber : '') || '',
        profilePicture: userData.profilePictureUrl || auth.currentUser?.photoURL || '',
        aadhaarDocUrls: normalizeDocFiles(userData.aadhaarDocUrls),
        panDocUrls: normalizeDocFiles(userData.panDocUrls),
        instagram: userData.instagram || (isOwnerRole ? companyData.instagram : '') || '',
        facebook: userData.facebook || (isOwnerRole ? companyData.facebook : '') || '',
        twitter: userData.twitter || (isOwnerRole ? companyData.twitter : '') || '',
        whatsappNumber: userData.whatsappNumber || (isOwnerRole ? (companyData.whatsappNumber || rootCompanyData.ownerPhoneNumber) : '') || '',
        role,
        organizationName: companyData.organizationName || rootCompanyData.name || '',
        eventCategory: companyData.eventCategory || '',
        website: companyData.website || '',
        gstinNumber: companyData.gstinNumber || '',
// settings/general is the single source of truth for GST scheme — both
// EditProfile and the Company Settings page write here, so always derive
// gstType from it. business_info/profile.gstType is legacy/unused for reads
// now, since it goes stale whenever the scheme is changed from the other page.
gstType: reverseMapGstScheme(settingsData.gstScheme, settingsData.taxType),
        streetAddress: (isOwnerRole ? (userAddress.street || companyAddress.street) : userAddress.street) || '',
        landmark: (isOwnerRole ? (userAddress.landmark || companyAddress.landmark) : userAddress.landmark) || '',
        city: (isOwnerRole ? (userAddress.city || companyAddress.city) : userAddress.city) || '',
        state: (isOwnerRole ? (userAddress.state || companyAddress.state) : userAddress.state) || '',
        postalCode: (isOwnerRole ? (userAddress.postalCode || companyAddress.postalCode) : userAddress.postalCode) || '',
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
    // Org-level fields (name/category/website/GST) are shared and owner-only
    // to edit — enforced client-side (EditProfile disables the inputs) and
    // again here as the actual data-integrity boundary. Everything else
    // (PAN/Aadhaar, address, social handles) is personal to this user and
    // always goes only to their own user doc, never the shared company doc.
    const isOwnerRole = profile.role === 'admin';

    const {
      organizationName,
      eventCategory,
      website,
      gstinNumber,
      gstType,
      panNumber,
      streetAddress,
      landmark,
      city,
      state,
      postalCode,
      role,
      ...userFields
    } = data;

    const userDocRef = doc(db, 'companies', effectiveCompanyId, 'users', effectiveUserId);
    const companyBusinessDocRef = doc(db, 'companies', effectiveCompanyId, 'business_info', 'profile');
    const companyRootDocRef = doc(db, 'companies', effectiveCompanyId);
    const companySettingsDocRef = doc(db, 'companies', effectiveCompanyId, 'settings', 'general');

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
    if (panNumber !== undefined) userUpdateData.panNumber = panNumber;
    if (userFields.profilePicture !== undefined) userUpdateData.profilePictureUrl = userFields.profilePicture;
    if (userFields.aadhaarDocUrls !== undefined) userUpdateData.aadhaarDocUrls = userFields.aadhaarDocUrls;
    if (userFields.panDocUrls !== undefined) userUpdateData.panDocUrls = userFields.panDocUrls;
    if (userFields.instagram !== undefined) userUpdateData.instagram = userFields.instagram;
    if (userFields.facebook !== undefined) userUpdateData.facebook = userFields.facebook;
    if (userFields.twitter !== undefined) userUpdateData.twitter = userFields.twitter;
    if (userFields.whatsappNumber !== undefined) userUpdateData.whatsappNumber = userFields.whatsappNumber;

    const userAddressUpdate: Record<string, any> = {};
    if (streetAddress !== undefined) userAddressUpdate.street = streetAddress;
    if (landmark !== undefined) userAddressUpdate.landmark = landmark;
    if (city !== undefined) userAddressUpdate.city = city;
    if (state !== undefined) userAddressUpdate.state = state;
    if (postalCode !== undefined) userAddressUpdate.postalCode = postalCode;
    if (Object.keys(userAddressUpdate).length > 0) userUpdateData.address = userAddressUpdate;

    if (Object.keys(userUpdateData).length > 0) {
      promises.push(setDoc(userDocRef, userUpdateData, { merge: true }));
    }

    // Everything below writes to the shared company docs — owner only.
    if (!isOwnerRole) {
      await Promise.all(promises);
      return;
    }

        const companyUpdateData: Record<string, any> = {
      ...(organizationName !== undefined && { organizationName, name: organizationName }),
      ...(eventCategory !== undefined && { eventCategory }),
      ...(website !== undefined && { website }),
      ...(gstinNumber !== undefined && { gstinNumber }),
      ...(panNumber !== undefined && { panNumber }),
      ...(userFields.whatsappNumber !== undefined && { whatsappNumber: userFields.whatsappNumber }),
      // NEW — mirror social handles into business_info/profile too, since
      // customer-facing pages (useCompanySettings) read only from here,
      // not from the user doc where these were previously saved alone
      ...(userFields.instagram !== undefined && { instagram: userFields.instagram }),
      ...(userFields.facebook !== undefined && { facebook: userFields.facebook }),
      ...(userFields.twitter !== undefined && { twitter: userFields.twitter }),
      ...(userFields.phone !== undefined && { ownerPhoneNumber: userFields.phone }),
      updatedAt: serverTimestamp(),
    };

    const addressUpdate: Record<string, any> = {};
    if (streetAddress !== undefined) addressUpdate.street = streetAddress;
    if (landmark !== undefined) addressUpdate.landmark = landmark;
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

    if (gstType !== undefined) {
      const { gstScheme, taxType } = mapGstRegistrationType(gstType);
      promises.push(
        setDoc(
          companySettingsDocRef,
          { gstScheme, taxType, enableTax: gstScheme !== 'none' },
          { merge: true }
        )
      );
    }

    await Promise.all(promises);
  };

  return { profile, loading, error, saveData, refetch, hasFetched };
};

export default useProfileData;