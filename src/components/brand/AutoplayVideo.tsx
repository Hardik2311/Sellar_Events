import React, { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

interface AutoplayVideoProps {
  src: string;
  className?: string;
}

// Gallery video tile: plays muted on a loop while it's on screen and pauses
// when scrolled away (saves battery and data). Visitors who prefer reduced
// motion get the still first frame with a play badge instead.
const AutoplayVideo: React.FC<AutoplayVideoProps> = ({ src, className = '' }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduceMotion) return;
    video.muted = true; // browsers only allow autoplay when muted
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.25 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [reduceMotion, src]);

  return (
    <>
      <video
        ref={videoRef}
        // #t=0.1 makes Safari paint the first frame when the video isn't playing
        src={reduceMotion ? `${src}#t=0.1` : src}
        className={className}
        muted
        loop
        playsInline
        autoPlay={!reduceMotion}
        preload={reduceMotion ? 'metadata' : 'auto'}
        aria-hidden="true"
      />
      {reduceMotion && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--brand-black)]/60 text-[var(--brand-cream)]">
          <Play size={20} className="ml-0.5 fill-current" aria-hidden="true" />
        </span>
      )}
    </>
  );
};

export default AutoplayVideo;
