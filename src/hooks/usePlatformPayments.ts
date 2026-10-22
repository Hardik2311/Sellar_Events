import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import {
  DEFAULT_FEE_CONFIG,
  eventFeeOverrideId,
  resolveFeeConfig,
  type EffectiveFeeConfig,
  type PlatformConfigDoc,
  type PlatformFeeOverrideDoc,
} from '../lib/platformFee';
import { isSuperAdminUid } from '../constants/superAdmins';

/**
 * Live platform fee settings: platform/config, plus the event's custom fee
 * when an eventId is given. Both docs are public-readable, so this also
 * works on the storefront.
 */
export function usePlatformFeeConfig(companyId?: string | null, eventId?: string | null) {
  const [config, setConfig] = useState<PlatformConfigDoc | null>(null);
  const [override, setOverride] = useState<PlatformFeeOverrideDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'platform', 'config'),
      (snap) => {
        setConfig(snap.exists() ? (snap.data() as PlatformConfigDoc) : null);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load platform config:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (!companyId || !eventId) return;
    return onSnapshot(
      doc(db, 'eventFeeOverrides', eventFeeOverrideId(companyId, eventId)),
      (snap) => setOverride(snap.exists() ? (snap.data() as PlatformFeeOverrideDoc) : null),
      (err) => console.error('Failed to load event fee override:', err)
    );
  }, [companyId, eventId]);

  const activeOverride = companyId && eventId ? override : null;
  const effective: EffectiveFeeConfig = loading ? DEFAULT_FEE_CONFIG : resolveFeeConfig(config, activeOverride);
  return { config: effective, rawConfig: config, override: activeOverride, loading };
}

export interface PayoutAccount {
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  upiId?: string;
}

/** Organizer's payout bank details — readable by the owner (and super admins) only. */
export function usePayoutAccount(companyId?: string | null) {
  const [account, setAccount] = useState<PayoutAccount | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!companyId) return;
    return onSnapshot(
      doc(db, 'payoutAccounts', companyId),
      (snap) => {
        setAccount(snap.exists() ? (snap.data() as PayoutAccount) : null);
        setLoading(false);
      },
      () => setLoading(false) // non-owners can't read it — that's expected
    );
  }, [companyId]);
  return { account: companyId ? account : null, loading: companyId ? loading : false };
}

export interface PayoutLedger {
  ticketsGross?: number;
  taxableValue?: number;
  platformFee?: number;
  platformFeeGst?: number;
  tcs?: number;
  tds?: number;
  netPayable?: number;
  paidOut?: number;
  orders?: number;
  tickets?: number;
}

/** Running totals of what the platform owes this organizer (Cloud Functions write it). */
export function usePayoutLedger(companyId?: string | null) {
  const [ledger, setLedger] = useState<PayoutLedger | null>(null);
  useEffect(() => {
    if (!companyId) return;
    return onSnapshot(
      doc(db, 'payoutLedger', companyId),
      (snap) => setLedger(snap.exists() ? (snap.data() as PayoutLedger) : null),
      (err) => console.error('Failed to load payout ledger:', err)
    );
  }, [companyId]);
  return ledger;
}

/** Super-admin gate for the /super-admin pages. */
export function useSuperAdmin() {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [checked, setChecked] = useState(false);
  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        setUid(user?.uid ?? null);
        setChecked(true);
      }),
    []
  );
  return { uid, checked, isSuperAdmin: isSuperAdminUid(uid) };
}
