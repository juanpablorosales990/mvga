import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { usePrices } from '../hooks/usePrices';
import { useWalletStore } from '../stores/walletStore';
import UserSearchInput, { type ResolvedUser } from '../components/UserSearchInput';
import { track, AnalyticsEvents } from '../lib/analytics';

type Step = 'who' | 'amount' | 'deliver';

export default function RemittancePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { connected } = useSelfCustodyWallet();
  const { prices } = usePrices();
  const recentRecipients = useWalletStore((s) => s.recentRecipients);

  const [step, setStep] = useState<Step>('who');
  const [recipientInput, setRecipientInput] = useState('');
  const [resolvedUser, setResolvedUser] = useState<ResolvedUser | null>(null);
  const [amount, setAmount] = useState('');

  const handleResolve = useCallback((user: ResolvedUser | null) => {
    setResolvedUser(user);
  }, []);

  const recipientAddress = resolvedUser?.walletAddress || '';
  const recipientLabel = resolvedUser?.displayName || resolvedUser?.username || '';
  const amountNum = parseFloat(amount) || 0;
  const vesBcv = amountNum * prices.vesBcvRate;
  const vesParallel = amountNum * prices.vesParallelRate;

  const handleSelectMethod = (method: 'direct' | 'ves' | 'cash') => {
    track(AnalyticsEvents.REMITTANCE_METHOD_SELECTED, { method, amount: amountNum });

    switch (method) {
      case 'direct':
        navigate(`/send?to=${encodeURIComponent(recipientAddress)}&amount=${amount}&token=USDC`);
        break;
      case 'ves':
        navigate('/ves-onramp?tab=sell');
        break;
      case 'cash':
        navigate('/moneygram');
        break;
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('remittance.connectPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('remittance.title')}</h1>
        <p className="text-white/40 text-sm mt-1">{t('remittance.subtitle')}</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {(['who', 'amount', 'deliver'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 flex items-center justify-center text-xs font-bold ${
                step === s
                  ? 'bg-gold-500 text-black'
                  : ['who', 'amount', 'deliver'].indexOf(step) > i
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-white/5 text-white/30 border border-white/10'
              }`}
            >
              {i + 1}
            </div>
            {i < 2 && <div className="w-8 h-px bg-white/10" />}
          </div>
        ))}
      </div>

      {/* Step 1: WHO */}
      {step === 'who' && (
        <div className="card space-y-4">
          <p className="text-sm font-medium">{t('remittance.stepWho')}</p>

          <UserSearchInput
            value={recipientInput}
            onChange={setRecipientInput}
            onResolve={handleResolve}
          />

          {/* Recent recipients */}
          {recentRecipients.length > 0 && !recipientInput && (
            <div>
              <label className="block text-xs text-gray-500 mb-2">
                {t('send.recentRecipients')}
              </label>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {recentRecipients.map((r) => (
                  <button
                    key={r.address}
                    onClick={() => {
                      setRecipientInput(r.address);
                      setResolvedUser({ walletAddress: r.address, displayName: r.label });
                    }}
                    className="flex-shrink-0 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs text-gray-300 hover:bg-white/10 hover:border-white/20 transition"
                  >
                    {r.label || `${r.address.slice(0, 4)}...${r.address.slice(-4)}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              if (recipientAddress) {
                track(AnalyticsEvents.REMITTANCE_STARTED, {
                  recipient: recipientLabel || recipientAddress,
                });
                setStep('amount');
              }
            }}
            disabled={!recipientAddress}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('remittance.continue')}
          </button>
        </div>
      )}

      {/* Step 2: HOW MUCH */}
      {step === 'amount' && (
        <div className="card space-y-4">
          <p className="text-sm font-medium">{t('remittance.stepAmount')}</p>

          {recipientLabel && <p className="text-xs text-gold-400">→ {recipientLabel}</p>}

          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-white/5 border border-white/10 px-4 py-3 pr-16 text-lg focus:outline-none focus:border-gold-500"
              min="0"
              step="any"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              USDC
            </span>
          </div>

          {/* VES conversion preview */}
          {amountNum > 0 && prices.vesBcvRate > 0 && (
            <div className="bg-white/5 border border-white/10 px-4 py-3 space-y-1">
              <p className="text-xs text-white/40">{t('remittance.recipientGets')}</p>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] text-white/30 font-mono uppercase">
                    {t('wallet.bcvOfficial')}
                  </p>
                  <p className="text-sm font-bold font-mono">
                    Bs{' '}
                    {vesBcv.toLocaleString('es-VE', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div>
                  <p className="text-[10px] text-white/30 font-mono uppercase">
                    {t('wallet.parallel')}
                  </p>
                  <p className="text-sm font-bold font-mono">
                    Bs{' '}
                    {vesParallel.toLocaleString('es-VE', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep('who')} className="flex-1 btn-secondary">
              {t('remittance.back')}
            </button>
            <button
              onClick={() => {
                if (amountNum > 0) setStep('deliver');
              }}
              disabled={amountNum <= 0}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('remittance.continue')}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: HOW THEY RECEIVE */}
      {step === 'deliver' && (
        <div className="space-y-4">
          <div className="card">
            <p className="text-sm font-medium mb-1">{t('remittance.stepDeliver')}</p>
            <p className="text-xs text-white/40">
              {amount} USDC → {recipientLabel || `${recipientAddress.slice(0, 6)}...`}
            </p>
          </div>

          {/* Direct USDC */}
          <button
            onClick={() => handleSelectMethod('direct')}
            className="card w-full text-left flex items-center gap-4 border border-white/10 hover:border-gold-500/30 hover:bg-gold-500/5 transition"
          >
            <div className="w-12 h-12 bg-blue-500/20 flex items-center justify-center flex-shrink-0 text-xl font-bold text-blue-400">
              $
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">{t('remittance.methodDirect')}</p>
              <p className="text-xs text-white/40">{t('remittance.methodDirectDesc')}</p>
            </div>
            <span className="text-gold-500 text-sm font-mono flex-shrink-0">→</span>
          </button>

          {/* VES via Pago Movil */}
          <button
            onClick={() => handleSelectMethod('ves')}
            className="card w-full text-left flex items-center gap-4 border border-white/10 hover:border-gold-500/30 hover:bg-gold-500/5 transition"
          >
            <div className="w-12 h-12 bg-yellow-500/20 flex items-center justify-center flex-shrink-0 text-lg font-bold text-yellow-400">
              Bs
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">{t('remittance.methodVes')}</p>
              <p className="text-xs text-white/40">{t('remittance.methodVesDesc')}</p>
              {prices.vesParallelRate > 0 && (
                <p className="text-xs text-green-400 mt-0.5">
                  ~Bs{' '}
                  {vesParallel.toLocaleString('es-VE', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
            </div>
            <span className="text-gold-500 text-sm font-mono flex-shrink-0">→</span>
          </button>

          {/* Cash via MoneyGram */}
          <button
            onClick={() => handleSelectMethod('cash')}
            className="card w-full text-left flex items-center gap-4 border border-white/10 hover:border-gold-500/30 hover:bg-gold-500/5 transition"
          >
            <div className="w-12 h-12 bg-orange-500/20 flex items-center justify-center flex-shrink-0 text-lg font-bold text-orange-400">
              MG
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">{t('remittance.methodCash')}</p>
              <p className="text-xs text-white/40">{t('remittance.methodCashDesc')}</p>
            </div>
            <span className="text-gold-500 text-sm font-mono flex-shrink-0">→</span>
          </button>

          <button onClick={() => setStep('amount')} className="w-full btn-secondary">
            {t('remittance.back')}
          </button>
        </div>
      )}
    </div>
  );
}
