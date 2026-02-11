import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../hooks/useToast';

interface RecurringPayment {
  id: string;
  recipientAddress: string;
  recipientLabel?: string;
  token: string;
  amount: string; // BigInt serialized
  frequency: string;
  status: string;
  memo?: string;
  nextExecutionAt: string;
  lastExecutedAt?: string;
  executions: Array<{
    id: string;
    status: string;
    scheduledFor: string;
    executedAt?: string;
    signature?: string;
  }>;
}

const FREQUENCIES = ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const;
const TOKENS = ['SOL', 'USDC', 'USDT', 'MVGA'] as const;

const TOKEN_DECIMALS: Record<string, number> = { SOL: 9, USDC: 6, USDT: 6, MVGA: 9 };

function formatSmallestUnit(raw: string, token: string): string {
  const decimals = TOKEN_DECIMALS[token] ?? 6;
  const str = raw.padStart(decimals + 1, '0');
  const whole = str.slice(0, str.length - decimals) || '0';
  const fraction = str.slice(str.length - decimals).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

export default function ScheduledPaymentsPage() {
  const { t } = useTranslation();
  const { connected } = useSelfCustodyWallet();
  /* apiFetch uses the httpOnly auth cookie automatically */

  const [payments, setPayments] = useState<RecurringPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'ACTIVE' | 'PAUSED' | 'CANCELLED'>('ACTIVE');
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientLabel, setRecipientLabel] = useState('');
  const [token, setToken] = useState('USDC');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<string>('WEEKLY');
  const [memo, setMemo] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchPayments = useCallback(async () => {
    try {
      const data = await apiFetch<RecurringPayment[]>(`/scheduler/payments?status=${tab}`);
      setPayments(data);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (connected) fetchPayments();
  }, [connected, fetchPayments]);

  const handleCreate = async () => {
    if (!recipientAddress || !amount) return;
    setCreating(true);
    try {
      await apiFetch('/scheduler/payments', {
        method: 'POST',
        body: JSON.stringify({
          recipientAddress,
          recipientLabel: recipientLabel || undefined,
          token,
          amount: parseFloat(amount),
          frequency,
          memo: memo || undefined,
        }),
      });
      showToast('success', t('scheduled.payment.createSuccess'));
      setShowCreate(false);
      setRecipientAddress('');
      setRecipientLabel('');
      setAmount('');
      setMemo('');
      fetchPayments();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (id: string, action: 'pause' | 'resume' | 'cancel') => {
    try {
      if (action === 'cancel') {
        await apiFetch(`/scheduler/payments/${id}`, { method: 'DELETE' });
      } else {
        await apiFetch(`/scheduler/payments/${id}/${action}`, { method: 'PATCH' });
      }
      showToast('success', t(`scheduled.payment.${action}Success`));
      fetchPayments();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed');
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('scheduled.connectPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/more" className="text-gray-400 hover:text-white" aria-label={t('common.back')}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{t('scheduled.payments')}</h1>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-primary text-sm px-4 py-2"
        >
          + {t('scheduled.payment.create')}
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="card space-y-3">
          <input
            type="text"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder={t('send.enterAddress')}
            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-gold-500"
          />
          <input
            type="text"
            value={recipientLabel}
            onChange={(e) => setRecipientLabel(e.target.value)}
            placeholder={t('scheduled.payment.recipientLabel')}
            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-gold-500"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="bg-white/5 border border-white/10 px-3 py-3 text-sm focus:outline-none focus:border-gold-500"
            >
              {TOKENS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="any"
              className="bg-white/5 border border-white/10 px-3 py-3 text-sm focus:outline-none focus:border-gold-500"
            />
          </div>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-gold-500"
          >
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {t(`scheduled.payment.${f.toLowerCase()}`)}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder={t('scheduled.payment.memo')}
            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-gold-500"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !recipientAddress || !amount}
            className="w-full btn-primary disabled:opacity-50"
          >
            {creating ? t('common.loading') : t('scheduled.payment.create')}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {(['ACTIVE', 'PAUSED', 'CANCELLED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-4 py-2 text-sm rounded-full transition ${
              tab === s
                ? 'bg-gold-500 text-black font-semibold'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {t(`scheduled.payment.${s.toLowerCase()}`)}
          </button>
        ))}
      </div>

      {/* Payment List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : payments.length === 0 ? (
        <p className="text-gray-500 text-center py-12">{t('scheduled.payment.noPayments')}</p>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <div key={p.id} className="card space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">
                    {formatSmallestUnit(p.amount, p.token)} {p.token}
                  </p>
                  <p className="text-xs text-gray-400">
                    {p.recipientLabel ||
                      `${p.recipientAddress.slice(0, 8)}...${p.recipientAddress.slice(-4)}`}
                  </p>
                </div>
                <span className="text-xs text-gray-500">
                  {t(`scheduled.payment.${p.frequency.toLowerCase()}`)}
                </span>
              </div>
              {p.memo && <p className="text-xs text-gray-500">{p.memo}</p>}
              <p className="text-xs text-gray-500">
                {t('scheduled.payment.nextExecution', {
                  date: new Date(p.nextExecutionAt).toLocaleDateString(),
                })}
              </p>
              {tab === 'ACTIVE' && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleAction(p.id, 'pause')}
                    className="text-xs text-yellow-400 hover:text-yellow-300"
                  >
                    {t('scheduled.payment.pause')}
                  </button>
                  <button
                    onClick={() => handleAction(p.id, 'cancel')}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    {t('scheduled.payment.cancel')}
                  </button>
                </div>
              )}
              {tab === 'PAUSED' && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleAction(p.id, 'resume')}
                    className="text-xs text-green-400 hover:text-green-300"
                  >
                    {t('scheduled.payment.resume')}
                  </button>
                  <button
                    onClick={() => handleAction(p.id, 'cancel')}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    {t('scheduled.payment.cancel')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Link to pending approvals */}
      <Link
        to="/scheduled"
        className="block text-center text-xs text-gray-500 hover:text-gray-300 transition"
      >
        {t('scheduled.pending')} &rarr;
      </Link>
    </div>
  );
}
