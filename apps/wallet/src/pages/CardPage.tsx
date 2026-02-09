import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { useWalletStore } from '../stores/walletStore';
import { useAuth } from '../hooks/useAuth';
import { useCard } from '../hooks/useCard';
import { showToast } from '../hooks/useToast';
import { API_URL } from '../config';
import type { CardTransaction, KycSubmission } from '../services/cardService.types';

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

function BackHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <Link to="/banking" className="text-gray-400 hover:text-white">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </Link>
      <h1 className="text-2xl font-bold">{title}</h1>
    </div>
  );
}

const CATEGORY_STYLES: Record<string, { bg: string; color: string; icon: string }> = {
  online: {
    bg: 'bg-blue-500/20',
    color: 'text-blue-400',
    icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
  },
  restaurant: {
    bg: 'bg-orange-500/20',
    color: 'text-orange-400',
    icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z',
  },
  transport: {
    bg: 'bg-green-500/20',
    color: 'text-green-400',
    icon: 'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0',
  },
  entertainment: {
    bg: 'bg-purple-500/20',
    color: 'text-purple-400',
    icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3',
  },
  grocery: {
    bg: 'bg-emerald-500/20',
    color: 'text-emerald-400',
    icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z',
  },
  other: {
    bg: 'bg-gray-500/20',
    color: 'text-gray-400',
    icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  },
};

