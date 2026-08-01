import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';

export interface EventFieldRequirements {
  title: boolean;
  description: boolean;
  date: boolean;
  endDate: boolean;
  time: boolean;
  venue: boolean;
  images: boolean;
}

export interface CompanySettings {
  rsvpEnabled: boolean;
  // Tax settings — applies company-wide to all ticket sales
  enableTax: boolean;
  gstScheme: 'regular' | 'composition' | 'none';
  taxType: 'inclusive' | 'exclusive';
  defaultTaxRate: number;
  enableRounding: boolean;
  roundingInterval: number;
  // Which Create Event fields organizers must fill before publishing
  eventFieldRequirements: EventFieldRequirements;
  // more settings go here later
}

const DEFAULT_FIELD_REQUIREMENTS: EventFieldRequirements = {
  title: true,
  description: false,
  date: true,
  endDate: true,
  time: true,
  venue: true,
  images: false,
};

const DEFAULT_SETTINGS: CompanySettings = {
  rsvpEnabled: false,
  enableTax: false,
  gstScheme: 'none',
  taxType: 'inclusive',
  defaultTaxRate: 0,
  enableRounding: false,
  roundingInterval: 1,
  eventFieldRequirements: DEFAULT_FIELD_REQUIREMENTS,
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
      if (snap.exists()) {
        const data = snap.data() as Partial<CompanySettings>;
        setSettings({
          ...DEFAULT_SETTINGS,
          ...data,
          eventFieldRequirements: {
            ...DEFAULT_FIELD_REQUIREMENTS,
            ...(data.eventFieldRequirements ?? {}),
          },
        });
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
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