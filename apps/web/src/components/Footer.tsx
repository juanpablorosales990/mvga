import Link from 'next/link';
import AppStoreBadges from './AppStoreBadges';

export default function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <span className="text-xl font-black tracking-tighter uppercase">MVGA</span>
            <p className="text-white/30 text-sm mt-1 font-mono">Digital dollars for Venezuela</p>
            <AppStoreBadges className="mt-4" />
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm text-white/30">
            <Link href="/privacy" className="hover:text-white transition">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white transition">
              Terms
            </Link>
            <a
              href="https://github.com/juanpablorosales990/mvga"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition"
            >
              GitHub
            </a>
            <a
              href="https://t.me/mvga"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition"
            >
              Telegram
            </a>
            <a
              href="https://twitter.com/mvga"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition"
            >
              X / Twitter
            </a>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-white/5 text-xs text-white/20 font-mono">
          Send, spend, save, and earn &mdash; all from one app. Made by Venezuelans, for
          Venezuelans. 100% open source.
        </div>
      </div>
    </footer>
  );
}
