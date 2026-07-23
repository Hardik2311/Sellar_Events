// ─────────────────────────────────────────────────────────────────────────
// Shared event data, types, and helpers.
// Both EventDiscover.tsx and EventDetail.tsx import from here so the two
// pages always agree on shape and formatting.
//
// TODO — backend wiring:
// Replace MOCK_EVENTS + the helpers that read it with real API calls, e.g.
//   GET /events?status=published            (discover page, list)
//   GET /events/:id                         (detail page, single event)
// Only status: 'published' events should ever reach customers — drafts
// stay organizer-only until published.
// ─────────────────────────────────────────────────────────────────────────

export interface PublicTicketTier {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sold: number;
}

export interface PublicEvent {
  id: string;
  title: string;
  category: string;
  customCategory?: string;
  description: string;
  date: string; // start date, ISO yyyy-mm-dd
  endDate: string;
  time: string; // 24hr HH:mm
  venue: string;
  isOnline: boolean;
  organizerName: string;
  coverImage: string | null;
  tiers: PublicTicketTier[];
  // Explicitly curated by the organizer/admin — not derived from sales or
  // date. Falls back to "soonest upcoming event" if nothing is flagged.
  featured?: boolean;
}

export const MOCK_EVENTS: PublicEvent[] = [
  {
    id: 'evt-comedy-01',
    title: 'Open Mic Comedy Night',
    category: 'Comedy',
    description:
      'A rowdy night of new material from the city\u2019s sharpest up-and-coming comics. Expect a few bits that bomb, a few that land hard, and a host who won\u2019t let anyone off easy. BYO thick skin.',
    date: '2026-07-25',
    endDate: '2026-07-25',
    time: '19:30',
    venue: 'Cafe Blend, Gomti Nagar, Lucknow',
    isOnline: false,
    organizerName: 'Blend Live',
    coverImage: null,
    featured: true,
    tiers: [
      { id: 't1', name: 'General', price: 199, quantity: 150, sold: 120 },
      { id: 't2', name: 'Front row', price: 349, quantity: 30, sold: 22 },
    ],
  },
  {
    id: 'evt-music-01',
    title: 'College Music Fest',
    category: 'Music',
    description:
      'Six bands, one stage, and a night that decides who\u2019s headlining next year. Food stalls open from 4pm, gates close at capacity.',
    date: '2026-08-02',
    endDate: '2026-08-02',
    time: '17:00',
    venue: 'Ambedkar Ground, Lucknow',
    isOnline: false,
    organizerName: 'Campus Beats',
    coverImage: null,
    tiers: [{ id: 't1', name: 'General', price: 499, quantity: 500, sold: 340 }],
  },
  {
    id: 'evt-workshop-01',
    title: 'Design Sprint Workshop',
    category: 'Workshop',
    description:
      'A hands-on half day taking one idea from sketch to tested prototype. Bring a laptop; everything else is provided. Recording shared with attendees afterward.',
    date: '2026-08-05',
    endDate: '2026-08-05',
    time: '10:00',
    venue: '',
    isOnline: true,
    organizerName: 'Studio North',
    coverImage: null,
    tiers: [{ id: 't1', name: 'Seat', price: 0, quantity: 200, sold: 188 }],
  },
  {
    id: 'evt-comedy-02',
    title: 'Stand-up Saturdays Vol. 2',
    category: 'Comedy',
    description: 'Back by popular demand \u2014 four comics, no filter, one very small stage.',
    date: '2026-08-09',
    endDate: '2026-08-09',
    time: '20:00',
    venue: 'The Attic, Hazratganj, Lucknow',
    isOnline: false,
    organizerName: 'Blend Live',
    coverImage: null,
    tiers: [{ id: 't1', name: 'General', price: 249, quantity: 80, sold: 80 }],
  },
  {
    id: 'evt-networking-01',
    title: 'Founders Fireside Chat',
    category: 'Networking',
    description:
      'An unscripted conversation with three founders about the year they almost quit. Q&A open floor for the last 20 minutes.',
    date: '2026-08-14',
    endDate: '2026-08-14',
    time: '18:30',
    venue: '',
    isOnline: true,
    organizerName: 'Startup Founders Collective',
    coverImage: null,
    tiers: [{ id: 't1', name: 'General', price: 0, quantity: 300, sold: 96 }],
  },
  {
    id: 'evt-other-01',
    title: 'Lucknow Food & Flea Market',
    category: 'Other',
    customCategory: 'Market',
    description: 'Local makers, street food stalls, and live music through the afternoon, both days.',
    date: '2026-08-16',
    endDate: '2026-08-17',
    time: '11:00',
    venue: 'Kukrail Riverside, Lucknow',
    isOnline: false,
    organizerName: 'Ganga Foundation',
    coverImage: null,
    tiers: [{ id: 't1', name: 'Entry', price: 99, quantity: 1000, sold: 410 }],
  },
];

export const CATEGORY_GRADIENTS: Record<string, string> = {
  Comedy: 'from-orange-200 to-amber-100',
  Music: 'from-rose-200 to-orange-100',
  Workshop: 'from-sky-200 to-orange-50',
  Networking: 'from-emerald-200 to-orange-50',
  Other: 'from-slate-200 to-orange-50',
};

export const getCategoryLabel = (e: PublicEvent) =>
  e.category === 'Other' && e.customCategory ? e.customCategory : e.category;

export const formatDateRange = (start: string, end: string) => {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const s = new Date(start).toLocaleDateString('en-IN', opts);
  if (start === end) return s;
  const e = new Date(end).toLocaleDateString('en-IN', opts);
  return `${s} \u2013 ${e}`;
};

export const formatTime = (time: string) => {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
};

export const getPriceLabel = (tiers: PublicTicketTier[]) => {
  if (!tiers.length) return 'Free';
  const lowest = Math.min(...tiers.map((t) => t.price));
  return lowest === 0 ? 'Free' : `From \u20B9${lowest.toLocaleString('en-IN')}`;
};

export const getAvailability = (tiers: PublicTicketTier[]) => {
  const totalQty = tiers.reduce((sum, t) => sum + t.quantity, 0);
  const totalSold = tiers.reduce((sum, t) => sum + t.sold, 0);
  const pct = totalQty ? Math.round((totalSold / totalQty) * 100) : 0;
  return { pct, soldOut: totalQty > 0 && totalSold >= totalQty, sellingFast: pct >= 80 && totalSold < totalQty };
};

// Picks the event to lead with on the discover page: an explicitly
// featured, published event first; otherwise the soonest upcoming one.
export const getFeaturedEvent = (events: PublicEvent[]): PublicEvent | undefined => {
  const flagged = events.find((e) => e.featured);
  if (flagged) return flagged;
  return [...events].sort((a, b) => a.date.localeCompare(b.date))[0];
};