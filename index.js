import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

const INDEX_HTML_PATH = path.join(__dirname, 'dist', 'index.html');
const indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

// ─── Link previews (WhatsApp, iMessage, Instagram, Slack, X, …) ──────────────
// Preview crawlers don't run JavaScript, so they only ever see the static
// index.html shell — which is why every shared link previewed as the generic
// Outsold logo. We inject per-page Open Graph tags here instead: the event's
// poster for event links, and the brand banner (or a featured event's poster)
// for store links.
//
// Reads go through the public Firestore REST API rather than the Admin SDK:
// companies, business_info, settings/general and events are all
// `allow read: if true` in firestore.rules, so no credentials are needed and
// this only ever sees what an anonymous visitor could already read.

const PROJECT_ID =
  process.env.VITE_PROJECT_ID ||
  (() => { try { return JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId; } catch { return undefined; } })() ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  'sellar-events-9923f';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Keep in sync with RESERVED_SUBDOMAINS in src/lib/subdomain.ts
const RESERVED_SUBDOMAINS = ['www', 'app', 'api', 'admin', 'localhost', 'mail', 'support', 'help'];

const FETCH_TIMEOUT_MS = 2000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const metaCache = new Map(); // key -> { value, expires }

// Firestore REST returns typed values ({ stringValue: 'x' }); unwrap to plain JS.
const decodeValue = (v) => {
  if (!v || 'nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields);
  return null;
};
const decodeFields = (fields = {}) =>
  Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decodeValue(v)]));

const firestoreGet = async (docPath) => {
  const res = await fetch(`${FIRESTORE_BASE}/${docPath}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) return null;
  const json = await res.json();
  return decodeFields(json.fields);
};

const firestoreQuery = async (parentPath, structuredQuery) => {
  const url = parentPath ? `${FIRESTORE_BASE}/${parentPath}:runQuery` : `${FIRESTORE_BASE}:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return [];
  const rows = await res.json();
  return rows
    .filter((r) => r.document)
    .map((r) => ({ id: r.document.name.split('/').pop(), ...decodeFields(r.document.fields) }));
};

// Caches the in-flight promise, so the parallel lookups for one page (link
// preview + storefront data) share a single Firestore request. Failures
// aren't cached.
const cached = (key, load, ttlMs = CACHE_TTL_MS) => {
  const hit = metaCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = load();
  metaCache.set(key, { value, expires: Date.now() + ttlMs });
  value.catch(() => metaCache.delete(key));
  return value;
};

// Event docs carry live ticket counts, so they go stale faster than store details.
const EVENT_CACHE_TTL_MS = 30 * 1000;

// ─── Storefront first paint ──────────────────────────────────────────────────
// Customer pages used to arrive as an empty <div id="root">: nothing showed
// until ~1 MB of JS ran, Firebase Auth started and Firestore answered three
// queries in a row — and on iPhones and in-app browsers any one of those can
// stall, leaving a blank or skeleton page. The data is already looked up here
// for link previews, so storefront pages now also get:
//   - that data as JSON (#storefront-data), which the client renders from
//     straight away instead of waiting on Auth/Firestore, then keeps live
//     with its normal Firestore listeners (src/lib/storefrontData.ts);
//   - a plain-HTML preview (#ssr-preview) that's readable even if the JS
//     never runs, removed by the app once it has rendered the real page.
// All of these docs are public (`allow read: if true`), but they also hold
// things that must never be put in a page — owner PAN/phone in
// business_info, access codes on private events — so only these fields go out.
const SETTINGS_FIELDS = [
  'rsvpEnabled', 'enableTax', 'gstScheme', 'taxType', 'defaultTaxRate', 'enableRounding',
  'roundingInterval', 'ticketDisplay', 'eventFieldRequirements', 'autoFeatureNearest',
  'attendeeQuestionsEnabled', 'whatsappShareTemplate', 'payments', 'storefront',
];
// Exactly what useCompanySettings() reads from business_info/profile.
const BUSINESS_INFO_FIELDS = ['website', 'instagram', 'facebook', 'twitter', 'whatsappNumber', 'gstinNumber', 'brandCoverUrl'];
// Exactly what mapDocToPublicEvent() (src/hooks/usePublicEvents.ts) reads, minus accessCodes.
const EVENT_FIELDS = [
  'title', 'category', 'description', 'date', 'endDate', 'time', 'venue', 'isOnline',
  'coverImageUrls', 'coverImageUrl', 'coverImageDesktop', 'coverImageMobile', 'pastEventsGallery',
  'status', 'featured', 'isPrivate', 'creditExpiresAt', 'everPublished', 'registrationMode',
  'rsvpLink', 'rsvpButtonLabel', 'customFields', 'titleStyle', 'descriptionStyle', 'consentText',
  'consentStyle', 'goodToKnowText', 'goodToKnowStyle', 'paymentCollectionMode', 'upiId',
  'payeeName', 'maxTicketsPerOrder', 'arriveByTime', 'ageLimit', 'helplineNumber', 'taxType',
];
const TIER_FIELDS = ['id', 'name', 'price', 'quantity', 'sold', 'dummyRemaining', 'tierEndDate', 'tierEndTime'];
// A private event shows only its access-code gate until the visitor's code is
// checked against live data, so that's all it gets.
const PRIVATE_EVENT_FIELDS = ['status', 'isPrivate', 'creditExpiresAt'];
// More published events than this and the store home falls back to loading
// its list from Firestore as before.
const MAX_SEEDED_EVENTS = 200;

const pick = (obj, keys) => {
  const out = {};
  if (!obj) return out;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) out[key] = obj[key];
  }
  return out;
};

