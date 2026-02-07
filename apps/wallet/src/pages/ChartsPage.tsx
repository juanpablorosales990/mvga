import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PriceChart from '../components/PriceChart';
import { fetchPriceHistory, calculateChange } from '../services/priceHistory';
import type { PricePoint } from '../services/priceHistory';
import { usePrices } from '../hooks/usePrices';
import FiatValue from '../components/FiatValue';

const TIMEFRAMES = [
  { label: '24h', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
];

const TOKENS = [
  { symbol: 'MVGA', name: 'Make Venezuela Great Again' },
  { symbol: 'SOL', name: 'Solana' },
];

export default function ChartsPage() {
  const { t } = useTranslation();
  const { prices } = usePrices();
  const [selectedToken, setSelectedToken] = useState<'SOL' | 'MVGA'>('MVGA');
  const [selectedTimeframe, setSelectedTimeframe] = useState(7);
  const [data, setData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPriceHistory(selectedToken, selectedTimeframe).then((points) => {
      setData(points);
      setLoading(false);
    });
  }, [selectedToken, selectedTimeframe]);

  const { change, percent } = calculateChange(data);
  const isPositive = change >= 0;
  const currentPrice = selectedToken === 'SOL' ? prices.sol : prices.mvga;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('charts.title')}</h1>

      {/* Token Selector */}
      <div className="flex bg-white/5 p-1">
        {TOKENS.map((tok) => (
          <button
            key={tok.symbol}
            onClick={() => setSelectedToken(tok.symbol as 'SOL' | 'MVGA')}
            className={`flex-1 py-2 font-medium text-sm transition ${
              selectedToken === tok.symbol ? 'bg-gold-500 text-black' : 'text-gray-400'
            }`}
          >
            {tok.symbol}
          </button>
        ))}
      </div>

      {/* Price Header */}
      <div className="card">
        <p className="text-gray-400 text-sm">
          {TOKENS.find((t) => t.symbol === selectedToken)?.name}
        </p>
        <div className="flex items-baseline gap-3">
          <h2 className="text-3xl font-bold">
            ${currentPrice < 1 ? currentPrice.toFixed(6) : currentPrice.toFixed(2)}
          </h2>
          <span className={`text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}
            {percent.toFixed(2)}%
          </span>
        </div>
        <FiatValue amount={1} token={selectedToken} className="text-sm text-gray-500" />
      </div>

      {/* Timeframe Tabs */}
      <div className="flex gap-2">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.days}
            onClick={() => setSelectedTimeframe(tf.days)}
            className={`flex-1 py-2 text-sm font-medium transition ${
              selectedTimeframe === tf.days
                ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                : 'bg-white/5 text-gray-400'
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="card">
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-gray-400">
            {t('charts.noData')}
          </div>
        ) : (
          <PriceChart data={data} positive={isPositive} height={200} />
        )}
      </div>

      {/* Stats */}
      {data.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card text-center">
            <p className="text-gray-400 text-xs">{t('charts.high')}</p>
            <p className="font-semibold">
              ${Math.max(...data.map((d) => d.price)).toFixed(currentPrice < 1 ? 6 : 2)}
            </p>
          </div>
          <div className="card text-center">
            <p className="text-gray-400 text-xs">{t('charts.low')}</p>
            <p className="font-semibold">
              ${Math.min(...data.map((d) => d.price)).toFixed(currentPrice < 1 ? 6 : 2)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
