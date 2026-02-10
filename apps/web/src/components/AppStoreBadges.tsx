import Link from 'next/link';

// Placeholder URLs — replace with real App Store / Play Store links once published
const APP_STORE_URL = '#';
const PLAY_STORE_URL = '#';

export default function AppStoreBadges({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-4 ${className}`}>
      {/* Apple App Store */}
      <Link
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download on the App Store"
        className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-5 py-2.5 hover:bg-white/10 transition-all group"
      >
        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
        </svg>
        <div className="text-left">
          <div className="text-[10px] text-white/50 leading-none">Download on the</div>
          <div className="text-sm font-semibold text-white leading-tight">App Store</div>
        </div>
      </Link>

      {/* Google Play Store */}
      <Link
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Get it on Google Play"
        className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-5 py-2.5 hover:bg-white/10 transition-all group"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
          <path
            d="M3.61 1.814L13.793 12 3.61 22.186a.996.996 0 01-.61-.92V2.734c0-.384.22-.72.61-.92z"
            fill="#4285F4"
          />
          <path
            d="M17.12 8.68L5.38.75c-.38-.26-.84-.34-1.28-.23L13.793 12l3.327-3.32z"
            fill="#34A853"
          />
          <path
            d="M17.12 15.32L13.793 12l3.327-3.32 3.66 2.06c.67.37.67 1.15 0 1.52l-3.66 2.06z"
            fill="#FBBC04"
          />
          <path
            d="M4.1 23.48c.44.11.9.03 1.28-.23l11.74-7.93L13.793 12 4.1 23.48z"
            fill="#EA4335"
          />
        </svg>
        <div className="text-left">
          <div className="text-[10px] text-white/50 leading-none">Get it on</div>
          <div className="text-sm font-semibold text-white leading-tight">Google Play</div>
        </div>
      </Link>
    </div>
  );
}
