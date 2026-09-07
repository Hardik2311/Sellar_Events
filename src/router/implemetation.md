Ready for review
Select text to add comments on the plan
Plan: Replicate Public-Link / Subdomain Routing from gg-bni-app in Another App
Context
gg-bni-app has a "shared catalogue" feature that lets a merchant get a shareable public storefront link. The user wants to give another app the same capability. Investigation of this repo shows the feature is not true bring-your-own-domain support (no DNS TXT verification, no Firebase Hosting Domains API calls) — it is a wildcard-subdomain system on a single root domain (*.sellar.in), resolved entirely client-side against Firestore. The user has confirmed this is the pattern to replicate (not full custom-domain/DNS verification), and that the target app does not yet have a wildcard DNS entry set up.

How it works today (reference implementation)
Important hosting detail: this app does not run on classic static Firebase Hosting anymore. Commit d91a799 ("changing from hosting to app hosting") migrated it to Firebase App Hosting (Cloud Run under the hood):

index.js is a small Express server added by that migration: it serves the Vite dist/ build statically, then a catch-all route (app.get('/*splat', ...)) hands any non-file path back to index.html so React Router can take over — this replaces what the classic Hosting "**" → "/index.html" rewrite used to do.
package.json has a "start": "node index.js" script — this is the entrypoint App Hosting's Cloud Run container runs.
apphosting.yaml configures the Cloud Run backend (runConfig.minInstances, env vars/secrets for VITE_* build-time config).
firebase.json's "apphosting" array (currently listing backends newapp and my-web-app) declares the App Hosting backend(s) tied to this repo; the "hosting" block in the same file is the older classic-Hosting config and is effectively legacy/unused for serving the SPA now (though the /api/getPublicCatalogue* function rewrites still reference it).
Because routing to index.html happens in the Express catch-all rather than a Hosting rewrite, the wildcard domain must be attached to the App Hosting backend, not to a classic Hosting site — done via Firebase Console → App Hosting → the backend → Custom domains (or firebase apphosting:backends:* / domain CLI commands), plus the matching wildcard DNS record at the registrar. Once attached, every hostname under the wildcard hits the same Cloud Run service/Express server, which serves the identical bundle regardless of subdomain — exactly like classic Hosting's catch-all did.
One-time infra setup (outside the codebase): a wildcard custom domain (*.sellar.in) is added to the App Hosting backend in the Firebase Console (App Hosting → backend → Custom domains), and a wildcard DNS record (* CNAME/A, per Firebase's shown instructions) is created at the registrar pointing at that backend. Every subdomain resolves to the exact same Cloud Run service/SPA build — there is no per-merchant hosting config.
Merchant claims a slug — SubDomainModal.tsx: merchant enters a prefix, picks a suffix (shop/catalog), client sanitizes to [a-z0-9-], checks uniqueness via Firestore query companies where domainAliases array-contains <candidate> (SubDomainModal.tsx:88-117), then on save updates companies/{companyId}: sets subdomain: <new> and appends to domainAliases: string[] while removing the old value (SubDomainModal.tsx:121-158). domainAliases is kept as a history so stale links still resolve (and redirect).
Share UI — CatalogueShareCard.tsx builds https://{subdomain}.sellar.in if claimed, else falls back to https://{origin}/catalogue/{companyId}.
Firebase Hosting — firebase.json has a single SPA catch-all rewrite ("**" → "/index.html"); no multi-site/domain config needed since it's one wildcard mapping.
Client-side hostname parsing — src/lib/subdomain.ts: getSubdomain() splits window.location.hostname on ., requires parts.length >= 3, ignores www/app/localhost, returns parts[0] or null.
Router branches on subdomain at module load — src/routes/routes.tsx computes const subdomain = getSubdomain() once and builds either a subdomain-relative route tree (/, /checkout, /:groupId) or the legacy path-based public routes (/catalogue/:companyId, /:companyId/:groupId, /checkout/:companyId), all marked handle: { isPublic: true }.
Page resolves identity from Firestore — SharedCatalouge.tsx:57-109 (duplicated in useDomainResolution.ts for checkout): re-parses hostname, queries companies where domainAliases array-contains subdomain; if the matched doc's current subdomain differs from the URL (stale alias), window.location.replace to the canonical one; otherwise sets resolvedCompanyId; if no match, shows a "Store Not Found" state. If there's no subdomain at all, falls back to the :companyId route param.
Catalogue renders using resolvedCompanyId/effectiveCompanyId to fetch itemGroups/items/business_info as normal.
Note: there's an orphaned/unused getPublicCatalogue Cloud Function (in compiled functions/lib/index.js, source not present) that reads a public_catalogues collection that's never written — a dead-end from an earlier design. Do not replicate this — the live pattern is the client-side Firestore lookup described above.

Implementation Plan for the Target App
1. App Hosting setup (do this first)
The target app is also on Firebase App Hosting (Cloud Run), same as this repo, so the wildcard domain goes on the App Hosting backend, not a classic Hosting site:

If the target app doesn't already have the Express/catch-all serving pattern, port it from index.js: serve the built SPA (dist/ or equivalent) statically, then a catch-all route returning index.html for any non-asset path (so client-side React Router handles it) — with the same "return 404 for requests that look like a file extension" guard shown there, to avoid masking real missing-asset errors as the SPA shell.
Ensure the target app's package.json has a start script pointing at that server ("start": "node index.js" or equivalent) and that apphosting.yaml / firebase.json's "apphosting" backend config point at it, mirroring apphosting.yaml and the "apphosting" block in firebase.json.
Pick the root domain the wildcard will live under (e.g. *.yourapp.com).
In Firebase Console → App Hosting → the target backend → Custom domains → add *.yourapp.com (wildcard), and complete the one-time TXT ownership verification Firebase requires at the root-domain level (not per-merchant).
At the DNS registrar, add the * record (per Firebase's shown instructions) pointing at the App Hosting backend.
No Hosting rewrites config is needed for the SPA fallback since the Express catch-all already handles it; if the target app also serves any Cloud Functions under /api/* the way this repo does, add those as classic Hosting rewrites only if it still uses a classic Hosting site alongside App Hosting for that purpose — otherwise expose them directly as callable/HTTPS functions.
2. Firestore schema
On the tenant/company/business document (whatever the target app's equivalent collection is), add two fields:

subdomain: string — current active slug.
domainAliases: string[] — history of all slugs ever claimed by this tenant (used both for uniqueness checks and to resolve/redirect stale links).
3. Hostname parsing utility
Port src/lib/subdomain.ts as-is (or adapt the ignored-slugs list www/app to whatever reserved subdomains the new app needs, e.g. admin, api): a small getSubdomain() that splits hostname, requires ≥3 parts, excludes localhost and reserved names, returns parts[0] or null; plus isMerchantSubdomain().

4. Slug claim UI
Port SubDomainModal.tsx's pattern:

Prefix input + suffix dropdown (or just a single free-text slug field if the two-part scheme isn't needed) sanitized to [a-z0-9-].
Debounced availability check: Firestore query on the tenant collection, domainAliases array-contains <candidate>.
On save: read current doc, remove old alias from domainAliases, push new one, updateDoc({ subdomain, domainAliases }).
5. Share link builder
Port CatalogueShareCard.tsx's logic: subdomain ? https://${subdomain}.yourapp.com : https://${origin}/<fallback-path>/${tenantId}.

6. Router branching
In the target app's route config, compute getSubdomain() once and branch:

On a subdomain → relative route tree for the public page(s), marked public/unauthenticated.
No subdomain → keep existing path-based routes (/public/:tenantId or equivalent) as fallback for tenants who haven't claimed a slug yet, or for legacy links.
7. Public page domain resolution
Port the resolution effect from SharedCatalouge.tsx:71-109:

Parse subdomain from hostname.
Query tenant collection where domainAliases array-contains subdomain.
If matched doc's current subdomain ≠ URL's subdomain → window.location.replace to canonical URL (handles stale/old claimed links).
If matched → set resolved tenant ID and proceed to fetch/display data.
If no match → render a "Not Found" state.
If no subdomain present → fall back to the route param (path-based access).
Consider extracting this into one shared hook (e.g. useDomainResolution.ts) from the start rather than duplicating it across pages, since this repo shows duplication happened organically across SharedCatalouge.tsx, CheckOut.tsx, and others — worth avoiding the duplication when building fresh.

8. Reserved-slug guard
Add the equivalent of excluding www/app — plus any other reserved words the new app uses (api, admin, mail, etc.) — both in the claim-availability check and in getSubdomain()'s ignore list, so merchants can't accidentally claim a subdomain that collides with real app infrastructure.

Verification
Locally: since wildcard subdomains can't be tested via localhost, either (a) deploy to a Firebase Hosting preview channel under the real wildcard domain, or (b) temporarily edit /etc/hosts (or Windows hosts file) to map a test subdomain (e.g. test-shop.yourapp.com) to 127.0.0.1 and run vite --host with a matching dev-server hostname allowlist.
Claim a slug via the new UI, confirm subdomain/domainAliases update correctly in Firestore.
Visit https://<slug>.yourapp.com, confirm the public page resolves the correct tenant and renders data.
Re-claim a different slug for the same tenant, then visit the old subdomain URL — confirm it redirects to the new canonical one via the stale-alias check.
Visit an unclaimed/garbage subdomain — confirm the "Not Found" state renders instead of a crash.
Confirm the fallback path-based route (/public/:tenantId) still works for tenants without a claimed subdomain.
Add Comment