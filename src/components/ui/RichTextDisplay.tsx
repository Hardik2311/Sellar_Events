import React, { type JSX } from 'react';
import { sanitizeRichText } from '../../lib/sanitizeRichText';

interface RichTextDisplayProps {
  html: string;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
}

// Tailwind classes container pe lagti hain; andar ka <b>/<i>/<span style=color>
// as-is render hota hai — ab formatting kabhi strip nahi hogi.
const RichTextDisplay: React.FC<RichTextDisplayProps> = ({ html, as: Tag = 'div', className, style }) => (
  <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }} />
);

export default RichTextDisplay;