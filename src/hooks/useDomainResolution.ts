import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getSubdomain } from '../lib/subdomain';
import { getStorefrontSeed } from '../lib/storefrontData';

// The store the server already resolved for this page, if any. A stale
// subdomain returns null so the lookup below still runs and redirects.
const seededCompanyId = (fallbackCompanyId?: string): string | null => {
  const seed = getStorefrontSeed();
  if (!seed) return null;
  const subdomain = getSubdomain();
  if (subdomain) return seed.subdomain && seed.subdomain !== subdomain ? null : seed.companyId;
  return fallbackCompanyId === seed.companyId ? seed.companyId : null;
};

export function useDomainResolution(fallbackCompanyId?: string) {
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(() => seededCompanyId(fallbackCompanyId));
  const [loading, setLoading] = useState(() => !seededCompanyId(fallbackCompanyId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const resolveDomain = async () => {
      const fromServer = seededCompanyId(fallbackCompanyId);
      if (fromServer) {
        setResolvedCompanyId(fromServer);
        setLoading(false);
        return;
      }

      const subdomain = getSubdomain();

      if (!subdomain) {
        // No subdomain, use fallback if provided (e.g. from route params)
        if (fallbackCompanyId) {
          setResolvedCompanyId(fallbackCompanyId);
          setLoading(false);
          return;
        }

        // Dev convenience: on localhost, let any company be tested via
        // ?company=<companyId> — e.g. /discover?company=abc123 — instead of
        // only working through /public/:companyId or a claimed subdomain.
        const isLocalhost =
          typeof window !== 'undefined' &&
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        const companyOverride = isLocalhost
          ? new URLSearchParams(window.location.search).get('company')
          : null;
        if (companyOverride) {
          setResolvedCompanyId(companyOverride);
        } else {
          setError('No store specified.');
        }
        setLoading(false);
        return;
      }

      try {
        const companiesRef = collection(db, 'companies');
        const q = query(companiesRef, where('domainAliases', 'array-contains', subdomain));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setError('Store not found.');
          setLoading(false);
          return;
        }

        const companyDoc = querySnapshot.docs[0];
        const data = companyDoc.data();

        // Check for stale link (if the subdomain they are on isn't the current one)
        if (data.subdomain && data.subdomain !== subdomain) {
          const currentHost = window.location.host;
          // Replace the stale subdomain with the new one
          // E.g. stale.domain.com -> active.domain.com
          const newHost = currentHost.replace(subdomain, data.subdomain);
          const newUrl = `${window.location.protocol}//${newHost}${window.location.pathname}${window.location.search}`;
          window.location.replace(newUrl);
          return; // don't stop loading, we are redirecting
        }

        setResolvedCompanyId(companyDoc.id);
        setLoading(false);
      } catch (err) {
        console.error('Error resolving domain:', err);
        setError('Failed to resolve store.');
        setLoading(false);
      }
    };

    resolveDomain();
  }, [fallbackCompanyId]);

  return { resolvedCompanyId, loading, error };
}
