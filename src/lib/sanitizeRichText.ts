import DOMPurify from 'dompurify';

// Sirf wahi tags/attrs allow karo jo TextStyleControls / the contentEditable
// box actually generate. `div`/`p` are included because plain contentEditable
// wraps every Enter-separated line in its own <div> — without allowing them,
// DOMPurify strips the wrapper tags but keeps their text, silently merging
// every line into one run (blank lines survived before this fix only because
// an empty line becomes `<div><br></div>`, and `<br>` was already allowed).
const ALLOWED_TAGS = ['b', 'i', 'span', 'br', 'div', 'p'];
const ALLOWED_ATTR = ['style'];

export const sanitizeRichText = (html: string): string =>
  DOMPurify.sanitize(html ?? '', { ALLOWED_TAGS, ALLOWED_ATTR });