import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';

export interface EventFieldRequirements {
  // title, date, time, venue are always required — not configurable
  description: boolean;
  endDate: boolean;
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
  // When no event is manually marked Featured, auto-pick the soonest
  // upcoming event to lead with on Discover. OFF = show nothing instead.
  autoFeatureNearest: boolean;
  // more settings go here later
}

const DEFAULT_FIELD_REQUIREMENTS: EventFieldRequirements = {
  description: false,
  endDate: true,
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
  autoFeatureNearest: true, // preserves current behaviour by default
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