const toSeedEvent = (event) =>
  event.isPrivate
    ? { id: event.id, data: pick(event, PRIVATE_EVENT_FIELDS) }
    : {
        id: event.id,
        data: { ...pick(event, EVENT_FIELDS), tiers: (event.tiers || []).map((t) => pick(t, TIER_FIELDS)) },
      };

// Mirrors src/lib/subdomain.ts getSubdomain(), but from the request host.
const getSubdomain = (hostname) => {
  if (!hostname || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return null;
  const parts = hostname.split('.');
  if (parts.length < 3) return null;
  const sub = parts[0].toLowerCase();
  return RESERVED_SUBDOMAINS.includes(sub) ? null : sub;
};

// Mirrors parseEventIdFromSlug() in src/data/events.ts
const parseEventIdFromSlug = (slug) => {
  const idx = slug.lastIndexOf('--');
  return idx === -1 ? slug : slug.slice(idx + 2);
};

const resolveCompanyIdBySubdomain = (subdomain) =>
  cached(`sub:${subdomain}`, async () => {
    const [company] = await firestoreQuery('', {
      from: [{ collectionId: 'companies' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'domainAliases' },
          op: 'ARRAY_CONTAINS',
          value: { stringValue: subdomain },
        },
      },
      limit: 1,
    });
    return company?.id ?? null;
  });

// Landscape poster first — WhatsApp renders a big image card for wide images
// and a small square thumbnail for tall ones.
const eventImage = (e) =>
  e.coverImageDesktop || e.coverImageUrls?.[0] || e.coverImageUrl || e.coverImageMobile || null;

// Titles and descriptions are rich text (often pasted straight from Word,
// e.g. `<p class="MsoNormal"><span style=…>`), so both need flattening to
// plain text before going into a meta tag.
const stripHtml = (html = '') =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

const formatEventDate = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

const loadCompany = (companyId) =>
  cached(`company:${companyId}`, async () => {
    const [company, profile, settings] = await Promise.all([
      firestoreGet(`companies/${encodeURIComponent(companyId)}`),
      firestoreGet(`companies/${encodeURIComponent(companyId)}/business_info/profile`),
      firestoreGet(`companies/${encodeURIComponent(companyId)}/settings/general`),
    ]);
    if (!company) return null;
    return {
      name: (company.name || '').trim(),
      brandCoverUrl: profile?.brandCoverUrl || null,
      bio: settings?.storefront?.bio || '',
      // Storefront page data — whitelisted fields only, never the raw docs
      // (see SETTINGS_FIELDS / BUSINESS_INFO_FIELDS).
      seed: {
        subdomain: company.subdomain || null,
        company: { name: company.name || '', organizationName: company.organizationName || '' },
        settings: pick(settings, SETTINGS_FIELDS),
        businessInfo: pick(profile, BUSINESS_INFO_FIELDS),
      },
    };
  });

const loadPublishedEvents = (companyId) =>
  cached(
    `events:${companyId}`,
    () =>
      firestoreQuery(`companies/${encodeURIComponent(companyId)}`, {
        from: [{ collectionId: 'events' }],
        where: {
          fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'published' } },
        },
        limit: MAX_SEEDED_EVENTS + 1,
      }),
    EVENT_CACHE_TTL_MS,
  );

