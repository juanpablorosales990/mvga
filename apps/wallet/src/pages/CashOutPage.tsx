import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../hooks/useToast';

interface PayoutRecord {
  id: string;
  recipientEmail: string;
  amountUsd: number;
  status: 'PENDING' | 'COMMITTED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  createdAt: string;
}

const PRESET_AMOUNTS = [10, 25, 50, 100];

export default function CashOutPage() {
  const { t } = useTranslation();
  const { connected } = useSelfCustodyWallet();

  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<'cashout' | 'history'>('cashout');
  const [history, setHistory] = useState<PayoutRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const finalAmount = amount ?? (customAmount ? parseFloat(customAmount) : null);
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleCashOut = async () => {
    if (!finalAmount || !isValidEmail) return;
    setSending(true);
    try {
      await apiFetch('/offramp/payout/one-step', {
        method: 'POST',
        body: JSON.stringify({
          recipientEmail: email,
          amountUsd: finalAmount,
          description: description || undefined,
        }),
      });
      showToast('success', t('cashout.success', { amount: finalAmount, email }));
      setEmail('');
      setAmount(null);
      setCustomAmount('');
      setDescription('');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('cashout.failed'));
    } finally {
      setSending(false);
    }
  };

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await apiFetch<PayoutRecord[]>('/offramp/payouts');
      setHistory(data);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const statusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-400';
      case 'FAILED':
      case 'CANCELLED':
        return 'text-red-400';
      default:
        return 'text-gold-500';
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('cashout.connectPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold uppercase tracking-tight">{t('cashout.title')}</h1>
      <p className="text-white/40 text-xs">{t('cashout.subtitle')}</p>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('cashout')}
          className={`flex-1 py-2 text-sm font-medium border transition ${
            tab === 'cashout'
              ? 'border-gold-500 bg-gold-500/10 text-gold-500'
              : 'border-white/10 text-white/50'
          }`}
        >
          {t('cashout.sendTab')}
        </button>
        <button
          onClick={() => {
            setTab('history');
            loadHistory();
          }}
          className={`flex-1 py-2 text-sm font-medium border transition ${
            tab === 'history'
              ? 'border-gold-500 bg-gold-500/10 text-gold-500'
              : 'border-white/10 text-white/50'
          }`}
        >
          {t('cashout.historyTab')}
        </button>
      </div>

      {tab === 'cashout' ? (
        <>
          {/* Recipient email */}
          <div className="card space-y-3">
            <label className="text-xs text-white/40 block">{t('cashout.recipientEmail')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              placeholder="maria@airtm.com"
              className="w-full bg-white/10 px-3 py-2 text-white text-sm"
            />
            {email && !isValidEmail && (
              <p className="text-xs text-red-400">{t('cashout.invalidEmail')}</p>
            )}
          </div>

          {/* Amount selection */}
          <div className="card space-y-3">
            <label className="text-xs text-white/40 block">{t('cashout.amount')}</label>

            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => {
                    setAmount(amt);
                    setCustomAmount('');
                  }}
                  className={`py-2 text-sm font-medium border transition ${
                    amount === amt
                      ? 'border-gold-500 bg-gold-500/10 text-gold-500'
                      : 'border-white/10 text-white/50 hover:border-white/30'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>

            <input
              type="number"
              inputMode="decimal"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setAmount(null);
              }}
              placeholder={t('cashout.customAmount')}
              className="w-full bg-white/10 px-3 py-2 text-white text-sm"
              min={1}
              max={1800}
              step="0.01"
            />
          </div>

          {/* Description (optional) */}
          <div className="card space-y-3">
            <label className="text-xs text-white/40 block">{t('cashout.description')}</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('cashout.descriptionPlaceholder')}
              className="w-full bg-white/10 px-3 py-2 text-white text-sm"
              maxLength={200}
            />
          </div>

          {/* Summary */}
          {finalAmount && isValidEmail && (
            <div className="card space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/40">{t('cashout.to')}</span>
                <span className="text-white font-mono text-xs">{email}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">{t('cashout.amount')}</span>
                <span className="text-gold-500 font-bold">${finalAmount.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Confirm button */}
          <button
            onClick={handleCashOut}
            disabled={
              !finalAmount || finalAmount < 1 || finalAmount > 1800 || !isValidEmail || sending
            }
            className="btn-primary w-full"
          >
            {sending ? t('common.processing') : t('cashout.send', { amount: finalAmount ?? '...' })}
          </button>
        </>
      ) : (
        /* History tab */
        <div className="space-y-2">
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-white/30 py-12 text-sm">{t('cashout.noHistory')}</p>
          ) : (
            history.map((item) => (
              <div key={item.id} className="card flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{item.recipientEmail}</p>
                  <p className="text-xs text-white/40">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">${item.amountUsd}</p>
                  <p className={`text-xs ${statusColor(item.status)}`}>
                    {t(`cashout.status_${item.status}`)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MoneyGram link */}
      <Link
        to="/moneygram?tab=offramp"
        className="card flex items-center justify-between hover:bg-white/5 transition"
      >
        <div>
          <p className="text-sm font-medium">{t('moneygram.linkTitle')}</p>
          <p className="text-xs text-white/30">{t('moneygram.linkDesc')}</p>
        </div>
        <span className="text-gold-500 text-sm font-mono">&rarr;</span>
      </Link>

      {/* Info */}
      <div className="bg-white/5 border border-white/10 px-4 py-3">
        <p className="text-white/30 text-xs font-mono">{t('cashout.poweredBy')}</p>
      </div>
    </div>
  );
}
