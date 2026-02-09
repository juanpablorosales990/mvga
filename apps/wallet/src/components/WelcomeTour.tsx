import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useWalletStore } from '../stores/walletStore';

const SLIDES = [
  {
    icon: (
      <svg
        className="w-16 h-16 text-gold-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    titleKey: 'tour.slide1Title',
    descKey: 'tour.slide1Desc',
  },
  {
    icon: (
      <svg
        className="w-16 h-16 text-gold-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7 11l5-5m0 0l5 5m-5-5v12"
        />
      </svg>
    ),
    titleKey: 'tour.slide2Title',
    descKey: 'tour.slide2Desc',
  },
  {
    icon: (
      <svg
        className="w-16 h-16 text-gold-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
        />
      </svg>
    ),
    titleKey: 'tour.slide3Title',
    descKey: 'tour.slide3Desc',
  },
  {
    icon: (
      <svg
        className="w-16 h-16 text-gold-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
    titleKey: 'tour.slide4Title',
    descKey: 'tour.slide4Desc',
  },
];

export default function WelcomeTour() {
  const { t } = useTranslation();
  const completeTour = useWalletStore((s) => s.completeTour);
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(0);

  const isLast = current === SLIDES.length - 1;

  const next = useCallback(() => {
    if (isLast) {
      completeTour();
    } else {
      setCurrent((c) => c + 1);
    }
  }, [isLast, completeTour]);

  const prev = useCallback(() => {
    if (current > 0) setCurrent((c) => c - 1);
  }, [current]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(dx) > 50) {
        if (dx < 0) next();
        else prev();
      }
    },
    [next, prev]
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Skip button */}
      <div className="flex justify-end p-4">
        <button
          onClick={completeTour}
          className="text-white/40 text-sm font-mono uppercase tracking-wider hover:text-white/60 transition"
        >
          {t('tour.skip')}
        </button>
      </div>

      {/* Slides */}
      <div className="flex-1 overflow-hidden relative">
        <div
          className="flex h-full"
          style={{
            transform: `translateX(-${current * 100}%)`,
            transition: 'transform 0.3s ease-out',
          }}
        >
          {SLIDES.map((slide, i) => (
            <div
              key={i}
              className="min-w-full h-full flex flex-col items-center justify-center px-8 text-center"
            >
              <div className="mb-8 w-24 h-24 border border-gold-500/30 flex items-center justify-center">
                {slide.icon}
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tight mb-4">
                {t(slide.titleKey)}
              </h2>
              <p className="text-white/50 text-base max-w-xs font-mono">{t(slide.descKey)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom: dots + button */}
      <div className="p-8 flex flex-col items-center gap-6">
        {/* Dot indicators */}
        <div className="flex gap-2">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 transition-all duration-300 ${
                i === current ? 'bg-gold-500 w-6' : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Action button */}
        <button
          onClick={next}
          className="w-full max-w-xs py-4 bg-gold-500 text-black font-bold uppercase tracking-wider text-sm hover:bg-gold-400 transition"
        >
          {isLast ? t('tour.getStarted') : t('tour.next')}
        </button>
      </div>
    </div>
  );
}