// Fallback image for a store with no brand banner: a featured event's poster,
// else the next upcoming event's, else any published event's.
const loadStoreFallbackImage = (companyId) =>
  cached(`storeimg:${companyId}`, async () => {
    const events = await loadPublishedEvents(companyId);
    const today = new Date().toISOString().slice(0, 10);
    const candidates = events.filter((e) => !e.isPrivate && eventImage(e));
    const upcoming = candidates
      .filter((e) => (e.endDate || e.date || '') >= today)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const pick = upcoming.find((e) => e.featured) || upcoming[0] || candidates.find((e) => e.featured) || candidates[0];
    return pick ? eventImage(pick) : null;
  });

const loadEvent = (companyId, eventId) =>
  cached(
    `event:${companyId}:${eventId}`,
    () => firestoreGet(`companies/${encodeURIComponent(companyId)}/events/${encodeURIComponent(eventId)}`),
    EVENT_CACHE_TTL_MS,
  );

const buildStoreMeta = async (companyId) => {
  const company = await loadCompany(companyId);
  if (!company) return null;
  const name = company.name || 'Outsold';
  return {
    title: stripHtml(name) || 'Outsold',
    description: truncate(stripHtml(company.bio) || `Upcoming events and tickets from ${name}.`, 200),
    image: company.brandCoverUrl || (await loadStoreFallbackImage(companyId)),
    siteName: name,
  };
};

const buildEventMeta = async (companyId, slug) => {
  const eventId = parseEventIdFromSlug(slug);
  const [event, company] = await Promise.all([loadEvent(companyId, eventId), loadCompany(companyId)]);
  // Unpublished/deleted events fall back to the store's preview rather than
  // leaking a draft's title and poster.
  if (!event || event.status !== 'published') return buildStoreMeta(companyId);

  const siteName = company?.name || 'Outsold';
  const title = stripHtml(event.title || '');
  const when = formatEventDate(event.date);
  const where = event.isOnline ? 'Online' : event.venue || '';
  const summary = [when, where].filter(Boolean).join(' · ');
  // Private events are shared deliberately by link, so the poster/title are
  // fine — but keep the body copy out of the preview.
  const body = event.isPrivate ? '' : stripHtml(event.description || '');
  return {
    title: title || siteName,
    description: truncate([summary, body].filter(Boolean).join(' — ') || `Get tickets on ${siteName}.`, 200),
    image: eventImage(event) || company?.brandCoverUrl || null,
    siteName,
  };
};

const escapeAttr = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Mirrors generateSlug()/buildEventSlugId() in src/data/events.ts. Only the id
// after "--" is ever parsed back, so small differences in the title part are harmless.
const buildEventSlugId = (title, id) =>
  `${stripHtml(title || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')}--${id}`;

