/**
 * Utility functions for extracting and validating subdomains.
 */

const RESERVED_SUBDOMAINS = ['www', 'app', 'api', 'admin', 'localhost', 'mail', 'support', 'help'];

/**
 * Parses the current hostname and returns the subdomain if it exists and is not reserved.
 * @returns The subdomain string, or null if no valid merchant subdomain is found.
 */
export const getSubdomain = (): string | null => {
  // Safe check for SSR environments (if applicable)
  if (typeof window === 'undefined') return null;

  const hostname = window.location.hostname;
  const parts = hostname.split('.');

  // If there are at least 3 parts (e.g., store.domain.com) and it's not a localhost IP
  if (parts.length >= 3 && !hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/)) {
    const subdomain = parts[0].toLowerCase();

    // Ignore reserved subdomains
    if (!RESERVED_SUBDOMAINS.includes(subdomain)) {
      return subdomain;
    }
  }

  return null;
};

/**
 * Checks whether the current session is running on a merchant's custom subdomain.
 */
export const isMerchantSubdomain = (): boolean => {
  return getSubdomain() !== null;
};
