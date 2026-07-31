import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';

export interface CompanySettings {
  rsvpEnabled: boolean;
  // more settings go here later
}

const DEFAULT_SETTINGS: CompanySettings = {
  rsvpEnabled: false,
};

export function useCompanySettings() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.companyId) {
      setLoading(false);
      return;
    }
    const settingsRef = doc(db, 'companies', profile.companyId, 'settings', 'general');
    const unsubscribe = onSnapshot(settingsRef, (snap) => {
      setSettings(snap.exists() ? { ...DEFAULT_SETTINGS, ...(snap.data() as CompanySettings) } : DEFAULT_SETTINGS);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [profile?.companyId]);

  const updateSetting = useCallback(
    async <K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) => {
      if (!profile?.companyId) return;
      const settingsRef = doc(db, 'companies', profile.companyId, 'settings', 'general');
      await setDoc(settingsRef, { [key]: value }, { merge: true });
    },
    [profile?.companyId]
  );

  return { settings, loading, updateSetting };
}