import DOMPurify from 'dompurify';

// Sirf wahi tags/attrs allow karo jo TextStyleControls actually generate karta hai
const ALLOWED_TAGS = ['b', 'i', 'span', 'br'];
const ALLOWED_ATTR = ['style'];

export const sanitizeRichText = (html: string): string =>
  DOMPurify.sanitize(html ?? '', { ALLOWED_TAGS, ALLOWED_ATTR });