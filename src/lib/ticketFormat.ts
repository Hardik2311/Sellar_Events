import { formatTime } from '../data/events';

// Formatting and link helpers shared by the ticket PDF and the on-screen
// ticket (TicketConfirmation), so both show the same values.

export type RGB = [number, number, number];

// Design default for the strip under a poster when no colour can be picked.
export const DEFAULT_ACCENT: RGB = [189, 128, 77];
export const rgbToCss = ([r, g, b]: RGB) => `rgb(${r} ${g} ${b})`;

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const parseIsoDate = (iso?: string) => {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
};
// "Thu, 15 Oct 2026"
export const formatFullDate = (d: Date) => `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
// "Thu, 15 Oct"
export const formatDayMonth = (d: Date) => `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
// "18:00" -> "6:00 PM"; anything that isn't HH:MM is shown as typed
export const formatClock = (t?: string | null) => {
  if (!t) return '';
  return /^\d{1,2}:\d{2}/.test(t) ? formatTime(t) : t;
};
export const formatAmount = (amount: number | undefined, rupee: string) => {
  if (!amount) return 'Free';
  const hasPaise = Math.round(amount * 100) % 100 !== 0;
  return `${rupee}${amount.toLocaleString('en-IN', {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: hasPaise ? 2 : 0,
  })}`;
};
// "sachin@gmail.com" -> "sa••••••@gmail.com"
export const maskEmail = (email: string) => {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 2)}••••••@${domain}`;
};
// "+91 8812345117" -> "+91 88••• ••117"
export const maskPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return phone;
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  const cc = digits.length > 10 ? `+${digits.slice(0, digits.length - 10)} ` : '';
  return `${cc}${local.slice(0, 2)}••• ••${local.slice(-3)}`;
};

const pad2 = (n: number) => n.toString().padStart(2, '0');
const toCalStamp = (d: Date) =>
  `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
const toCalDay = (d: Date) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;

export const buildCalendarUrl = (title: string, date: Date, time: string | undefined, location: string) => {
  let dates: string;
  const m = time?.match(/^(\d{1,2}):(\d{2})/);
  if (m) {
    const start = new Date(date);
    start.setHours(Number(m[1]), Number(m[2]));
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
    dates = `${toCalStamp(start)}/${toCalStamp(end)}`;
  } else {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    dates = `${toCalDay(date)}/${toCalDay(next)}`; // all-day: end date is exclusive
  }
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dates}&ctz=Asia/Kolkata&location=${encodeURIComponent(location)}`;
};

// Multi-line rich-text (title / consent / good-to-know): block tags and <br>
// become newlines so each line stays separate.
export function htmlToPlainLines(html: string): string {
  return html
    .replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|ul|ol|tr)>/gi, '\n')
    .replace(/<(p|div|li|h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export const buildDirectionsUrl = (venue: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`;

// Picks the poster's dominant vibrant colour for the accent strip under the
// ticket hero (PDF and on-screen): buckets pixels by quantized colour, skipping near-white/near-black/
// gray pixels so we land on a real colour instead of "average brownish gray".
export function extractAccentColor(dataUrl: string): Promise<RGB> {
  return new Promise((resolve) => {
    const fallback = DEFAULT_ACCENT;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const size = 60;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(fallback); return; }
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 200) continue;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const lightness = (max + min) / 2;
          const sat = max === min ? 0 : (max - min) / (255 - Math.abs(2 * lightness - 255));
          if (lightness > 235 || lightness < 40 || sat < 0.25) continue; // white/black/gray/dimmed backdrop — skip
          const key = `${r >> 4}-${g >> 4}-${b >> 4}`; // quantize to 16 levels/channel
          const bucket = buckets.get(key);
          if (bucket) { bucket.count++; bucket.r += r; bucket.g += g; bucket.b += b; }
          else buckets.set(key, { count: 1, r, g, b });
        }

        let best: { count: number; r: number; g: number; b: number } | null = null;
        for (const v of buckets.values()) {
          if (!best || v.count > best.count) best = v;
        }
        if (!best) { resolve(fallback); return; }
        resolve([
          Math.round(best.r / best.count),
          Math.round(best.g / best.count),
          Math.round(best.b / best.count),
        ]);
      } catch {
        resolve(fallback);
      }
    };

    img.onerror = () => resolve(fallback);
    img.src = dataUrl;
  });
}
