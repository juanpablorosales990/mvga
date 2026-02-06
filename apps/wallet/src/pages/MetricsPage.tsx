import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

interface Metrics {
  tvl: number;
  volume24h: number;
  revenue24h: number;
  totalUsers: number;
  activeUsers: number;
  totalStakers: number;
  totalBurned: number;
  snapshotAt: string | null;
}

interface HistoryPoint {
  tvl: number;
  volume24h: number;
  revenue24h: number;
  totalUsers: number;
  activeUsers: number;
  totalStakers: number;
  totalBurned: number;
  snapshotAt: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const PERIODS = ['24h', '7d', '30d'] as const;

export default function MetricsPage() {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('7d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${API_URL}/metrics`);
        if (res.ok) setMetrics(await res.json());
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      }
    };
    fetchMetrics();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/metrics/history?period=${period}`, {
          signal: controller.signal,
        });
        if (res.ok) setHistory(await res.json());
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Failed to fetch metrics history:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
    return () => controller.abort();
  }, [period]);

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num);
  };

  const chartData = history.map((h) => ({
    time: new Date(h.snapshotAt).getTime(),
    tvl: h.tvl,
    volume: h.volume24h,
    revenue: h.revenue24h,
    users: h.activeUsers,
  }));

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
        <h1 className="text-2xl font-bold">{t('metrics.title')}</h1>
      </div>

      {/* Stat Cards */}
      {metrics && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20">
            <p className="text-xs text-gray-400">{t('metrics.tvl')}</p>
            <p className="font-bold text-xl text-blue-400">{formatNumber(metrics.tvl)}</p>
            <p className="text-xs text-gray-500">MVGA</p>
          </div>
          <div className="card bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20">
            <p className="text-xs text-gray-400">{t('metrics.volume24h')}</p>
            <p className="font-bold text-xl text-green-400">{formatNumber(metrics.volume24h)}</p>
            <p className="text-xs text-gray-500">MVGA</p>
          </div>
          <div className="card bg-gradient-to-br from-yellow-500/10 to-transparent border border-yellow-500/20">
            <p className="text-xs text-gray-400">{t('metrics.revenue24h')}</p>
            <p className="font-bold text-xl text-yellow-400">{formatNumber(metrics.revenue24h)}</p>
            <p className="text-xs text-gray-500">MVGA</p>
          </div>
          <div className="card bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20">
            <p className="text-xs text-gray-400">{t('metrics.totalBurned')}</p>
            <p className="font-bold text-xl text-red-400">{formatNumber(metrics.totalBurned)}</p>
            <p className="text-xs text-gray-500">MVGA</p>
          </div>
        </div>
      )}

      {/* User Stats */}
      {metrics && (
        <div className="card">
          <h2 className="font-semibold mb-3">{t('metrics.users')}</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="font-bold text-lg">{metrics.totalUsers.toLocaleString()}</p>
              <p className="text-xs text-gray-400">{t('metrics.totalUsers')}</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-lg">{metrics.activeUsers.toLocaleString()}</p>
              <p className="text-xs text-gray-400">{t('metrics.activeUsers')}</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-lg">{metrics.totalStakers.toLocaleString()}</p>
              <p className="text-xs text-gray-400">{t('metrics.stakers')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Period Tabs */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
              period === p
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                : 'bg-white/5 text-gray-400'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* TVL Chart */}
      <div className="card">
        <h2 className="font-semibold mb-3">{t('metrics.tvlOverTime')}</h2>
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-gray-400">
            {t('metrics.noData')}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tickFormatter={(ts) => {
                  const d = new Date(ts);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
                stroke="#666"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={['auto', 'auto']}
                stroke="#666"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatNumber(v)}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  fontSize: 12,
                }}
                labelFormatter={(ts) => new Date(ts as number).toLocaleString()}
                formatter={(value: number | undefined) => [
                  formatNumber(value ?? 0) + ' MVGA',
                  t('metrics.tvl'),
                ]}
              />
              <Area
                type="monotone"
                dataKey="tvl"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#tvlGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Volume Chart */}
      {chartData.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-3">{t('metrics.volumeOverTime')}</h2>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tickFormatter={(ts) => {
                  const d = new Date(ts);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
                stroke="#666"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={['auto', 'auto']}
                stroke="#666"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatNumber(v)}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  fontSize: 12,
                }}
                labelFormatter={(ts) => new Date(ts as number).toLocaleString()}
                formatter={(value: number | undefined) => [
                  formatNumber(value ?? 0) + ' MVGA',
                  t('metrics.volume24h'),
                ]}
              />
              <Area
                type="monotone"
                dataKey="volume"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#volumeGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Last Updated */}
      {metrics?.snapshotAt && (
        <p className="text-xs text-gray-500 text-center">
          {t('metrics.lastUpdated')}: {new Date(metrics.snapshotAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
