import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletStore } from '../stores/walletStore';
import { showToast } from '../hooks/useToast';
import { API_URL } from '../config';

const FEATURES = [
  'featureVisa',
  'featureApplePay',
  'featureAtm',
  'featureNotifications',
  'featureFreeze',
  'featureNoFx',
] as const;

export default function CardPage() {
  const { t } = useTranslation();
  const { connected } = useWallet();
  const authToken = useWalletStore((s) => s.authToken);
  const cardWaitlisted = useWalletStore((s) => s.cardWaitlisted);
  const setCardWaitlisted = useWalletStore((s) => s.setCardWaitlisted);

  const [email, setEmail] = useState('');
  const [joining, setJoining] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const faqs = [
    { q: t('banking.cardFaq1q'), a: t('banking.cardFaq1a') },
    { q: t('banking.cardFaq2q'), a: t('banking.cardFaq2a') },
    { q: t('banking.cardFaq3q'), a: t('banking.cardFaq3a') },
  ];

  const handleJoinWaitlist = async () => {
    if (!authToken) return;
    setJoining(true);
    try {
      const res = await fetch(`${API_URL}/banking/card-waitlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ email: email.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      setCardWaitlisted(true);
      showToast('success', t('banking.waitlistSuccess'));
    } catch {
      showToast('error', t('common.somethingWrong'));
    } finally {
      setJoining(false);
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('banking.connectPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/banking" className="text-gray-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold">{t('banking.cardTitle')}</h1>
      </div>

      {/* Virtual Card Visual */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          aspectRatio: '1.586',
        }}
      >
        <div className="absolute top-4 right-4 bg-black/30 text-white text-[10px] px-2.5 py-1 rounded-full font-medium">
          {t('banking.comingSoon')}
        </div>
        <div className="flex flex-col justify-between h-full">
          <p className="text-white/80 text-sm font-bold tracking-widest">MVGA</p>
          <div>
            <p className="text-white font-mono text-xl tracking-[0.2em]">
              {t('banking.cardNumber')}
            </p>
            <div className="flex justify-between items-end mt-4">
              <div>
                <p className="text-white/50 text-[10px] uppercase">{t('banking.cardHolder')}</p>
                <p className="text-white text-sm font-medium">MVGA USER</p>
              </div>
              <div className="text-right">
                <p className="text-white/50 text-[10px]">EXP</p>
                <p className="text-white text-sm font-medium">{t('banking.cardExpiry')}</p>
              </div>
            </div>
          </div>
          <p className="text-white/90 text-xl font-bold tracking-widest self-end">VISA</p>
        </div>
      </div>

      {/* Card Features */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">{t('banking.cardFeatures')}</h2>
        <div className="space-y-2">
          {FEATURES.map((key) => (
            <div key={key} className="flex items-center gap-3">
              <svg
                className="w-4 h-4 text-green-400 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm text-gray-300">{t(`banking.${key}`)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">{t('banking.howCardWorks')}</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary-500/20 text-primary-400 text-xs flex items-center justify-center flex-shrink-0 font-bold">
                {step}
              </span>
              <p className="text-sm text-gray-300">{t(`banking.cardStep${step}`)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Waitlist Form / Success */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">{t('banking.waitlistTitle')}</h2>
        {cardWaitlisted ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-green-400 font-medium">{t('banking.waitlistSuccess')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('banking.waitlistPosition')}</p>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {t('banking.waitlistEmail')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('banking.waitlistEmailPlaceholder')}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <button
              onClick={handleJoinWaitlist}
              disabled={joining || !authToken}
              className="w-full py-2.5 rounded-xl bg-primary-500 text-black font-medium text-sm hover:bg-primary-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {joining ? t('banking.joining') : t('banking.joinWaitlist')}
            </button>
          </>
        )}
      </div>

      {/* FAQ */}
      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <div key={i} className="card overflow-hidden">
            <button
              onClick={() => setFaqOpen(faqOpen === i ? null : i)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="font-medium pr-4 text-sm">{faq.q}</span>
              <svg
                className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${faqOpen === i ? 'rotate-180' : ''}`}
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
            {faqOpen === i && (
              <div className="px-4 pb-4 text-gray-400 text-sm leading-relaxed border-t border-white/5 pt-3">
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
