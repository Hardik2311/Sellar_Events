import React from 'react';

interface CoverImageDisplayProps {
  desktopSrc?: string | null;
  mobileSrc?: string | null;
  alt: string;
  /**
   * The container is sized to each uploaded cover's own aspect ratio
   * (mobile 4:5, desktop 8:3), so a cover uploaded for that screen size
   * fills it edge to edge (object-cover) instead of being letterboxed.
   */
  fill?: boolean;
}

// Full image, never cropped, over a blurred + zoomed copy of itself.
const Letterboxed: React.FC<{ src: string; alt: string; className: string }> = ({ src, alt, className }) => (
  <>
    <img src={src} alt="" aria-hidden className={`absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl ${className}`} />
    <img src={src} alt={alt} className={`absolute inset-0 h-full w-full object-contain ${className}`} />
  </>
);

// Each screen size shows its own cover; a size that wasn't uploaded borrows the
// other one, letterboxed over a blurred copy instead of stretched or cropped.
// With `fill`, a cover shown at its own size covers the whole container.
const CoverImageDisplay: React.FC<CoverImageDisplayProps> = ({ desktopSrc, mobileSrc, alt, fill = false }) => {
  const mobile = mobileSrc || desktopSrc;
  const desktop = desktopSrc || mobileSrc;
  if (!mobile || !desktop) return null;

  return (
    <>
      {/* Mobile */}
      {fill && mobileSrc ? (
        <img src={mobileSrc} alt={alt} className="absolute inset-0 h-full w-full object-cover sm:hidden" />
      ) : (
        <Letterboxed src={mobile} alt={alt} className="sm:hidden" />
      )}
      {/* Desktop */}
      {fill && desktopSrc ? (
        <img src={desktopSrc} alt={alt} className="absolute inset-0 hidden h-full w-full object-cover sm:block" />
      ) : (
        <Letterboxed src={desktop} alt={alt} className="hidden sm:block" />
      )}
    </>
  );
};

export default CoverImageDisplay;