// Mirrors formatTime() in src/data/events.ts and formatRupees() in src/lib/storefrontFormat.ts.
const formatTime = (time) => {
  if (!time) return '';
  const [h, m] = String(time).split(':').map(Number);
  if (Number.isNaN(h)) return '';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const formatRupees = (amount) => {
  if (amount === 0) return 'Free';
  const hasPaise = Math.round(amount * 100) % 100 !== 0;
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: hasPaise ? 2 : 0, maximumFractionDigits: hasPaise ? 2 : 0 })}`;
};

// Same rule the client applies (isCreditExpired in src/data/events.ts).
const isOnSale = (event) =>
  event.status === 'published' && !!event.creditExpiresAt && new Date(event.creditExpiresAt).getTime() > Date.now();

const PREVIEW_CSS = [
  '#ssr-preview{position:fixed;inset:0;z-index:2147483000;overflow-y:auto;background:#f4efe4;color:#14120f;font-family:Figtree,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}',
  '#ssr-preview *{box-sizing:border-box}',
  '#ssr-preview header{padding:18px 16px;border-bottom:1px solid rgba(20,18,15,.12);background:#fffdf4;font-weight:700;font-size:15px}',
  '#ssr-preview .cover{display:block;width:100%;max-height:60vh;object-fit:cover;background:rgba(20,18,15,.06)}',
  '#ssr-preview main{max-width:720px;margin:0 auto;padding:24px 16px 48px}',
  '#ssr-preview h1{font-family:Anton,"Arial Narrow",Impact,sans-serif;font-weight:400;font-size:32px;line-height:1.05;margin:0 0 14px}',
  '#ssr-preview p{margin:0 0 6px;font-size:15px;line-height:22px;font-weight:600}',
  '#ssr-preview .muted{color:#625f5a;font-weight:500}',
  '#ssr-preview .cta{display:inline-block;margin-top:18px;padding:14px 22px;background:#14120f;color:#f4efe4;border-radius:4px;font-weight:700;text-decoration:none}',
  '#ssr-preview ul{list-style:none;margin:0;padding:0;display:grid;gap:12px}',
  '#ssr-preview li a{display:flex;gap:12px;align-items:center;padding:10px;background:#fffdf4;border:1px solid rgba(20,18,15,.12);border-radius:8px;color:inherit;text-decoration:none}',
  '#ssr-preview li img{flex:none;width:72px;height:72px;object-fit:cover;border-radius:6px;background:rgba(20,18,15,.06)}',
].join('');

const renderEventPreview = (event, orgName, pageUrl) => {
  const image = event.coverImageMobile || event.coverImageDesktop || event.coverImageUrls?.[0] || event.coverImageUrl;
  const title = stripHtml(event.title || '');
  const when = [formatEventDate(event.date), formatTime(event.time)].filter(Boolean).join(' · ');
  const where = event.isOnline ? 'Online' : event.venue || '';
  const prices = (event.tiers || [])
    .filter((t) => (t.sold || 0) < (t.quantity || 0))
    .map((t) => Number(t.price))
    .filter((n) => Number.isFinite(n));
  const startsAt = prices.length ? `Starts at ${formatRupees(Math.min(...prices))}` : '';
  return [
    '<div id="ssr-preview">',
    `<header>${escapeAttr(orgName)}</header>`,
    image ? `<img class="cover" src="${escapeAttr(image)}" alt="${escapeAttr(title)}" />` : '',
    '<main>',
    `<h1>${escapeAttr(title)}</h1>`,
    when ? `<p>${escapeAttr(when)}</p>` : '',
    where ? `<p class="muted">${escapeAttr(where)}</p>` : '',
    startsAt ? `<p>${escapeAttr(startsAt)}</p>` : '',
    // Without JS this simply reloads the page, which is the right retry.
    `<a class="cta" href="${escapeAttr(pageUrl)}">${event.registrationMode === 'rsvp' ? 'RSVP' : 'Book tickets'}</a>`,
    '</main></div>',
  ].join('');
};

const renderStorePreview = (orgName, events, basePath) => {
  const today = new Date().toISOString().slice(0, 10);
  const listed = events
    .filter((e) => !e.isPrivate && isOnSale(e) && (e.endDate || e.date || '') >= today)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .slice(0, 12);
  const items = listed
    .map((e) => {
      const image = e.coverImageMobile || e.coverImageDesktop || e.coverImageUrls?.[0] || e.coverImageUrl;
      const detail = [formatEventDate(e.date), e.isOnline ? 'Online' : e.venue].filter(Boolean).join(' · ');
      return [
        `<li><a href="${escapeAttr(`${basePath}/e/${buildEventSlugId(e.title, e.id)}`)}">`,
        image ? `<img src="${escapeAttr(image)}" alt="" />` : '',
        `<span><p>${escapeAttr(stripHtml(e.title || ''))}</p><p class="muted">${escapeAttr(detail)}</p></span>`,
        '</a></li>',
      ].join('');
    })
    .join('');
  return [
    '<div id="ssr-preview">',
    `<header>${escapeAttr(orgName)}</header>`,
    '<main>',
    items ? `<ul>${items}</ul>` : '<p class="muted">No upcoming events right now.</p>',
    '</main></div>',
  ].join('');
};

// Link-preview tags for every page, plus storefront data + preview for a
// store's home and event pages (null if this isn't a storefront URL).
const resolvePage = async (hostname, pathname, pageUrl) => {
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);

  let companyId;
  let rest;
  let basePath = '';
  const subdomain = getSubdomain(hostname);
  if (subdomain) {
    companyId = await resolveCompanyIdBySubdomain(subdomain);
    if (!companyId) return null;
    rest = segments;
  } else if (segments[0] === 'public' && segments[1]) {
    companyId = segments[1];
    rest = segments.slice(2);
    basePath = `/public/${encodeURIComponent(companyId)}`;
  } else {
    return null;
  }

  const isEventPage = rest[0] === 'e' && rest[1];
  // Checkout and policy pages keep just their link-preview tags.
  if (!isEventPage && rest.length > 0) return { meta: await buildStoreMeta(companyId) };

  const company = await loadCompany(companyId);
  if (!company) return { meta: null };
  const orgName = company.seed.company.organizationName || company.name || '';
  const seedBase = { v: 1, path: pathname, companyId, ...company.seed };

  if (isEventPage) {
    const eventId = parseEventIdFromSlug(rest[1]);
    const [meta, event] = await Promise.all([buildEventMeta(companyId, rest[1]), loadEvent(companyId, eventId)]);
    const live = event && event.status === 'published' ? { id: eventId, ...event } : null;
    return {
      meta,
      seed: { ...seedBase, events: live ? [toSeedEvent(live)] : [] },
      preview: live && !live.isPrivate && isOnSale(live) ? renderEventPreview(live, orgName, pageUrl) : '',
    };
  }

  const [meta, events] = await Promise.all([buildStoreMeta(companyId), loadPublishedEvents(companyId)]);
  const complete = events.length <= MAX_SEEDED_EVENTS;
  return {
    meta,
    seed: { ...seedBase, events: complete ? events.filter((e) => !e.isPrivate).map(toSeedEvent) : null },
    preview: complete ? renderStorePreview(orgName, events, basePath) : '',
  };
};

const renderIndexHtml = (meta, pageUrl, origin, page) => {
  const title = meta?.title || 'Outsold';
  const description = meta?.description || 'Discover events and book tickets on Outsold.';
  const image = meta?.image || `${origin}/Outsold.png`;
  const siteName = meta?.siteName || 'Outsold';
  const tags = [
    `<title>${escapeAttr(title)}</title>`,
    `<meta name="description" content="${escapeAttr(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeAttr(siteName)}" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    `<meta property="og:url" content="${escapeAttr(pageUrl)}" />`,
    `<meta property="og:image" content="${escapeAttr(image)}" />`,
    `<meta property="og:image:secure_url" content="${escapeAttr(image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(image)}" />`,
  ].join('\n  ');
  let html = indexHtml.replace(/<title>[^<]*<\/title>/, tags);
  if (page?.seed || page?.preview) {
    // `<` escaped so nothing in the data can close the script tag early.
    const seedTag = page.seed
      ? `<script id="storefront-data" type="application/json">${JSON.stringify(page.seed).replace(/</g, '\\u003c')}</script>`
      : '';
    const previewTags = page.preview ? `<style>${PREVIEW_CSS}</style>${page.preview}` : '';
    html = html.replace('<div id="root"></div>', `${previewTags}<div id="root"></div>${seedTag}`);
  }
  return html;
};