function TransactionRow({ tx }: { tx: CardTransaction }) {
  const { t } = useTranslation();
  const style = CATEGORY_STYLES[tx.merchantCategory] || CATEGORY_STYLES.other;
  return (
    <div className="card p-3 flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${style.bg}`}
      >
        <svg
          className={`w-5 h-5 ${style.color}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={style.icon} />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{tx.merchantName}</p>
        <p className="text-xs text-gray-500">{new Date(tx.date).toLocaleDateString()}</p>
      </div>
      <div className="text-right">
        <span className="text-sm font-medium">-${tx.amount.toFixed(2)}</span>
        {tx.status === 'pending' && (
          <p className="text-[10px] text-yellow-400">{t('card.pending')}</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card Visual
// ---------------------------------------------------------------------------

function CardVisual({
  status,
  last4,
  cardholderName,
  expirationMonth,
  expirationYear,
  showPan,
  pan,
  badge,
}: {
  status: 'active' | 'frozen' | 'waitlisted' | 'coming_soon';
  last4: string;
  cardholderName: string;
  expirationMonth: number;
  expirationYear: number;
  showPan?: boolean;
  pan?: string;
  badge?: string;
}) {
  const { t } = useTranslation();
  const gradients: Record<string, string> = {
    active: 'linear-gradient(135deg, #f59e0b, #b45309)',
    frozen: 'linear-gradient(135deg, #374151, #1f2937)',
    waitlisted: 'linear-gradient(135deg, #667eea, #764ba2)',
    coming_soon: 'linear-gradient(135deg, #667eea, #764ba2)',
  };
  const badgeStyles: Record<string, string> = {
    active: 'bg-green-500/30 text-green-300',
    frozen: 'bg-red-500/30 text-red-300',
    waitlisted: 'bg-blue-500/30 text-blue-300',
    coming_soon: 'bg-black/30 text-white',
  };
  const badgeText =
    badge || (status === 'active' ? t('card.active') : status === 'frozen' ? t('card.frozen') : '');
  const expStr = `${String(expirationMonth).padStart(2, '0')}/${String(expirationYear).slice(-2)}`;

  return (
    <div
      className=" p-6 relative overflow-hidden"
      style={{ background: gradients[status], aspectRatio: '1.586' }}
    >
      {badgeText && (
        <div
          className={`absolute top-4 right-4 text-[10px] px-2.5 py-1 rounded-full font-medium ${badgeStyles[status]}`}
        >
          {badgeText}
        </div>
      )}
      <div className="flex flex-col justify-between h-full">
        <p className="text-white/80 text-sm font-bold tracking-widest">MVGA</p>
        <div>
          <p className="text-white font-mono text-xl tracking-[0.2em]">
            {showPan && pan ? pan : `•••• •••• •••• ${last4}`}
          </p>
          <div className="flex justify-between items-end mt-4">
            <div>
              <p className="text-white/50 text-[10px] uppercase">CARD HOLDER</p>
              <p className="text-white text-sm font-medium">{cardholderName}</p>
            </div>
            <div className="text-right">
              <p className="text-white/50 text-[10px]">EXP</p>
              <p className="text-white text-sm font-medium">{expStr}</p>
            </div>
          </div>
        </div>
        <p className="text-white/90 text-xl font-bold tracking-widest self-end">VISA</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fund Card Modal
// ---------------------------------------------------------------------------

function FundCardModal({
  open,
  onClose,
  onFund,
}: {
  open: boolean;
  onClose: () => void;
  onFund: (amount: number) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [funding, setFunding] = useState(false);
  const presets = [25, 50, 100, 250];

  if (!open) return null;

  const handleFund = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) return;
    setFunding(true);
    const success = await onFund(num);
    setFunding(false);
    if (success) {
      showToast('success', t('card.fundSuccess'));
      setAmount('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#141414] border border-white/10 p-6 w-full max-w-sm space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{t('card.fundCard')}</h2>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('card.fundAmount')}</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-lg font-semibold focus:outline-none focus:border-gold-500"
          />
        </div>
        <div className="flex gap-2">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => setAmount(String(p))}
              className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-sm font-medium transition"
            >
              ${p}
            </button>
          ))}
        </div>
        <button
          onClick={handleFund}
          disabled={funding || !amount || parseFloat(amount) <= 0}
          className="w-full py-3 bg-gold-500 text-black font-semibold hover:bg-gold-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {funding ? t('card.funding') : t('card.fundButton')}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View: Waitlist (status === 'none')
// ---------------------------------------------------------------------------

const FEATURES = [
  'featureVisa',
  'featureApplePay',
  'featureAtm',
  'featureNotifications',
  'featureFreeze',
  'featureNoFx',
] as const;

function WaitlistView() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const setCardStatus = useWalletStore((s) => s.setCardStatus);
  const [email, setEmail] = useState('');
  const [joining, setJoining] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const faqs = [
    { q: t('banking.cardFaq1q'), a: t('banking.cardFaq1a') },
    { q: t('banking.cardFaq2q'), a: t('banking.cardFaq2a') },
    { q: t('banking.cardFaq3q'), a: t('banking.cardFaq3a') },
  ];

  const handleJoinWaitlist = async () => {
    if (!isAuthenticated) return;
    setJoining(true);
    try {
      const res = await fetch(`${API_URL}/banking/card-waitlist`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      setCardStatus('waitlisted');
      showToast('success', t('banking.waitlistSuccess'));
    } catch {
      showToast('error', t('common.somethingWrong'));
    } finally {
      setJoining(false);
    }
  };

  return (
    <>
      <CardVisual
        status="coming_soon"
        last4="4242"
        cardholderName="MVGA USER"
        expirationMonth={12}
        expirationYear={2028}
        badge={t('banking.comingSoon')}
      />

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

      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">{t('banking.howCardWorks')}</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-gold-500/20 text-gold-400 text-xs flex items-center justify-center flex-shrink-0 font-bold">
                {step}
              </span>
              <p className="text-sm text-gray-300">{t(`banking.cardStep${step}`)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">{t('banking.waitlistTitle')}</h2>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('banking.waitlistEmail')}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('banking.waitlistEmailPlaceholder')}
            className="w-full bg-white/5 border border-white/10 px-4 py-2.5 text-sm focus:outline-none focus:border-gold-500"
          />
        </div>
        <button
          onClick={handleJoinWaitlist}
          disabled={joining || !isAuthenticated}
          className="w-full py-2.5 bg-gold-500 text-black font-medium text-sm hover:bg-gold-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {joining ? t('banking.joining') : t('banking.joinWaitlist')}
        </button>
      </div>

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
    </>
  );
}

// ---------------------------------------------------------------------------
// View: Waitlisted (status === 'waitlisted')
// ---------------------------------------------------------------------------

function WaitlistedView() {
  const { t } = useTranslation();
  const setCardStatus = useWalletStore((s) => s.setCardStatus);

  return (
    <>
      <CardVisual
        status="waitlisted"
        last4="4242"
        cardholderName="MVGA USER"
        expirationMonth={12}
        expirationYear={2028}
        badge={t('card.waitlistedTitle')}
      />

      <div className="card p-5 text-center space-y-3">
        <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
          <svg
            className="w-7 h-7 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">{t('card.waitlistedTitle')}</h2>
        <p className="text-sm text-gray-400">{t('card.waitlistedDesc')}</p>
      </div>

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

      <button
        onClick={() => setCardStatus('kyc_pending')}
        className="w-full py-3 bg-gold-500 text-black font-semibold hover:bg-gold-400 transition active:scale-95"
      >
        {t('card.startApplication')}
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// View: KYC Form (status === 'kyc_pending')
// ---------------------------------------------------------------------------

function KycView() {
  const { t } = useTranslation();
  const { submitKyc } = useCard();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    dateOfBirth: '',
    line1: '',
    city: '',
    region: '',
    postalCode: '',
    countryCode: 'VE',
    nationalIdType: 'cedula' as const,
    nationalId: '',
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName || !form.dateOfBirth || !form.nationalId || !form.line1)
      return;
    setSubmitting(true);
    const data: KycSubmission = {
      firstName: form.firstName,
      lastName: form.lastName,
      ...(form.email ? { email: form.email } : {}),
      dateOfBirth: form.dateOfBirth,
      address: {
        line1: form.line1,
        city: form.city,
        region: form.region,
        postalCode: form.postalCode,
        countryCode: form.countryCode,
      },
      nationalIdType: form.nationalIdType,
      nationalId: form.nationalId,
    };
    await submitKyc(data);
    setSubmitting(false);
  };

  const inputCls =
    'w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-gold-500';

  return (
    <>
      <div className="card p-5 space-y-1 text-center">
        <div className="w-14 h-14 bg-gold-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg
            className="w-7 h-7 text-gold-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">{t('card.kycTitle')}</h2>
        <p className="text-sm text-gray-400">{t('card.kycSubtitle')}</p>
      </div>

      <div className="card p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('card.fullName')}</label>
            <input
              value={form.firstName}
              onChange={(e) => update('firstName', e.target.value)}
              placeholder="Juan"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">&nbsp;</label>
            <input
              value={form.lastName}
              onChange={(e) => update('lastName', e.target.value)}
              placeholder="Rosales"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('card.dateOfBirth')}</label>
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => update('dateOfBirth', e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('card.address')}</label>
          <input
            value={form.line1}
            onChange={(e) => update('line1', e.target.value)}
            placeholder="Av. Libertador, Caracas"
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input
            value={form.city}
            onChange={(e) => update('city', e.target.value)}
            placeholder="City"
            className={inputCls}
          />
          <input
            value={form.postalCode}
            onChange={(e) => update('postalCode', e.target.value)}
            placeholder="Postal Code"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('card.nationalIdType')}</label>
          <select
            value={form.nationalIdType}
            onChange={(e) => update('nationalIdType', e.target.value)}
            className={`${inputCls} bg-white/5`}
          >
            <option value="cedula">{t('card.idCedula')}</option>
            <option value="passport">{t('card.idPassport')}</option>
            <option value="drivers_license">{t('card.idDrivers')}</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('card.nationalId')}</label>
          <input
            value={form.nationalId}
            onChange={(e) => update('nationalId', e.target.value)}
            placeholder="V-12345678"
            className={inputCls}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={
            submitting || !form.firstName || !form.lastName || !form.dateOfBirth || !form.nationalId
          }
          className="w-full py-3 bg-gold-500 text-black font-semibold hover:bg-gold-400 transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        >
          {submitting ? t('card.submittingKyc') : t('card.submitKyc')}
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// View: Card Issued (status === 'kyc_approved')
// ---------------------------------------------------------------------------

function CardIssuedView() {
  const { t } = useTranslation();
  const setCardStatus = useWalletStore((s) => s.setCardStatus);

  useEffect(() => {
    const timer = setTimeout(() => setCardStatus('active'), 2000);
    return () => clearTimeout(timer);
  }, [setCardStatus]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
      <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center animate-bounce">
        <svg
          className="w-10 h-10 text-green-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold">{t('card.cardIssuedTitle')}</h2>
      <p className="text-gray-400 max-w-xs">{t('card.cardIssuedDesc')}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View: Card Dashboard (status === 'active' | 'frozen')
// ---------------------------------------------------------------------------

function CardDashboardView() {
  const { t } = useTranslation();
  const { card, balance, transactions, controls, loading, toggleFreeze, updateControls, fundCard } =
    useCard();
  const [showPan, setShowPan] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [freezing, setFreezing] = useState(false);

  if (loading || !card || !balance || !controls) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card animate-pulse h-24" />
        ))}
      </div>
    );
  }

  const isFrozen = card.status === 'frozen';

  const handleToggleFreeze = async () => {
    setFreezing(true);
    try {
      await toggleFreeze();
      showToast('success', isFrozen ? t('card.unfreezeSuccess') : t('card.freezeSuccess'));
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('common.somethingWrong'));
    } finally {
      setFreezing(false);
    }
  };

  return (
    <>
      {/* Card Visual */}
      <CardVisual
        status={isFrozen ? 'frozen' : 'active'}
        last4={card.last4}
        cardholderName={card.cardholderName}
        expirationMonth={card.expirationMonth}
        expirationYear={card.expirationYear}
        showPan={showPan}
        pan={card.pan}
      />

      {/* Frozen Warning */}
      {isFrozen && (
        <div className="card p-3 bg-red-500/10 border-red-500/20 flex items-center gap-3">
          <svg
            className="w-5 h-5 text-red-400 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <p className="text-sm text-red-400">{t('card.frozenWarning')}</p>
        </div>
      )}

      {/* Balance */}
      <div className="card p-4 bg-gradient-to-br from-green-500/10 to-emerald-600/5 border-green-500/20">
        <p className="text-sm text-gray-400">{t('card.availableToSpend')}</p>
        <p className="text-3xl font-bold mt-1">${balance.available.toFixed(2)}</p>
        {balance.pending > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            {t('card.pendingAmount')}: ${balance.pending.toFixed(2)}
          </p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setShowFundModal(true)}
          className="card p-3 flex flex-col items-center gap-2 hover:bg-white/10 transition"
        >
          <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </div>
          <span className="text-xs font-medium">{t('card.fundCard')}</span>
        </button>

        <button
          onClick={handleToggleFreeze}
          disabled={freezing}
          className="card p-3 flex flex-col items-center gap-2 hover:bg-white/10 transition disabled:opacity-50"
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${isFrozen ? 'bg-green-500/20' : 'bg-red-500/20'}`}
          >
            <svg
              className={`w-5 h-5 ${isFrozen ? 'text-green-400' : 'text-red-400'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {isFrozen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              )}
            </svg>
          </div>
          <span className="text-xs font-medium">
            {isFrozen ? t('card.unfreeze') : t('card.freeze')}
          </span>
        </button>

        <button
          onClick={() => setShowPan(!showPan)}
          className="card p-3 flex flex-col items-center gap-2 hover:bg-white/10 transition"
        >
          <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-purple-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {showPan ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              )}
            </svg>
          </div>
          <span className="text-xs font-medium">
            {showPan ? t('card.hideNumber') : t('card.showNumber')}
          </span>
        </button>
      </div>

      {/* Recent Transactions */}
      <div className="space-y-3">
        <h2 className="font-semibold">{t('card.recentTransactions')}</h2>
        {transactions.length === 0 ? (
          <div className="card p-4 text-center text-gray-400 text-sm">
            {t('card.noTransactions')}
          </div>
        ) : (
          transactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
        )}
      </div>

      {/* Card Controls */}
      <div className="card overflow-hidden">
        <button
          onClick={() => setShowControls(!showControls)}
          className="w-full flex items-center justify-between p-4"
        >
          <h2 className="font-semibold">{t('card.controls')}</h2>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${showControls ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showControls && (
          <div className="px-4 pb-4 space-y-5 border-t border-white/5 pt-4">
            {/* Daily Spend Limit */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">{t('card.dailyLimit')}</span>
                <span className="font-medium">${controls.dailySpendLimit.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={100}
                max={10000}
                step={100}
                value={controls.dailySpendLimit}
                onChange={(e) => updateControls({ dailySpendLimit: Number(e.target.value) })}
                className="w-full accent-primary-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>$100</span>
                <span>$10,000</span>
              </div>
            </div>

            {/* Online Transactions Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('card.onlineTransactions')}</span>
              <button
                onClick={() => updateControls({ onlineTransactions: !controls.onlineTransactions })}
                className={`w-11 h-6 rounded-full transition-colors ${controls.onlineTransactions ? 'bg-gold-500' : 'bg-white/10'}`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full transition-transform mx-0.5 ${controls.onlineTransactions ? 'translate-x-5' : ''}`}
                />
              </button>
            </div>

            {/* International Transactions Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('card.internationalTransactions')}</span>
              <button
                onClick={() =>
                  updateControls({ internationalTransactions: !controls.internationalTransactions })
                }
                className={`w-11 h-6 rounded-full transition-colors ${controls.internationalTransactions ? 'bg-gold-500' : 'bg-white/10'}`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full transition-transform mx-0.5 ${controls.internationalTransactions ? 'translate-x-5' : ''}`}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      <FundCardModal
        open={showFundModal}
        onClose={() => setShowFundModal(false)}
        onFund={fundCard}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CardPage() {
  const { t } = useTranslation();
  const { connected } = useSelfCustodyWallet();
  const cardStatus = useWalletStore((s) => s.cardStatus);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('banking.connectPrompt')}</p>
      </div>
    );
  }

  const titles: Record<string, string> = {
    none: t('banking.cardTitle'),
    waitlisted: t('banking.cardTitle'),
    kyc_pending: t('card.kycTitle'),
    kyc_approved: t('banking.cardTitle'),
    active: t('card.myCard'),
    frozen: t('card.myCard'),
  };

  return (
    <div className="space-y-6">
      <BackHeader title={titles[cardStatus] || t('banking.cardTitle')} />

      {cardStatus === 'none' && <WaitlistView />}
      {cardStatus === 'waitlisted' && <WaitlistedView />}
      {cardStatus === 'kyc_pending' && <KycView />}
      {cardStatus === 'kyc_approved' && <CardIssuedView />}
      {(cardStatus === 'active' || cardStatus === 'frozen') && <CardDashboardView />}
    </div>
  );
}
