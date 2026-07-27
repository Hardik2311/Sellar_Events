import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '../lib/firebase';

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
  role: string;
}

export const useProfileData = (userId?: string, tenantId?: string) => {
  const [profile, setProfile] = useState<Partial<ProfileData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfileData = async () => {
    if (!userId || !tenantId) return;
    setLoading(true);
    try {
      const userDocRef = doc(db, 'tenants', tenantId, 'users', userId);
      const tenantDocRef = doc(db, 'tenants', tenantId);
      const [userDocSnap, tenantDocSnap] = await Promise.all([
        getDoc(userDocRef),
        getDoc(tenantDocRef),
      ]);
      const userData = userDocSnap.exists() ? userDocSnap.data() : {};
      const tenantData = tenantDocSnap.exists() ? tenantDocSnap.data() : {};

      setProfile({
        name: userData.fullName || '',
        email: userData.email || '',
        phone: userData.phone || '',
        aadhaarNumber: userData.aadhaarNumber || '',
        profilePicture: userData.profilePictureUrl || '',
        instagram: userData.instagram || '',
        facebook: userData.facebook || '',
        twitter: userData.twitter || '',
        whatsappNumber: userData.whatsappNumber || '',
        role: userData.role || '',
        organizationName: tenantData.organizationName || '',
        website: tenantData.website || '',
      });
    } catch (err) {
      console.error('Error fetching profile data:', err);
      setError('Failed to load profile information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId || !tenantId) {
      setLoading(false);
      return;
    }
    fetchProfileData();
  }, [userId, tenantId]);

  const refetch = () => {
    fetchProfileData();
  };

  const saveData = async (data: Partial<ProfileData>) => {
    if (!userId || !tenantId || !auth.currentUser) {
      throw new Error('User or tenant is not authenticated.');
    }

    const { organizationName, website, role, ...userFields } = data;
    const userDocRef = doc(db, 'tenants', tenantId, 'users', userId);
    const tenantDocRef = doc(db, 'tenants', tenantId);
    const promises: Promise<any>[] = [];

    
    if (userFields.name && auth.currentUser.displayName !== userFields.name) {
      promises.push(updateProfile(auth.currentUser, { displayName: userFields.name }));
    }

    
    const userUpdateData: Record<string, any> = {};
    if (userFields.name !== undefined) userUpdateData.fullName = userFields.name;
    if (userFields.phone !== undefined) userUpdateData.phone = userFields.phone;
    if (userFields.aadhaarNumber !== undefined) userUpdateData.aadhaarNumber = userFields.aadhaarNumber;
    if (userFields.profilePicture !== undefined) userUpdateData.profilePictureUrl = userFields.profilePicture;
    if (userFields.instagram !== undefined) userUpdateData.instagram = userFields.instagram;
    if (userFields.facebook !== undefined) userUpdateData.facebook = userFields.facebook;
    if (userFields.twitter !== undefined) userUpdateData.twitter = userFields.twitter;
    if (userFields.whatsappNumber !== undefined) userUpdateData.whatsappNumber = userFields.whatsappNumber;

    if (Object.keys(userUpdateData).length > 0) {
      promises.push(setDoc(userDocRef, userUpdateData, { merge: true }));
    }

   
    if (organizationName !== undefined || website !== undefined) {
      promises.push(setDoc(tenantDocRef, {
        ...(organizationName !== undefined && { organizationName }),
        ...(website !== undefined && { website }),
        updatedAt: serverTimestamp(),
      }, { merge: true }));
    }

    await Promise.all(promises);
  };

  return { profile, loading, error, saveData, refetch };
};