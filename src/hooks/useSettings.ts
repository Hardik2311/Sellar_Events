import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { getStorefrontSeed } from '../lib/storefrontData';

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
  // Set when the owner saves a payout bank account (payoutAccounts/{companyId},
  // owner-only). Lets team members' Create/Edit Event know the gateway can be used.
  payoutAccountReady?: boolean;
}

// Storefront footer details and the organizer's own policies, edited in
// Settings → Storefront & policies. Empty policy text = show the template.
export interface StorefrontSettings {
  bio: string;
  contactEmail: string;
  policies: {
    refund: string;
    terms: string;
    privacy: string;
  };
  policiesUpdatedAt?: string; // ISO date of the last policy save
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
  subdomain?: string;
  domainAliases?: string[];
  // NEW — organizer's public contact/social links, sourced from business_info/profile
  website?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  whatsappNumber?: string;
  gstinNumber?: string;
  // Store-front hero banner set from Edit Profile (business_info/profile.brandCoverUrl)
  brandCoverUrl?: string;
  storefront: StorefrontSettings;
}

const DEFAULT_FIELD_REQUIREMENTS: EventFieldRequirements = {
  description: false,
  endDate: true,
  images: true,
};

const DEFAULT_TICKET_DISPLAY: TicketDisplaySettings = {
  showTicketsRemaining: true,
  useDummyThreshold: false,
  enableTierAvailabilityWindow: true,
};

// NEW
const DEFAULT_PAYMENTS: PaymentSettings = {
  allowManualQR: true,
};

const DEFAULT_STOREFRONT: StorefrontSettings = {
  bio: '',
  contactEmail: '',
  policies: { refund: '', terms: '', privacy: '' },
};

const DEFAULT_SETTINGS: CompanySettings = {
  rsvpEnabled: false,
  enableTax: false,
  gstScheme: 'none',
  taxType: 'inclusive',
  defaultTaxRate: 0,
  enableRounding: true,
  roundingInterval: 1,
  ticketDisplay: DEFAULT_TICKET_DISPLAY,
  eventFieldRequirements: DEFAULT_FIELD_REQUIREMENTS,
  attendeeQuestionsEnabled: true,
  whatsappShareTemplate: 'Check out {{eventTitle}} on Outsold! {{link}}',
  autoFeatureNearest: true,
  organizationName: '',
  payments: DEFAULT_PAYMENTS, // NEW
  storefront: DEFAULT_STOREFRONT,
  // NEW
  website: '',
  instagram: '',
  facebook: '',
  twitter: '',
  whatsappNumber: '',
};

// Combines the three docs a company's settings come from: settings/general,
// the company root (name) and business_info/profile (website/socials).
const mergeCompanySettings = (
  settingsData: Partial<CompanySettings>,
  orgName: string,
  businessInfo: Partial<CompanySettings>
): CompanySettings => ({
  ...DEFAULT_SETTINGS,
  ...settingsData,
  organizationName: orgName || DEFAULT_SETTINGS.organizationName,
  ticketDisplay: {
    ...DEFAULT_TICKET_DISPLAY,
    ...(settingsData.ticketDisplay ?? {}),
  },
  eventFieldRequirements: {
    ...DEFAULT_FIELD_REQUIREMENTS,
    ...(settingsData.eventFieldRequirements ?? {}),
  },
  // NEW
  payments: {
    ...DEFAULT_PAYMENTS,
    ...(settingsData.payments ?? {}),
  },
  storefront: {
    ...DEFAULT_STOREFRONT,
    ...(settingsData.storefront ?? {}),
    policies: {
      ...DEFAULT_STOREFRONT.policies,
      ...(settingsData.storefront?.policies ?? {}),
    },
  },
  // NEW — website/social from business_info/profile
  website: businessInfo.website ?? DEFAULT_SETTINGS.website,
  instagram: businessInfo.instagram ?? DEFAULT_SETTINGS.instagram,
  facebook: businessInfo.facebook ?? DEFAULT_SETTINGS.facebook,
  twitter: businessInfo.twitter ?? DEFAULT_SETTINGS.twitter,
  whatsappNumber: businessInfo.whatsappNumber ?? DEFAULT_SETTINGS.whatsappNumber,
  gstinNumber: businessInfo.gstinNumber ?? DEFAULT_SETTINGS.gstinNumber, // NEW
  brandCoverUrl: businessInfo.brandCoverUrl || undefined,
});

// What the server sent with this storefront page (see lib/storefrontData.ts),
// in the same three parts the listeners below keep up to date.
const seededParts = (companyId?: string | null) => {
  const seed = companyId ? getStorefrontSeed(companyId) : null;
  if (!seed) return null;
  return {
    settingsData: seed.settings as Partial<CompanySettings>,
    orgName: seed.company.name,
    businessInfo: seed.businessInfo as Partial<CompanySettings>,
  };
};

export function useCompanySettings(targetCompanyId?: string | null) {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<CompanySettings>(() => {
    const seeded = seededParts(targetCompanyId);
    return seeded ? mergeCompanySettings(seeded.settingsData, seeded.orgName, seeded.businessInfo) : DEFAULT_SETTINGS;
  });
  const [loading, setLoading] = useState(() => !seededParts(targetCompanyId));

  useEffect(() => {
    const effectiveCompanyId = targetCompanyId || profile?.companyId;
    if (!effectiveCompanyId) {
      setLoading(false);
      return;
    }
    const settingsRef = doc(db, 'companies', effectiveCompanyId, 'settings', 'general');
    const companyRef = doc(db, 'companies', effectiveCompanyId);
    // NEW — website/social links live in business_info/profile (same doc
    // EditProfile's useProfileData writes to), not settings/general
    const businessInfoRef = doc(db, 'companies', effectiveCompanyId, 'business_info', 'profile');

    // Start from the server's copy when there is one, so the first live
    // snapshot (which only covers one of the three docs) doesn't blank the rest.
    const seeded = seededParts(targetCompanyId);
    let latestSettingsData: Partial<CompanySettings> = seeded?.settingsData ?? {};
    let latestOrgName = seeded?.orgName ?? '';
    let latestBusinessInfo: Partial<CompanySettings> = seeded?.businessInfo ?? {}; // NEW

    const applyMerged = () => {
      setSettings(mergeCompanySettings(latestSettingsData, latestOrgName, latestBusinessInfo));
      setLoading(false);
    };

    // Offline, Firestore reports each doc as "missing" from its empty cache —
    // that must not wipe what the server already sent with the page.
    const isOfflineGuess = (snap: { metadata: { fromCache: boolean } }) => !!seeded && snap.metadata.fromCache;

    const unsubscribeSettings = onSnapshot(settingsRef, (snap) => {
      if (isOfflineGuess(snap)) return;
      latestSettingsData = snap.exists() ? (snap.data() as Partial<CompanySettings>) : {};
      applyMerged();
    });

    const unsubscribeCompany = onSnapshot(companyRef, (snap) => {
      if (isOfflineGuess(snap)) return;
      latestOrgName = snap.exists() ? (snap.data().name ?? '') : '';
      applyMerged();
    });

    // NEW
    const unsubscribeBusinessInfo = onSnapshot(businessInfoRef, (snap) => {
      if (isOfflineGuess(snap)) return;
      latestBusinessInfo = snap.exists() ? (snap.data() as Partial<CompanySettings>) : {};
      applyMerged();
    });

    return () => {
      unsubscribeSettings();
      unsubscribeCompany();
      unsubscribeBusinessInfo(); // NEW
    };
  }, [targetCompanyId, profile?.companyId]);

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