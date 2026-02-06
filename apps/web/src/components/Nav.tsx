'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-sm border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-black tracking-tighter uppercase">
          MVGA
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link
            href="#mission"
            className="text-sm text-white/50 hover:text-white tracking-wide uppercase transition animated-underline"
          >
            Mission
          </Link>
          <Link
            href="#features"
            className="text-sm text-white/50 hover:text-white tracking-wide uppercase transition animated-underline"
          >
            Features
          </Link>
          <Link
            href="#transparency"
            className="text-sm text-white/50 hover:text-white tracking-wide uppercase transition animated-underline"
          >
            Transparency
          </Link>
          <Link
            href="#tokenomics"
            className="text-sm text-white/50 hover:text-white tracking-wide uppercase transition animated-underline"
          >
            Tokenomics
          </Link>
          <Link
            href="/grants"
            className="text-sm text-white/50 hover:text-white tracking-wide uppercase transition animated-underline"
          >
            Grants
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="https://app.mvga.io"
            target="_blank"
            className="hidden md:inline-block bg-white text-black font-bold text-sm uppercase tracking-wider px-6 py-2.5 hover:bg-white/90 transition"
          >
            Launch App
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
              Mission
            </Link>
            <Link
              href="#features"
              onClick={() => setMenuOpen(false)}
              className="text-sm text-white/50 hover:text-white uppercase tracking-wider"
            >
              Features
            </Link>
            <Link
              href="#transparency"
              onClick={() => setMenuOpen(false)}
              className="text-sm text-white/50 hover:text-white uppercase tracking-wider"
            >
              Transparency
            </Link>
            <Link
              href="#tokenomics"
              onClick={() => setMenuOpen(false)}
              className="text-sm text-white/50 hover:text-white uppercase tracking-wider"
            >
              Tokenomics
            </Link>
            <Link
              href="/grants"
              onClick={() => setMenuOpen(false)}
              className="text-sm text-white/50 hover:text-white uppercase tracking-wider"
            >
              Grants
            </Link>
            <Link
              href="https://app.mvga.io"
              target="_blank"
              className="bg-white text-black font-bold text-sm uppercase tracking-wider px-6 py-3 text-center mt-2"
            >
              Launch App
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
