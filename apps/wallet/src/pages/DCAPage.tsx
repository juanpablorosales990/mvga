import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../hooks/useToast';

interface DCAOrder {
  id: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  frequency: string;
  status: string;
  slippageBps: number;
  totalSpent: string;
  totalReceived: string;
  executionCount: number;
  nextExecutionAt: string;
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

export default function DCAPage() {
  const { t } = useTranslation();
  const { connected } = useSelfCustodyWallet();
  /* apiFetch uses the httpOnly auth cookie automatically */

  const [orders, setOrders] = useState<DCAOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'ACTIVE' | 'PAUSED' | 'CANCELLED'>('ACTIVE');
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [inputToken, setInputToken] = useState('USDC');
  const [outputToken, setOutputToken] = useState('SOL');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<string>('WEEKLY');
  const [slippageBps, setSlippageBps] = useState(50);
  const [creating, setCreating] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await apiFetch<DCAOrder[]>(`/scheduler/dca?status=${tab}`);
      setOrders(data);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (connected) fetchOrders();
  }, [connected, fetchOrders]);

  const handleCreate = async () => {
    if (!amount || inputToken === outputToken) return;
    setCreating(true);
    try {
      await apiFetch('/scheduler/dca', {
        method: 'POST',
        body: JSON.stringify({
          inputToken,
          outputToken,
          amount: parseFloat(amount),
          frequency,
          slippageBps,
        }),
      });
      showToast('success', t('scheduled.dca.createSuccess'));
      setShowCreate(false);
      setAmount('');
      fetchOrders();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (id: string, action: 'pause' | 'resume' | 'cancel') => {
    try {
      if (action === 'cancel') {
        await apiFetch(`/scheduler/dca/${id}`, { method: 'DELETE' });
      } else {
        await apiFetch(`/scheduler/dca/${id}/${action}`, { method: 'PATCH' });
      }
      showToast('success', t(`scheduled.dca.${action}Success`));
      fetchOrders();
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
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{t('scheduled.dcaLabel')}</h1>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-primary text-sm px-4 py-2"
        >
          + {t('scheduled.dca.create')}
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="card space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {t('scheduled.dca.inputToken')}
              </label>
              <select
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-3 py-3 text-sm focus:outline-none focus:border-gold-500"
              >
                {TOKENS.map((tk) => (
                  <option key={tk} value={tk}>
                    {tk}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {t('scheduled.dca.outputToken')}
              </label>
              <select
                value={outputToken}
                onChange={(e) => setOutputToken(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-3 py-3 text-sm focus:outline-none focus:border-gold-500"
              >
                {TOKENS.filter((tk) => tk !== inputToken).map((tk) => (
                  <option key={tk} value={tk}>
                    {tk}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            step="any"
            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-gold-500"
          />
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
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              {t('scheduled.dca.slippage')}: {slippageBps / 100}%
            </label>
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={slippageBps}
              onChange={(e) => setSlippageBps(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !amount || inputToken === outputToken}
            className="w-full btn-primary disabled:opacity-50"
          >
            {creating ? t('common.loading') : t('scheduled.dca.create')}
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

      {/* Order List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <p className="text-gray-500 text-center py-12">{t('scheduled.dca.noOrders')}</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="card space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">
                    {formatSmallestUnit(o.inputAmount, o.inputToken)} {o.inputToken} &rarr;{' '}
                    {o.outputToken}
                  </p>
                  <p className="text-xs text-gray-400">
                    {t(`scheduled.payment.${o.frequency.toLowerCase()}`)} &middot;{' '}
                    {o.slippageBps / 100}% {t('scheduled.dca.slippage').toLowerCase()}
                  </p>
                </div>
                <span className="text-xs text-gray-500">
                  #{o.executionCount} {t('scheduled.dca.executions').toLowerCase()}
                </span>
              </div>

              {/* Stats */}
              {o.executionCount > 0 && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/[0.03] p-2 rounded">
                    <span className="text-gray-500">{t('scheduled.dca.totalSpent')}</span>
                    <p className="font-medium">
                      {formatSmallestUnit(o.totalSpent, o.inputToken)} {o.inputToken}
                    </p>
                  </div>
                  <div className="bg-white/[0.03] p-2 rounded">
                    <span className="text-gray-500">{t('scheduled.dca.totalReceived')}</span>
                    <p className="font-medium">
                      {formatSmallestUnit(o.totalReceived, o.outputToken)} {o.outputToken}
                    </p>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-500">
                {t('scheduled.dca.nextExecution', {
                  date: new Date(o.nextExecutionAt).toLocaleDateString(),
                })}
              </p>

              {tab === 'ACTIVE' && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleAction(o.id, 'pause')}
                    className="text-xs text-yellow-400 hover:text-yellow-300"
                  >
                    {t('scheduled.payment.pause')}
                  </button>
                  <button
                    onClick={() => handleAction(o.id, 'cancel')}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    {t('scheduled.payment.cancel')}
                  </button>
                </div>
              )}
              {tab === 'PAUSED' && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleAction(o.id, 'resume')}
                    className="text-xs text-green-400 hover:text-green-300"
                  >
                    {t('scheduled.payment.resume')}
                  </button>
                  <button
                    onClick={() => handleAction(o.id, 'cancel')}
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
