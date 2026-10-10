// Storefront data sent by the server (index.js) inside the page, so a store's
// home and event pages render on the first frame instead of waiting for
// Firebase Auth and three Firestore queries — the chain that kept stalling on
// iPhones and in-app browsers. The hooks seed their state from it and then
// attach their normal Firestore listeners, which keep it live.
//
// Only covers the URL the server rendered: after a client-side navigation the
// hooks load from Firestore exactly as before.

export interface StorefrontSeed {
  v: 1;
  path: string;
  companyId: string;
  subdomain: string | null;
  company: { name: string; organizationName: string };
  settings: Record<string, unknown>;
  businessInfo: Record<string, unknown>;
  // Raw event fields (the same shape Firestore returns), or null when the
  // store has too many events to send — the list then loads from Firestore.
  events: { id: string; data: Record<string, unknown> }[] | null;
}

let parsed: StorefrontSeed | null | undefined;

const readSeed = (): StorefrontSeed | null => {
  if (parsed === undefined) {
    try {
      const el = document.getElementById('storefront-data');
      const value = el?.textContent ? JSON.parse(el.textContent) : null;
      parsed = value?.v === 1 ? (value as StorefrontSeed) : null;
    } catch {
      parsed = null;
    }
  }
  return parsed;
};

/** The server's data for this store, if it describes the page currently open. */
export const getStorefrontSeed = (companyId?: string | null): StorefrontSeed | null => {
  const seed = readSeed();
  if (!seed || seed.path !== window.location.pathname) return null;
  if (companyId && seed.companyId !== companyId) return null;
  return seed;
};

/** Removes the server's plain-HTML preview once the app has drawn the real page. */
export const dismissServerPreview = () => {
  document.getElementById('ssr-preview')?.remove();
};
