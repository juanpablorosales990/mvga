import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { faqDatabase } from '../lib/faqDatabase';

const CATEGORIES = [
  'getting-started',
  'deposits',
  'sending',
  'p2p',
  'card',
  'savings',
  'cashout',
  'security',
  'fees',
] as const;

const CAT_LABEL_KEYS: Record<string, string> = {
  'getting-started': 'help.catGettingStarted',
  deposits: 'help.catDeposits',
  sending: 'help.catSending',
  p2p: 'help.catP2P',
  card: 'help.catCard',
  savings: 'help.catSavings',
  cashout: 'help.catCashOut',
  security: 'help.catSecurity',
  fees: 'help.catFees',
};

export default function HelpPage() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<number | null>(null);

  // Build flat FAQ list preserving category order
  const faqs = CATEGORIES.flatMap((cat) =>
    faqDatabase
      .filter((f) => f.category === cat)
      .map((f) => ({ q: t(f.question), a: t(f.answer), cat }))
  );

  let lastCat = '';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/more" className="text-gray-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold">{t('help.title')}</h1>
      </div>

      <p className="text-gray-400">{t('help.subtitle')}</p>

      {/* Self-custody disclaimer banner */}
      <div className="border border-gold-500/30 bg-gold-500/5 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-gold-500 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <p className="text-gold-500 text-sm font-medium">{t('disclaimer.title')}</p>
        </div>
        <p className="text-white/50 text-xs leading-relaxed">{t('disclaimer.helpBanner')}</p>
        <a
          href="https://mvga.io/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold-500 text-xs font-mono hover:underline"
        >
          {t('disclaimer.termsLink')} &rarr;
        </a>
      </div>

      {/* FAQ list grouped by category */}
      <div className="space-y-3">
        {faqs.map((faq, i) => {
          const showHeader = faq.cat !== lastCat;
          lastCat = faq.cat;
          return (
            <div key={i}>
              {showHeader && (
                <p className="text-xs tracking-[0.2em] text-white/20 uppercase font-mono mt-4 mb-2">
                  {t(CAT_LABEL_KEYS[faq.cat])}
                </p>
              )}
              <div className="card overflow-hidden">
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <span className="font-medium pr-4 text-sm">{faq.q}</span>
                  <svg
                    className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open === i ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {open === i && (
                  <div className="px-4 pb-4 text-gray-400 text-sm leading-relaxed border-t border-white/5 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">{t('help.needMore')}</h2>
        <div className="space-y-2">
          <a
            href="https://t.me/mvgacommunity"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 text-sm text-gray-300 hover:text-white transition"
          >
            <span className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400">
              T
            </span>
            Telegram
          </a>
          <a
            href="https://x.com/mvgaproject"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 text-sm text-gray-300 hover:text-white transition"
          >
            <span className="w-8 h-8 bg-gray-500/20 rounded-full flex items-center justify-center text-gray-400">
              X
            </span>
            Twitter / X
          </a>
          <a
            href="mailto:support@mvga.io"
            className="flex items-center gap-3 text-sm text-gray-300 hover:text-white transition"
          >
            <span className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center text-green-400">
              @
            </span>
            support@mvga.io
          </a>
        </div>
      </div>
    </div>
  );
}
