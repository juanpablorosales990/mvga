import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWalletStore } from '../stores/walletStore';
import { usePrices } from '../hooks/usePrices';

const ALERT_TOKENS = ['SOL', 'USDC', 'USDT', 'MVGA'] as const;

export default function PriceAlertsPage() {
  const { t } = useTranslation();
  const priceAlerts = useWalletStore((s) => s.priceAlerts);
  const addPriceAlert = useWalletStore((s) => s.addPriceAlert);
  const removePriceAlert = useWalletStore((s) => s.removePriceAlert);
  const { prices } = usePrices();

  const [showAdd, setShowAdd] = useState(false);
  const [token, setToken] = useState<string>('SOL');
  const [condition, setCondition] = useState<'above' | 'below'>('above');
  const [targetPrice, setTargetPrice] = useState('');

  const getCurrentPrice = (tkn: string): number => {
    const key = tkn.toLowerCase() as keyof typeof prices;
    return key in prices ? (prices[key] as number) : 0;
  };

  const formatPrice = (tkn: string, price: number): string => {
    if (tkn === 'USDC' || tkn === 'USDT') return price.toFixed(4);
    if (tkn === 'MVGA') return price.toFixed(6);
    return price.toFixed(2);
  };

  const handleCreate = () => {
    const target = parseFloat(targetPrice);
    if (isNaN(target) || target <= 0) return;

    addPriceAlert({ token, condition, targetPrice: target });
    setTargetPrice('');
    setShowAdd(false);
  };

  const activeAlerts = priceAlerts.filter((a) => !a.triggered);
  const triggeredAlerts = priceAlerts.filter((a) => a.triggered);

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
          <h1 className="text-2xl font-bold">{t('priceAlerts.title')}</h1>
          <p className="text-sm text-gray-400">{t('priceAlerts.subtitle')}</p>
        </div>
      </div>

      {/* Current Prices */}
      <div className="grid grid-cols-2 gap-3">
        {ALERT_TOKENS.map((tkn) => (
          <div key={tkn} className="card p-3 text-center">
            <p className="text-xs text-gray-400">{tkn}</p>
            <p className="text-lg font-bold">${formatPrice(tkn, getCurrentPrice(tkn))}</p>
          </div>
        ))}
      </div>

      {/* Add Alert Form */}
      {showAdd ? (
        <div className="card p-4 space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-2">{t('priceAlerts.token')}</label>
            <select
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-gold-500"
            >
              {ALERT_TOKENS.map((tkn) => (
                <option key={tkn} value={tkn}>
                  {tkn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">{t('priceAlerts.condition')}</label>
            <div className="flex gap-2">
              <button
                onClick={() => setCondition('above')}
                className={`flex-1 py-2 text-sm font-medium transition ${
                  condition === 'above'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                    : 'bg-white/5 text-gray-400 border border-white/10'
                }`}
              >
                {t('priceAlerts.above')}
              </button>
              <button
                onClick={() => setCondition('below')}
                className={`flex-1 py-2 text-sm font-medium transition ${
                  condition === 'below'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : 'bg-white/5 text-gray-400 border border-white/10'
                }`}
              >
                {t('priceAlerts.below')}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              {t('priceAlerts.targetPrice')}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="0.00"
                step="any"
                className="w-full bg-white/5 border border-white/10 pl-8 pr-4 py-3 text-sm focus:outline-none focus:border-gold-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t('priceAlerts.currentPrice', { price: formatPrice(token, getCurrentPrice(token)) })}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowAdd(false);
                setTargetPrice('');
              }}
              className="flex-1 py-2.5 bg-white/10 text-gray-300 text-sm"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleCreate}
              disabled={!targetPrice || parseFloat(targetPrice) <= 0}
              className="flex-1 btn-primary text-sm disabled:opacity-50"
            >
              {t('priceAlerts.create')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-3 border border-dashed border-white/20 text-gray-400 text-sm hover:bg-white/5 transition"
        >
          + {t('priceAlerts.addAlert')}
        </button>
      )}

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-sm text-gray-400">{t('priceAlerts.active')}</h2>
          {activeAlerts.map((alert) => (
            <div key={alert.id} className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium ${
                    alert.condition === 'above'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {alert.condition === 'above' ? '\u2191' : '\u2193'}
                </span>
                <div>
                  <p className="text-sm font-medium">
                    {alert.token} {alert.condition === 'above' ? '>' : '<'} ${alert.targetPrice}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t('priceAlerts.currentPrice', {
                      price: formatPrice(alert.token, getCurrentPrice(alert.token)),
                    })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => removePriceAlert(alert.id)}
                className="text-xs text-red-400 px-2 py-1 hover:bg-red-500/10 transition"
              >
                {t('priceAlerts.delete')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Triggered Alerts */}
      {triggeredAlerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-sm text-gray-400">{t('priceAlerts.triggered')}</h2>
          {triggeredAlerts.map((alert) => (
            <div key={alert.id} className="card p-4 flex items-center justify-between opacity-60">
              <div className="flex items-center gap-3">
                <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-400 font-medium">
                  ✓
                </span>
                <div>
                  <p className="text-sm font-medium line-through">
                    {alert.token} {alert.condition === 'above' ? '>' : '<'} ${alert.targetPrice}
                  </p>
                </div>
              </div>
              <button
                onClick={() => removePriceAlert(alert.id)}
                className="text-xs text-gray-500 px-2 py-1 hover:bg-white/10 transition"
              >
                {t('priceAlerts.delete')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {priceAlerts.length === 0 && !showAdd && (
        <p className="text-center text-gray-500 text-sm py-8">{t('priceAlerts.noAlerts')}</p>
      )}
    </div>
  );
}
