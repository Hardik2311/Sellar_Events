import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const stripHtmlTags = (value?: string | null): string => {
  if (!value) return '';
  return value
    .replace(/<\/?[^>]+(>|$)/g, '')       // strip HTML tags
    .replace(/&nbsp;/gi, ' ')             // non-breaking space
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\u00A0/g, ' ')              // literal NBSP char, just in case
    .trim();
};