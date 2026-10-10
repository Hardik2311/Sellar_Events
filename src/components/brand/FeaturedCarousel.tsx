import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Sparkles } from 'lucide-react';
import BrandButton from './BrandButton';
import BrandTag from './BrandTag';

export interface FeaturedSlide {
  id: string;
  /** Small tag top-left, e.g. "Featured". */
  eyebrow: string;
  title: React.ReactNode;
  /** Plain-text title for alt text / aria labels. */
  titleText: string;
  dateLabel?: string;
  venueLabel?: string;
  priceLabel?: string;
  desktopImage?: string | null;
  mobileImage?: string | null;
  gradientClass?: string;
  ctaLabel: string;
  onCta: () => void;
}

interface FeaturedCarouselProps {
  slides: FeaturedSlide[];
  /** Auto-advance interval; restarts whenever the slide changes (incl. manual navigation). */
  intervalMs?: number;
  className?: string;
}

const SWIPE_THRESHOLD_PX = 40;

// Edge-to-edge hero slideshow for the customer Discover page — one slide per
// featured event (plus an optional brand slide), crossfading, with arrows on
// the middle left/right, dots, swipe on touch and auto-advance. Images always
// fill the slide (object-cover); copy aligns with the page's content column.
const CONTENT_COLUMN = 'mx-auto w-full max-w-[1440px] px-4 sm:px-8 lg:px-24';
const FeaturedCarousel: React.FC<FeaturedCarouselProps> = ({ slides, intervalMs = 4000, className = '' }) => {
  const [active, setActive] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const count = slides.length;
  const current = Math.min(active, Math.max(count - 1, 0));

  const go = useCallback((next: number) => setActive(((next % count) + count) % count), [count]);

  // One timeout per slide, keyed on `current`: clicking an arrow/dot or
  // swiping restarts the countdown instead of jumping again moments later.
  // No pause-on-hover — the hero is huge, so the cursor almost always sits on
  // it and the show would never move.
  useEffect(() => {
    if (count <= 1) return;
    const timer = window.setTimeout(() => setActive((current + 1) % count), intervalMs);
    return () => window.clearTimeout(timer);
  }, [current, count, intervalMs]);

  if (count === 0) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    go(current + (delta < 0 ? 1 : -1));
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured events"
      className={`relative h-[480px] w-full overflow-hidden bg-[var(--brand-black)] sm:h-[460px] lg:h-[560px] ${className}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {slides.map((slide, i) => {
        const isActive = i === current;
        return (
          <div
            key={slide.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}: ${slide.titleText}`}
            aria-hidden={!isActive}
            className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${isActive ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          >
            {/* Background — always fills the slide; mobile prefers the portrait cover */}
            <div className={`absolute inset-0 bg-gradient-to-br ${slide.gradientClass ?? 'from-slate-700 to-slate-900'}`}>
              {(slide.mobileImage || slide.desktopImage) && (
                <img
                  src={(slide.mobileImage || slide.desktopImage)!}
                  alt={slide.titleText}
                  className="absolute inset-0 h-full w-full object-cover sm:hidden"
                />
              )}
              {(slide.desktopImage || slide.mobileImage) && (
                <img
                  src={(slide.desktopImage || slide.mobileImage)!}
                  alt={slide.titleText}
                  className="absolute inset-0 hidden h-full w-full object-cover sm:block"
                />
              )}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 sm:bg-gradient-to-r sm:from-black/85 sm:via-black/45 sm:to-transparent" />

            {/* Copy */}
            <div className={`absolute inset-x-0 bottom-0 pb-12 lg:pb-14 ${CONTENT_COLUMN}`}>
              <div className="max-w-2xl">
                <BrandTag variant="featured" icon={Sparkles}>{slide.eyebrow}</BrandTag>
                <h2 className="brand-display mt-4 line-clamp-2 text-[40px] leading-[0.95] text-[var(--brand-cream)] sm:text-5xl lg:text-[64px]">
                  {slide.title}
                </h2>

                {(slide.dateLabel || slide.venueLabel) && (
                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[15px] font-medium text-[#c9c4b8]">
                    {slide.dateLabel && (
                      <span className="flex items-center gap-1.5">
                        <CalendarDays size={15} className="shrink-0 text-[var(--brand-yellow)]" /> {slide.dateLabel}
                      </span>
                    )}
                    {slide.venueLabel && (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <MapPin size={15} className="shrink-0 text-[var(--brand-yellow)]" />
                        <span className="truncate">{slide.venueLabel}</span>
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-5">
                  <BrandButton variant="onInk" onClick={slide.onCta} tabIndex={isActive ? 0 : -1}>
                    {slide.ctaLabel}
                  </BrandButton>
                  {slide.priceLabel && (
                    <span className="brand-display text-2xl tabular-nums text-[var(--brand-yellow)] sm:text-[28px]">{slide.priceLabel}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {count > 1 && (
        <>
          {/* Arrows — vertically centred on the left/right edges (phones swipe instead) */}
          <button
            type="button"
            onClick={() => go(current - 1)}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-sm border border-white/20 bg-black/50 text-white transition hover:border-[var(--brand-yellow)] hover:bg-[var(--brand-yellow)] hover:text-black sm:flex lg:left-6"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => go(current + 1)}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-sm border border-white/20 bg-black/50 text-white transition hover:border-[var(--brand-yellow)] hover:bg-[var(--brand-yellow)] hover:text-black sm:flex lg:right-6"
          >
            <ChevronRight size={20} />
          </button>

          {/* Dots */}
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 sm:bottom-5">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === current}
                className={`h-1.5 rounded-sm transition-all ${i === current ? 'w-8 bg-[var(--brand-yellow)]' : 'w-1.5 bg-white/50 hover:bg-white/80'}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default FeaturedCarousel;
