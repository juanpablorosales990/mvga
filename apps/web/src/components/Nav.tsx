'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { Dictionary, Locale } from '@/i18n';

export default function Nav({ lang, dict }: { lang?: Locale; dict?: Dictionary }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const currentLang = lang || 'en';
  const otherLang = currentLang === 'en' ? 'es' : 'en';

  // Build the language toggle path
  const langTogglePath = pathname.replace(`/${currentLang}`, `/${otherLang}`) || `/${otherLang}`;

  const nav = dict?.nav;

  return (
    <nav className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-sm border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href={`/${currentLang}`} className="text-2xl font-black tracking-tighter uppercase">
          MVGA
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link
            href="#mission"
            className="text-sm text-white/50 hover:text-white tracking-wide uppercase transition animated-underline"
          >
            {nav?.whyMvga ?? 'Why MVGA'}
          </Link>
          <Link
            href="#features"
            className="text-sm text-white/50 hover:text-white tracking-wide uppercase transition animated-underline"
          >
            {nav?.features ?? 'Features'}
          </Link>
          <Link
            href="#faq"
            className="text-sm text-white/50 hover:text-white tracking-wide uppercase transition animated-underline"
          >
            {nav?.faq ?? 'FAQ'}
          </Link>
          <Link
            href={`/${currentLang}/grants`}
            className="text-sm text-white/50 hover:text-white tracking-wide uppercase transition animated-underline"
          >
            {nav?.grants ?? 'Grants'}
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={langTogglePath}
            className="text-xs font-mono text-white/40 hover:text-white border border-white/10 px-2.5 py-1.5 hover:border-white/30 transition uppercase tracking-wider"
            onClick={() => {
              document.cookie = `NEXT_LOCALE=${otherLang};path=/;max-age=31536000`;
            }}
          >
            {otherLang === 'es' ? 'ES' : 'EN'}
          </Link>
          <Link
            href="https://app.mvga.io"
            target="_blank"
            className="hidden md:inline-block bg-white text-black font-bold text-sm uppercase tracking-wider px-6 py-2.5 hover:bg-white/90 transition"
          >
            {nav?.openAccount ?? 'Open Account'}
          </Link>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex flex-col gap-1.5 p-2"
            aria-label="Toggle menu"
          >
            <span
              className={`block w-6 h-px bg-white transition-transform ${menuOpen ? 'rotate-45 translate-y-[3.5px]' : ''}`}
            />
            <span
              className={`block w-6 h-px bg-white transition-opacity ${menuOpen ? 'opacity-0' : ''}`}
            />
            <span
              className={`block w-6 h-px bg-white transition-transform ${menuOpen ? '-rotate-45 -translate-y-[3.5px]' : ''}`}
            />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-white/5 bg-black/95 backdrop-blur-sm">
          <div className="flex flex-col px-6 py-6 gap-4">
            <Link
              href="#mission"
              onClick={() => setMenuOpen(false)}
              className="text-sm text-white/50 hover:text-white uppercase tracking-wider"
            >
              {nav?.whyMvga ?? 'Why MVGA'}
            </Link>
            <Link
              href="#features"
              onClick={() => setMenuOpen(false)}
              className="text-sm text-white/50 hover:text-white uppercase tracking-wider"
            >
              {nav?.features ?? 'Features'}
            </Link>
            <Link
              href="#faq"
              onClick={() => setMenuOpen(false)}
              className="text-sm text-white/50 hover:text-white uppercase tracking-wider"
            >
              {nav?.faq ?? 'FAQ'}
            </Link>
            <Link
              href={`/${currentLang}/grants`}
              onClick={() => setMenuOpen(false)}
              className="text-sm text-white/50 hover:text-white uppercase tracking-wider"
            >
              {nav?.grants ?? 'Grants'}
            </Link>
            <div className="flex items-center gap-3 mt-2">
              <Link
                href={langTogglePath}
                onClick={() => {
                  document.cookie = `NEXT_LOCALE=${otherLang};path=/;max-age=31536000`;
                  setMenuOpen(false);
                }}
                className="text-xs font-mono text-white/40 hover:text-white border border-white/10 px-2.5 py-1.5 hover:border-white/30 transition uppercase tracking-wider"
              >
                {otherLang === 'es' ? 'Español' : 'English'}
              </Link>
            </div>
            <Link
              href="https://app.mvga.io"
              target="_blank"
              className="bg-white text-black font-bold text-sm uppercase tracking-wider px-6 py-3 text-center mt-2"
            >
              {nav?.openAccount ?? 'Open Account'}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
