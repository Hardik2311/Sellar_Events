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
export interface TicketDisplaySettings {
  showTicketsRemaining: boolean;
  useDummyThreshold: boolean;
  // When ON: Create/Edit Event show End date + End time per tier, and the
  // customer-facing page auto-hides a tier once that window has passed.
  enableTierAvailabilityWindow: boolean;
}
// NEW
export interface PaymentSettings {
  allowManualQR: boolean; // org-level toggle — shows/hides the option on Create/Edit Event
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
  ticketDisplay: TicketDisplaySettings;
  // Which Create Event fields organizers must fill before publishing
  eventFieldRequirements: EventFieldRequirements;
  // When no event is manually marked Featured, auto-pick the soonest
  // upcoming event to lead with on Discover. OFF = show nothing instead.
  autoFeatureNearest: boolean;
  attendeeQuestionsEnabled: boolean;
  whatsappShareTemplate: string;
  organizationName: string;
 payments: PaymentSettings; // NEW
}

const DEFAULT_FIELD_REQUIREMENTS: EventFieldRequirements = {
  description: false,
  endDate: true,
  images: true,
};

const DEFAULT_TICKET_DISPLAY: TicketDisplaySettings = {
  showTicketsRemaining: true,
  useDummyThreshold: false,
  enableTierAvailabilityWindow: false,
};

// NEW
const DEFAULT_PAYMENTS: PaymentSettings = {
  allowManualQR: false,
};

const DEFAULT_SETTINGS: CompanySettings = {
  rsvpEnabled: false,
  enableTax: false,
  gstScheme: 'none',
  taxType: 'inclusive',
  defaultTaxRate: 0,
  enableRounding: false,
  roundingInterval: 1,
  ticketDisplay: DEFAULT_TICKET_DISPLAY,
  eventFieldRequirements: DEFAULT_FIELD_REQUIREMENTS,
  attendeeQuestionsEnabled: true,
  whatsappShareTemplate: 'Check out {{eventTitle}} on Sellar Events! {{link}}',
  autoFeatureNearest: true,
  organizationName: '',
  payments: DEFAULT_PAYMENTS, // NEW
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
    const companyRef = doc(db, 'companies', profile.companyId);

    let latestSettingsData: Partial<CompanySettings> = {};
    let latestOrgName = '';

    const applyMerged = () => {
  setSettings({
    ...DEFAULT_SETTINGS,
    ...latestSettingsData,
    organizationName: latestOrgName || DEFAULT_SETTINGS.organizationName,
    ticketDisplay: {
      ...DEFAULT_TICKET_DISPLAY,
      ...(latestSettingsData.ticketDisplay ?? {}),
    },
    eventFieldRequirements: {
      ...DEFAULT_FIELD_REQUIREMENTS,
      ...(latestSettingsData.eventFieldRequirements ?? {}),
    },
    // NEW
    payments: {
      ...DEFAULT_PAYMENTS,
      ...(latestSettingsData.payments ?? {}),
    },
  });
  setLoading(false);
};

    const unsubscribeSettings = onSnapshot(settingsRef, (snap) => {
      latestSettingsData = snap.exists() ? (snap.data() as Partial<CompanySettings>) : {};
      applyMerged();
    });

    const unsubscribeCompany = onSnapshot(companyRef, (snap) => {
      latestOrgName = snap.exists() ? (snap.data().name ?? '') : '';
      applyMerged();
    });

    return () => {
      unsubscribeSettings();
      unsubscribeCompany();
    };
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