// Serve static assets from the Vite build directory. Filenames are
// content-hashed by Vite, so once a hash is served its contents never
// change — safe to cache for a year. `index: false` keeps "/" from being
// auto-served as the raw dist/index.html, so it goes through the catch-all
// below and gets its link-preview tags like every other page.
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '1y',
  immutable: true,
  index: false,
  setHeaders: (res, filePath) => {
    // Direct requests for /index.html still hit this middleware — keep the
    // shell no-cache so it can never pin a stale set of chunk hashes.
    if (path.basename(filePath) === 'index.html') {
      res.set('Cache-Control', 'no-cache');
    }
  },
}));

// SPA Catch-all: Route all other requests to index.html. `{*splat}` (optional)
// rather than `*splat` so the bare "/" — a store's home on its subdomain —
// matches too.
app.get('/{*splat}', async (req, res) => {
  // Guard against missing static assets
  // If the request path looks like a file (has an extension), return 404 instead of index.html
  if (req.path.match(/\.[a-zA-Z0-9]+$/)) {
    return res.status(404).send('Not Found');
  }

  const host = req.get('x-forwarded-host') || req.get('host') || '';
  const hostname = host.split(':')[0].toLowerCase();
  const origin = `https://${host}`;

  const pageUrl = `${origin}${req.originalUrl}`;
  let page = null;
  try {
    page = await resolvePage(hostname, req.path, pageUrl);
  } catch (err) {
    // A slow/failed lookup must never block the page — fall back to the
    // generic Outsold preview, and the client loads its data itself as before.
    console.error('Page lookup failed:', req.path, err?.message || err);
  }

  // Always revalidate the HTML shell so a new deploy's asset hashes are
  // picked up immediately — a stale cached copy here would reference JS
  // chunks that no longer exist post-deploy and 404 on load.
  res.set('Cache-Control', 'no-cache');
  res.type('html').send(renderIndexHtml(page?.meta ?? null, pageUrl, origin, page));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
