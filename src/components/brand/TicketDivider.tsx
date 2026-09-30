import React from 'react';

interface TicketDividerProps {
  /** Must match the background color of the *containing* card so the punch-hole illusion works. */
  notchColor?: string;
  className?: string;
}

// A dashed perforation line with two circular "punch holes" at the edges —
// the containing card must have `overflow-hidden` so the outer half of each
// circle gets clipped, leaving a die-cut notch look.
const TicketDivider: React.FC<TicketDividerProps> = ({ notchColor = '#f4efe4', className = '' }) => (
  <div className={`relative h-px w-full ${className}`}>
    <div className="absolute inset-x-3 top-0 border-t-2 border-dashed border-black/15" />
    <div
      className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full"
      style={{ background: notchColor }}
    />
    <div
      className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full"
      style={{ background: notchColor }}
    />
  </div>
);

export default TicketDivider;
