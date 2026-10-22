import { dismissServerPreview } from './storefrontData';

// Vite content-hashes chunk filenames, so a hash a visitor's browser is still
// holding (an open tab spanning a deploy, or a stale cached index.html) can
// point at a JS file that no longer exists after the next deploy. That 404s
// the dynamic import(). We self-heal with a single automatic reload before
// falling back to a manual "please refresh" screen.
const CHUNK_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|Loading CSS chunk/i;

const RELOAD_GUARD_KEY = 'errorBoundary:reloadedForChunkError';

// Shared by ErrorBoundary (errors outside the router) and RouteError (errors
// React Router catches inside a route, which never reach ErrorBoundary).
export const handleAppError = (error: unknown) => {
  console.error('Unhandled error in app tree:', error);
  // Otherwise the server's storefront preview would sit on top of the error screen.
  dismissServerPreview();

  const message = error instanceof Error ? error.message : String(error);
  if (CHUNK_ERROR_PATTERN.test(message)) {
    const alreadyTriedReload = sessionStorage.getItem(RELOAD_GUARD_KEY) === '1';
    if (!alreadyTriedReload) {
      sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
      window.location.reload();
    }
  }
};
