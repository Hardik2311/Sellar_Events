import React from 'react';

interface CoverImageDisplayProps {
  desktopSrc?: string | null;
  mobileSrc?: string | null;
  alt: string;
}

// Both uploaded → each size shows its own crop via object-cover.
// Only one uploaded → letterbox it with object-contain over a blurred,
// zoomed copy of itself instead of stretching or awkward cropping.
const CoverImageDisplay: React.FC<CoverImageDisplayProps> = ({ desktopSrc, mobileSrc, alt }) => {
  if (desktopSrc && mobileSrc) {
    return (
      <>
        <img src={mobileSrc} alt={alt} className="absolute inset-0 h-full w-full object-cover sm:hidden" />
        <img src={desktopSrc} alt={alt} className="absolute inset-0 hidden h-full w-full object-cover sm:block" />
      </>
    );
  }

  const single = desktopSrc || mobileSrc;
  if (!single) return null;

  return (
    <>
      <img src={single} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl opacity-70" />
      <img src={single} alt={alt} className="absolute inset-0 h-full w-full object-contain" />
    </>
  );
};

export default CoverImageDisplay;