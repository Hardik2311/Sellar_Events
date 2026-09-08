import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Resolves the public base URL a company's store/events should be shared
 * from: their claimed subdomain if they have one, else the company-scoped
 * fallback path on the current origin (works without any DNS/domain setup).
 */
export const getShareBaseUrl = async (companyId: string): Promise<string> => {
  try {
    const snap = await getDoc(doc(db, 'companies', companyId));
    const subdomain = snap.exists() ? (snap.data().subdomain as string | undefined) : undefined;
    if (subdomain) return `https://${subdomain}.outsold.in`;
  } catch (error) {
    console.error('Error fetching subdomain for sharing:', error);
  }
  return `${window.location.origin}/public/${companyId}`;
};
