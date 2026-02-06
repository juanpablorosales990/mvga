import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function HelpPage() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<number | null>(null);

  const faqs = [
    { q: t('help.faq1q'), a: t('help.faq1a') },
    { q: t('help.faq2q'), a: t('help.faq2a') },
    { q: t('help.faq3q'), a: t('help.faq3a') },
    { q: t('help.faq4q'), a: t('help.faq4a') },
    { q: t('help.faq5q'), a: t('help.faq5a') },
    { q: t('help.faq6q'), a: t('help.faq6a') },
  ];

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

      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <div key={i} className="card overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="font-medium pr-4">{faq.q}</span>
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
        ))}
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
