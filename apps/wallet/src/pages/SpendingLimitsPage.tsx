import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useWalletStore } from '../stores/walletStore';
import type { SpendingPeriod } from '../stores/walletStore';
import { showToast } from '../hooks/useToast';

const PERIODS: SpendingPeriod[] = ['daily', 'weekly', 'monthly'];
const TOKENS = ['ALL', 'USDC', 'SOL', 'MVGA'];

function getPeriodStart(period: SpendingPeriod): number {
  const now = new Date();
  if (period === 'daily') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  if (period === 'weekly') {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday = start
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    return start.getTime();
  }
  // monthly
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

export default function SpendingLimitsPage() {
  const { t } = useTranslation();
  const spendingLimits = useWalletStore((s) => s.spendingLimits);
  const spendingHistory = useWalletStore((s) => s.spendingHistory);
  const addSpendingLimit = useWalletStore((s) => s.addSpendingLimit);
  const removeSpendingLimit = useWalletStore((s) => s.removeSpendingLimit);
  const toggleSpendingLimit = useWalletStore((s) => s.toggleSpendingLimit);

  const [showForm, setShowForm] = useState(false);
  const [period, setPeriod] = useState<SpendingPeriod>('daily');
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('ALL');

  // Calculate usage per limit
  const usageMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const limit of spendingLimits) {
      const start = getPeriodStart(limit.period);
      const spent = spendingHistory
        .filter((r) => r.timestamp >= start && (limit.token === 'ALL' || r.token === limit.token))
        .reduce((sum, r) => sum + r.amount, 0);
      map[limit.id] = spent;
    }
    return map;
  }, [spendingLimits, spendingHistory]);

  const handleCreate = () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      showToast('error', t('spending.invalidAmount'));
      return;
    }
    addSpendingLimit({ period, amount: amt, token, isActive: true });
    showToast('success', t('spending.created'));
    setShowForm(false);
    setAmount('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('spending.title')}</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm font-medium text-gold-500 hover:text-gold-400 transition"
        >
          {showForm ? t('common.cancel') : t('spending.addLimit')}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">{t('spending.period')}</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as SpendingPeriod)}
              className="w-full bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold-500"
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {t(`spending.${p}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">{t('spending.amount')}</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="any"
                className="w-full bg-white/5 border border-white/10 pl-8 pr-4 py-3 focus:outline-none focus:border-gold-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">{t('spending.token')}</label>
            <select
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold-500"
            >
              {TOKENS.map((tk) => (
                <option key={tk} value={tk}>
                  {tk === 'ALL' ? t('spending.allTokens') : tk}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCreate}
            disabled={!amount}
            className="w-full btn-primary disabled:opacity-50"
          >
            {t('spending.create')}
          </button>
        </div>
      )}

      {/* Existing limits */}
      {spendingLimits.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <div className="text-4xl mb-3 opacity-30">&#x26D4;</div>
          <p className="text-lg mb-1">{t('spending.noLimits')}</p>
          <p className="text-sm mb-4">{t('spending.noLimitsDesc')}</p>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="text-sm font-medium text-gold-500 hover:text-gold-400 transition"
            >
              + {t('spending.addLimit')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {spendingLimits.map((limit) => {
            const spent = usageMap[limit.id] || 0;
            const pct = Math.min((spent / limit.amount) * 100, 100);
            const isOver = spent >= limit.amount;
            const isWarning = pct >= 75 && !isOver;

            return (
              <div
                key={limit.id}
                className={`card space-y-3 ${!limit.isActive ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">
                      {t(`spending.${limit.period}`)} {t('spending.limit')}
                    </span>
                    {limit.token !== 'ALL' && (
                      <span className="ml-2 text-xs px-2 py-0.5 bg-white/10 rounded-full">
                        {limit.token}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleSpendingLimit(limit.id)}
                      aria-label={limit.isActive ? t('spending.paused') : t('spending.active')}
                      className={`text-xs px-2 py-1 rounded transition ${
                        limit.isActive
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-white/10 text-gray-400'
                      }`}
                    >
                      {limit.isActive ? t('spending.active') : t('spending.paused')}
                    </button>
                    <button
                      onClick={() => {
                        removeSpendingLimit(limit.id);
                        showToast('success', t('spending.removed'));
                      }}
                      aria-label={t('common.remove')}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      {t('common.remove')}
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span
                      className={
                        isOver ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-gray-400'
                      }
                    >
                      ${spent.toFixed(2)} / ${limit.amount.toFixed(2)}
                    </span>
                    <span className={isOver ? 'text-red-400 font-bold' : 'text-gray-500'}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOver ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-gold-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Alert messages */}
                {isOver && limit.isActive && (
                  <p className="text-xs text-red-400">{t('spending.exceeded')}</p>
                )}
                {isWarning && limit.isActive && (
                  <p className="text-xs text-yellow-400">
                    {t('spending.approaching', { pct: pct.toFixed(0) })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Spending summary */}
      {spendingHistory.length > 0 && (
        <div className="card space-y-2">
          <h3 className="font-medium text-sm text-gray-400">{t('spending.summary')}</h3>
          <div className="grid grid-cols-3 gap-3">
            {PERIODS.map((p) => {
              const start = getPeriodStart(p);
              const total = spendingHistory
                .filter((r) => r.timestamp >= start)
                .reduce((sum, r) => sum + r.amount, 0);
              return (
                <div key={p} className="text-center">
                  <p className="text-xs text-gray-500">{t(`spending.${p}`)}</p>
                  <p className="font-mono font-medium">${total.toFixed(2)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
