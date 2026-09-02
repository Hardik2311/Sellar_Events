import React from 'react';
import {
  Music,
  Headphones,
  PartyPopper,
  Ticket,
  Mic2,
  Popcorn,
  Camera,
  Disc3,
  Volume2,
  Sparkles,
} from 'lucide-react';

interface FloatingIconConfig {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  top: string;
  left: string;
  size: number;
  delay: string;
  duration: string;
  opacity: number;
}

// Event-related icons scattered across the panel — tweak position/size/opacity as needed
// Used on desktop, where the hero panel has plenty of height (full screen height).
const icons: FloatingIconConfig[] = [
  { Icon: Music,       top: '12%', left: '16%', size: 40, delay: '0s',    duration: '2.6s', opacity: 0.8 },
  { Icon: Camera,      top: '10%', left: '80%', size: 32, delay: '0.2s',  duration: '2.6s', opacity: 0.7 },
  { Icon: Headphones,  top: '26%', left: '68%', size: 50, delay: '0.6s',  duration: '3s',   opacity: 0.75 },
  { Icon: PartyPopper, top: '55%', left: '8%',  size: 38, delay: '0.3s',  duration: '2.4s', opacity: 0.75 },
  { Icon: Mic2,        top: '38%', left: '40%', size: 34, delay: '0.4s',  duration: '2.8s', opacity: 0.65 },
  { Icon: Disc3,       top: '18%', left: '45%', size: 36, delay: '0.5s',  duration: '3.2s', opacity: 0.6 },
  { Icon: Ticket,      top: '70%', left: '58%', size: 44, delay: '0.8s',  duration: '3.4s', opacity: 0.75 },
  { Icon: Popcorn,     top: '82%', left: '22%', size: 42, delay: '1s',    duration: '3.2s', opacity: 0.75 },
  { Icon: Volume2,     top: '62%', left: '80%', size: 34, delay: '0.7s',  duration: '2.7s', opacity: 0.65 },
  { Icon: Sparkles,    top: '48%', left: '82%', size: 28, delay: '0.1s',  duration: '2.2s', opacity: 0.6 },
  { Icon: Sparkles,    top: '8%',  left: '55%', size: 22, delay: '0.9s',  duration: '2.5s', opacity: 0.55 },
];

// Mobile-safe set — the mobile hero panel is short (h-64), and the center
// column (roughly left 32%–68%, top 20%–95%) is occupied by the calendar
// badge + "Sellar Events" title + subtitle. So icons are kept OFF to the
// left and right edges (left <22% or >78%) at varying heights, instead of
// squeezed into a thin top strip — keeps the panel feeling full without
// ever sitting on top of the text.
const mobileIcons: FloatingIconConfig[] = [
  // Left column
  { Icon: Music,       top: '8%',  left: '10%', size: 26, delay: '0s',   duration: '2.6s', opacity: 0.8 },
  { Icon: PartyPopper,  top: '32%', left: '6%',  size: 24, delay: '0.3s', duration: '2.4s', opacity: 0.7 },
  { Icon: Disc3,        top: '58%', left: '10%', size: 24, delay: '0.6s', duration: '3s',   opacity: 0.6 },
  { Icon: Ticket,        top: '82%', left: '8%',  size: 24, delay: '0.8s', duration: '3.2s', opacity: 0.7 },
  // Right column
  { Icon: Camera,       top: '7%',  left: '80%', size: 22, delay: '0.2s', duration: '2.6s', opacity: 0.7 },
  { Icon: Headphones,   top: '30%', left: '84%', size: 28, delay: '0.5s', duration: '3s',   opacity: 0.7 },
  { Icon: Sparkles,     top: '55%', left: '88%', size: 18, delay: '0.4s', duration: '2.4s', opacity: 0.6 },
  { Icon: Volume2,      top: '80%', left: '82%', size: 22, delay: '0.7s', duration: '2.8s', opacity: 0.6 },
];

// A couple of little "beat bar" / equalizer clusters for extra music vibe
// (desktop only — see showBeatClusters below)
const beatClusters = [
  { top: '46%', left: '18%', delay: '0s' },
  { top: '74%', left: '72%', delay: '0.6s' },
  { top: '20%', left: '30%', delay: '1.1s' },
];

interface FloatingEventIconsProps {
  /** Tailwind text-color class applied to every icon. Defaults to white. */
  iconClassName?: string;
  /**
   * 'desktop' (default) uses the full spread of icons across the tall panel.
   * 'mobile' switches to a smaller top/bottom-safe set that avoids the
   * center text zone on the short mobile hero banner.
   */
  variant?: 'desktop' | 'mobile';
}

const BeatBars: React.FC<{ colorClassName: string }> = ({ colorClassName }) => (
  <div className="flex items-end gap-[3px] h-6">
    {[0, 1, 2, 3].map((i) => (
      <span
        key={i}
        className={`w-[3px] rounded-full animate-beat ${colorClassName}`}
        style={{ animationDelay: `${i * 0.15}s` }}
      />
    ))}
  </div>
);

/**
 * Purely decorative — sits absolutely inside a `position: relative` parent
 * (the AuthHeroPanel wrapper) and floats subtly. No pointer events, no impact
 * on layout or functionality.
 */
const FloatingEventIcons: React.FC<FloatingEventIconsProps> = ({
  iconClassName = 'text-white',
  variant = 'desktop',
}) => {
  const activeIcons = variant === 'mobile' ? mobileIcons : icons;
  const showBeatClusters = variant !== 'mobile'; // keep center clusters off the short mobile banner

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-20">
      {activeIcons.map(({ Icon, top, left, size, delay, duration, opacity }, i) => (
        <span
          key={i}
          className={`absolute animate-float-slow ${iconClassName}`}
          style={{ top, left, opacity, animationDelay: delay, animationDuration: duration }}
        >
          <Icon size={size} strokeWidth={1.5} />
        </span>
      ))}

      {showBeatClusters &&
        beatClusters.map(({ top, left, delay }, i) => (
          <span
            key={`beat-${i}`}
            className="absolute opacity-70"
            style={{ top, left, animationDelay: delay }}
          >
            <BeatBars colorClassName={iconClassName.replace('text-', 'bg-')} />
          </span>
        ))}

      <style>{`
        @keyframes float-slow {
          0%   { transform: translateY(0px) rotate(0deg); }
          50%  { transform: translateY(-18px) rotate(6deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        .animate-float-slow {
          animation-name: float-slow;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
        @keyframes beat {
          0%, 100% { height: 6px; }
          50% { height: 22px; }
        }
        .animate-beat {
          animation-name: beat;
          animation-duration: 0.6s;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  );
};

export default FloatingEventIcons;