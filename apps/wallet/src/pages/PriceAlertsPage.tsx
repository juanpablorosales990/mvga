import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../hooks/useToast';

interface PriceAlert {
  id: string;
  alertType: 'TOKEN_PRICE' | 'VES_RATE';
  token: string | null;
  vesRateType: 'BCV_OFFICIAL' | 'PARALLEL_MARKET' | null;
  condition: 'ABOVE' | 'BELOW';
  targetPrice: number;
  status: 'ACTIVE' | 'TRIGGERED' | 'DISABLED';
  cooldownUntil: string | null;
  lastTriggered: string | null;
  triggerCount: number;
}

interface PricesResponse {
  tokens: Record<string, number>;
  ves: { official: number; parallel: number };
}

const ALERT_TOKENS = ['SOL', 'USDC', 'USDT', 'MVGA'] as const;
const VES_TYPES = ['BCV_OFFICIAL', 'PARALLEL_MARKET'] as const;

export default function PriceAlertsPage() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [prices, setPrices] = useState<PricesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'tokens' | 'ves'>('tokens');

  // Form state
  const [showAdd, setShowAdd] = useState(false);
  const [token, setToken] = useState<string>('SOL');
  const [vesRateType, setVesRateType] = useState<string>('PARALLEL_MARKET');
  const [condition, setCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [targetPrice, setTargetPrice] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [alertsData, pricesData] = await Promise.all([
        apiFetch<PriceAlert[]>('/price-alerts'),
        apiFetch<PricesResponse>('/price-alerts/rates'),
      ]);
      setAlerts(alertsData);
      setPrices(pricesData);
    } catch {
      showToast('error', t('common.somethingWrong'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatPrice = (tkn: string, price: number): string => {
    if (tkn === 'USDC' || tkn === 'USDT') return price.toFixed(4);
    if (tkn === 'MVGA') return price.toFixed(6);
    return price.toFixed(2);
  };

  const handleCreate = async () => {
    const target = parseFloat(targetPrice);
    if (isNaN(target) || target <= 0) return;

    const isVes = tab === 'ves';
    try {
      await apiFetch('/price-alerts', {
        method: 'POST',
        body: JSON.stringify({
          alertType: isVes ? 'VES_RATE' : 'TOKEN_PRICE',
          ...(isVes ? { vesRateType } : { token }),
          condition,
          targetPrice: target,
        }),
      });
      setTargetPrice('');
      setShowAdd(false);
      await fetchData();
    } catch (err) {
      showToast('error', (err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/price-alerts/${id}`, { method: 'DELETE' });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      showToast('error', t('common.somethingWrong'));
    }
  };

  const activeAlerts = alerts.filter((a) => a.status === 'ACTIVE');
  const triggeredAlerts = alerts.filter((a) => a.status === 'TRIGGERED');

  const getCooldownMinutes = (alert: PriceAlert): number | null => {
    if (!alert.cooldownUntil) return null;
    const remaining = new Date(alert.cooldownUntil).getTime() - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 60000) : null;
  };

  const getAlertLabel = (alert: PriceAlert): string => {
    if (alert.alertType === 'VES_RATE') {
      return alert.vesRateType === 'BCV_OFFICIAL'
        ? t('priceAlerts.bcvOfficial')
        : t('priceAlerts.parallelMarket');
    }
    return alert.token ?? '';
  };

  const getAlertPriceStr = (alert: PriceAlert): string => {
    if (alert.alertType === 'VES_RATE') {
      return `${alert.targetPrice.toFixed(2)} VES/USD`;
    }
    return `$${alert.targetPrice}`;
  };

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
          <h1 className="text-2xl font-bold">{t('priceAlerts.title')}</h1>
          <p className="text-sm text-gray-400">{t('priceAlerts.subtitle')}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
        <button
          onClick={() => setTab('tokens')}
          className={`flex-1 py-2 text-sm font-medium rounded transition ${
            tab === 'tokens' ? 'bg-white/10 text-white' : 'text-gray-400'
          }`}
        >
          {t('priceAlerts.tokenPrices')}
        </button>
        <button
          onClick={() => setTab('ves')}
          className={`flex-1 py-2 text-sm font-medium rounded transition ${
            tab === 'ves' ? 'bg-white/10 text-white' : 'text-gray-400'
          }`}
        >
          {t('priceAlerts.vesRates')}
        </button>
      </div>

      {/* Current Prices Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-3 text-center animate-pulse">
              <div className="h-3 w-10 mx-auto bg-gray-700 rounded mb-2" />
              <div className="h-6 w-16 mx-auto bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      ) : tab === 'tokens' ? (
        <div className="grid grid-cols-2 gap-3">
          {ALERT_TOKENS.map((tkn) => (
            <div key={tkn} className="card p-3 text-center">
              <p className="text-xs text-gray-400">{tkn}</p>
              <p className="text-lg font-bold">${formatPrice(tkn, prices?.tokens[tkn] ?? 0)}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-3 text-center">
            <p className="text-xs text-gray-400">{t('priceAlerts.bcvOfficial')}</p>
            <p className="text-lg font-bold">{(prices?.ves.official ?? 0).toFixed(2)}</p>
            <p className="text-xs text-gray-500">{t('priceAlerts.vesPerUsd')}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-gray-400">{t('priceAlerts.parallelMarket')}</p>
            <p className="text-lg font-bold">{(prices?.ves.parallel ?? 0).toFixed(2)}</p>
            <p className="text-xs text-gray-500">{t('priceAlerts.vesPerUsd')}</p>
          </div>
        </div>
      )}

      {/* Add Alert Form */}
      {showAdd ? (
        <div className="card p-4 space-y-3">
          {tab === 'tokens' ? (
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
          ) : (
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {t('priceAlerts.rateType')}
              </label>
              <select
                value={vesRateType}
                onChange={(e) => setVesRateType(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-gold-500"
              >
                {VES_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type === 'BCV_OFFICIAL'
                      ? t('priceAlerts.bcvOfficial')
                      : t('priceAlerts.parallelMarket')}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-2">{t('priceAlerts.condition')}</label>
            <div className="flex gap-2">
              <button
                onClick={() => setCondition('ABOVE')}
                className={`flex-1 py-2 text-sm font-medium transition ${
                  condition === 'ABOVE'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                    : 'bg-white/5 text-gray-400 border border-white/10'
                }`}
              >
                {t('priceAlerts.above')}
              </button>
              <button
                onClick={() => setCondition('BELOW')}
                className={`flex-1 py-2 text-sm font-medium transition ${
                  condition === 'BELOW'
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
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                {tab === 'ves' ? 'VES' : '$'}
              </span>
              <input
                type="number"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="0.00"
                step="any"
                className={`w-full bg-white/5 border border-white/10 pr-4 py-3 text-sm focus:outline-none focus:border-gold-500 ${
                  tab === 'ves' ? 'pl-12' : 'pl-8'
                }`}
              />
            </div>
            {prices && tab === 'tokens' && (
              <p className="text-xs text-gray-500 mt-1">
                {t('priceAlerts.currentPrice', {
                  price: formatPrice(token, prices.tokens[token] ?? 0),
                })}
              </p>
            )}
            {prices && tab === 'ves' && (
              <p className="text-xs text-gray-500 mt-1">
                {t('priceAlerts.currentRate', {
                  rate: (vesRateType === 'BCV_OFFICIAL'
                    ? prices.ves.official
                    : prices.ves.parallel
                  ).toFixed(2),
                })}
              </p>
            )}
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
          {activeAlerts.map((alert) => {
            const cooldownMins = getCooldownMinutes(alert);
            return (
              <div key={alert.id} className="card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${
                      alert.condition === 'ABOVE'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {alert.condition === 'ABOVE' ? '\u2191' : '\u2193'}
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {getAlertLabel(alert)} {alert.condition === 'ABOVE' ? '>' : '<'}{' '}
                      {getAlertPriceStr(alert)}
                    </p>
                    {cooldownMins && (
                      <p className="text-xs text-amber-400">
                        {t('priceAlerts.cooldownActive', { minutes: cooldownMins })}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(alert.id)}
                  className="text-xs text-red-400 px-2 py-1 hover:bg-red-500/10 transition"
                >
                  {t('priceAlerts.delete')}
                </button>
              </div>
            );
          })}
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
                  &#10003;
                </span>
                <p className="text-sm font-medium line-through">
                  {getAlertLabel(alert)} {alert.condition === 'ABOVE' ? '>' : '<'}{' '}
                  {getAlertPriceStr(alert)}
                </p>
              </div>
              <button
                onClick={() => handleDelete(alert.id)}
                className="text-xs text-gray-500 px-2 py-1 hover:bg-white/10 transition"
              >
                {t('priceAlerts.delete')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {alerts.length === 0 && !showAdd && !loading && (
        <p className="text-center text-gray-500 text-sm py-8">{t('priceAlerts.noAlerts')}</p>
      )}
    </div>
  );
}
