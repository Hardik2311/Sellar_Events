CDN / caching headers
Since the app runs on Firebase App Hosting (Cloud Run via index.js), the classic firebase.json headers block (firebase.json:23-42) is mostly dead for this traffic — the headers that actually apply come from index.js and the Cloud Functions:

Static assets (index.js:54): express.static(distPath, { maxAge: '1y', immutable: true }) → Cache-Control: public, max-age=31536000, immutable. Safe because Vite content-hashes filenames.
HTML responses (index.js:47-49, applied at line 123-124 and in the crawler branch): Cache-Control: no-cache — always revalidated, so a new deploy is picked up immediately without stale HTML.
Bot/crawler OG-preview branch (index.js:70-77): adds Vary: User-Agent only on that branch, so normal visitor traffic isn't fragmented in the CDN cache — human traffic gets the plain no-cache HTML response, no Vary variability.
Cloud Functions (functions/lib/index.js):
getPublicCatalogue: Cache-Control: public, max-age=0, must-revalidate (line 242) — effectively uncached.
getPublicCatalogueItems: public, max-age=30, s-maxage=300, stale-while-revalidate=600 (lines 281-284) — 30s browser / 5min CDN / 10min stale-while-revalidate, meant so concurrent visitors to the same store share one Firestore read.
getPublicItem (OG preview data): public, max-age=60, s-maxage=3600, stale-while-revalidate=600.
Known gap: SharedCatalouge.tsx actually calls getItemGroupsByCompany/getItemsByCompany directly against Firestore, not the CDN-cached /api/getPublicCatalogueItems endpoint — so despite that endpoint existing specifically to serve this page, the storefront currently reads Firestore uncached on every anonymous visit. Worth fixing if you want the CDN caching to actually take effect.
App Hosting itself has no separate edge-cache config (apphosting.yaml only has runConfig/env) — all cache behavior is just standard Cache-Control headers set in your own server code, read by the front-end CDN.
White-screen prevention — a 3-layer fallback chain
Static HTML shell (index.html) — just <div id="root">, genuinely blank for a brief instant; no inline spinner here.
Router-level Suspense fallback (routes.tsx:181-188) — the whole RouterProvider is wrapped in <Suspense fallback={<Loading />}>. Since SharedCatalouge is React.lazy-loaded (routes.tsx:45), this full-screen animated splash (Loading.tsx — logo cross-fade + cycling "LOADING/SYNCING/PREPARING/OPENING" text) covers the JS-chunk-download gap.
Component-level loading state (SharedCatalouge.tsx:427-444) — once the chunk has loaded and mounted, the page shows its own "Loading Store..." progress bar while it resolves the subdomain against Firestore and fetches items; falls through to a "Store Not Found" screen (line 417-424) or a red error screen (line 446-452) on failure.
So nothing is ever truly blank except the sub-second gap before React itself mounts — every subsequent wait (chunk download, domain resolution, data fetch) has its own dedicated screen.

For replicating in the other app: port the pattern as outer Suspense fallback = branded splash → inner per-page loading state during async resolution → explicit not-found/error states, and if you also plan to route the storefront's data fetch through a CDN-cached endpoint (worth doing, unlike this repo's current gap), make sure the page actually calls that endpoint rather than defaulting back to direct Firestore reads.