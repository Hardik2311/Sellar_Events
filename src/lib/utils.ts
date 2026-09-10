import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const stripHtmlTags = (value?: string | null): string => {
  if (!value) return '';
  return value
    // line-break wale tags ko pehle \n me convert karo, warna
    // strip karte hi saara text ek hi line me chipak jaata hai
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')       // baaki saare HTML tags strip karo
    .replace(/&nbsp;/gi, ' ')             // non-breaking space
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\u00A0/g, ' ')              // literal NBSP char, just in case
    .replace(/\n{3,}/g, '\n\n')           // extra khaali lines collapse karo
    .trim();
};