import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

interface TreasuryStats {
  mainBalance: number;
  liquidityBalance: number;
  stakingBalance: number;
  grantsBalance: number;
  totalRevenue: number;
  totalDistributed: number;
  pendingDistribution: number;
  nextDistributionAt: string;
  lastDistributionAt: string | null;
  distributionBreakdown: {
    liquidityPercent: number;
    stakingPercent: number;
    grantsPercent: number;
  };
}

interface Distribution {
  id: string;
  totalAmount: number;
  burnAmount: number;
  liquidityAmount: number;
  stakingAmount: number;
  grantsAmount: number;
  status: string;
  periodStart: string;
  periodEnd: string;
  executedAt: string | null;
  transactions: {
    burn: string | null;
    liquidity: string | null;
    staking: string | null;
    grants: string | null;
  };
}

interface BurnStats {
  totalBurned: number;
  burnCount: number;
  lastBurnAt: string | null;
  lastBurnAmount: number;
  lastBurnTx: string | null;
  supplyReduction: number;
}

interface BurnRecord {
  id: string;
  amount: number;
  signature: string;
  source: string;
  createdAt: string;
}

import { API_URL } from '../config';

export default function TransparencyPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<TreasuryStats | null>(null);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [burnStats, setBurnStats] = useState<BurnStats | null>(null);
  const [burnHistory, setBurnHistory] = useState<BurnRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        const [statsRes, distRes, burnStatsRes, burnHistRes] = await Promise.all([
          fetch(`${API_URL}/treasury/stats`, { signal: controller.signal }),
          fetch(`${API_URL}/treasury/distributions?limit=5`, { signal: controller.signal }),
          fetch(`${API_URL}/burn/stats`, { signal: controller.signal }),
          fetch(`${API_URL}/burn/history?limit=5`, { signal: controller.signal }),
        ]);

        if (statsRes.ok) setStats(await statsRes.json());
        if (distRes.ok) setDistributions(await distRes.json());
        if (burnStatsRes.ok) setBurnStats(await burnStatsRes.json());
        if (burnHistRes.ok) setBurnHistory(await burnHistRes.json());
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, []);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
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
        <h1 className="text-2xl font-bold">{t('transparency.title')}</h1>
      </div>

      {/* Mission Statement */}
      <div className="card bg-gradient-to-br from-primary-500/20 to-transparent border border-gold-500/30">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-gold-500/20 rounded-full flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5 text-gold-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-lg">{t('transparency.mission')}</h2>
            <p className="text-sm text-gray-400 mt-1">{t('transparency.missionText')}</p>
          </div>
        </div>
      </div>

      {/* Distribution Breakdown */}
      <div className="card">
        <h2 className="font-semibold mb-4">{t('transparency.howFundsDistributed')}</h2>
        <div className="space-y-4">
          {/* Liquidity */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500/20 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <span className="font-medium">{t('transparency.liquidity')}</span>
                <span className="text-blue-400 font-bold">40%</span>
              </div>
              <p className="text-xs text-gray-400">{t('transparency.liquidityDesc')}</p>
              <div className="mt-2 h-2 bg-white/10 rounded-full">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: '40%' }} />
              </div>
            </div>
          </div>

          {/* Staking */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500/20 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <span className="font-medium">{t('transparency.stakingRewards')}</span>
                <span className="text-green-400 font-bold">40%</span>
              </div>
              <p className="text-xs text-gray-400">{t('transparency.stakingDesc')}</p>
              <div className="mt-2 h-2 bg-white/10 rounded-full">
                <div className="h-full bg-green-500 rounded-full" style={{ width: '40%' }} />
              </div>
            </div>
          </div>

          {/* Grants */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-500/20 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-yellow-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <span className="font-medium">{t('transparency.grants')}</span>
                <span className="text-yellow-400 font-bold">20%</span>
              </div>
              <p className="text-xs text-gray-400">{t('transparency.grantsDesc')}</p>
              <div className="mt-2 h-2 bg-white/10 rounded-full">
                <div className="h-full bg-yellow-500 rounded-full" style={{ width: '20%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Token Burns */}
      {burnStats && burnStats.totalBurned > 0 && (
        <div className="card bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
              <span className="text-xl">🔥</span>
            </div>
            <div>
              <h2 className="font-semibold">{t('transparency.tokenBurns')}</h2>
              <p className="text-xs text-gray-400">{t('transparency.burnDesc')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 p-3 text-center">
              <p className="text-xs text-gray-400">{t('transparency.totalBurned')}</p>
              <p className="font-bold text-lg text-red-400">
                {formatNumber(burnStats.totalBurned)}
              </p>
              <p className="text-xs text-gray-500">MVGA</p>
            </div>
            <div className="bg-white/5 p-3 text-center">
              <p className="text-xs text-gray-400">{t('transparency.supplyReduced')}</p>
              <p className="font-bold text-lg text-red-400">
                {burnStats.supplyReduction.toFixed(4)}%
              </p>
              <p className="text-xs text-gray-500">{t('transparency.ofTotalSupply')}</p>
            </div>
          </div>
          {burnHistory.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <h3 className="text-sm font-medium mb-2">{t('transparency.recentBurns')}</h3>
              <div className="space-y-2">
                {burnHistory.map((burn) => (
                  <div key={burn.id} className="flex justify-between items-center text-sm">
                    <div>
                      <span className="text-red-400">{formatNumber(burn.amount)} MVGA</span>
                      <span className="text-xs text-gray-500 ml-2">{burn.source}</span>
                    </div>
                    <a
                      href={`https://solscan.io/tx/${burn.signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gold-500 hover:text-gold-400"
                    >
                      {formatDate(burn.createdAt)} →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Treasury Balances */}
      {stats && (
        <div className="card">
          <h2 className="font-semibold mb-4">{t('transparency.treasuryBalances')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 p-3 text-center">
              <p className="text-xs text-gray-400">{t('transparency.liquidity')}</p>
              <p className="font-bold text-lg">{formatNumber(stats.liquidityBalance)}</p>
              <p className="text-xs text-gray-500">MVGA</p>
            </div>
            <div className="bg-white/5 p-3 text-center">
              <p className="text-xs text-gray-400">{t('transparency.stakingRewards')}</p>
              <p className="font-bold text-lg">{formatNumber(stats.stakingBalance)}</p>
              <p className="text-xs text-gray-500">MVGA</p>
            </div>
            <div className="bg-white/5 p-3 text-center">
              <p className="text-xs text-gray-400">{t('transparency.grants')}</p>
              <p className="font-bold text-lg">{formatNumber(stats.grantsBalance)}</p>
              <p className="text-xs text-gray-500">MVGA</p>
            </div>
            <div className="bg-white/5 p-3 text-center">
              <p className="text-xs text-gray-400">{t('transparency.pending')}</p>
              <p className="font-bold text-lg">{formatNumber(stats.pendingDistribution)}</p>
              <p className="text-xs text-gray-500">MVGA</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">{t('transparency.totalDistributed')}</span>
              <span className="font-medium">{formatNumber(stats.totalDistributed)} MVGA</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-400">{t('transparency.nextDistribution')}</span>
              <span className="font-medium">{formatDate(stats.nextDistributionAt)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Distributions */}
      {distributions.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-4">{t('transparency.recentDistributions')}</h2>
          <div className="space-y-3">
            {distributions.map((dist) => (
              <div key={dist.id} className="bg-white/5 p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">{formatDate(dist.periodEnd)}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      dist.status === 'COMPLETED'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}
                  >
                    {dist.status}
                  </span>
                </div>
                <div className="text-sm text-gray-400">
                  <div className="flex justify-between">
                    <span>{t('transparency.total')}</span>
                    <span className="text-white">{formatNumber(dist.totalAmount)} MVGA</span>
                  </div>
                </div>
                {dist.transactions.liquidity && (
                  <a
                    href={`https://solscan.io/tx/${dist.transactions.liquidity}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gold-500 hover:text-gold-400 mt-2 block"
                  >
                    {t('common.viewOnSolscan')} →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wallet Addresses */}
      <div className="card">
        <h2 className="font-semibold mb-4">{t('transparency.verifyOnChain')}</h2>
        <p className="text-sm text-gray-400 mb-4">{t('transparency.verifyText')}</p>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-gray-400 text-xs">{t('transparency.liquidityWallet')}</p>
            <a
              href="https://solscan.io/account/HWRFGiMDWNvPHo5ZLV1MJEDjDNFVDJ8KJMDXcJjLVGa8"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-500 break-all hover:underline"
            >
              HWRFGiM...LVGa8
            </a>
          </div>
          <div>
            <p className="text-gray-400 text-xs">{t('transparency.stakingWallet')}</p>
            <a
              href="https://solscan.io/account/GNhLCjqThNJAJAdDYvRTr2EfWyGXAFUymaPuKaL1duEh"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-500 break-all hover:underline"
            >
              GNhLCjq...duEh
            </a>
          </div>
          <div>
            <p className="text-gray-400 text-xs">{t('transparency.grantsWallet')}</p>
            <a
              href="https://solscan.io/account/9oeQpF87vYz1LmHDBqx1xvGsFxbRVJXmgNvRFYg3e8AQ"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-500 break-all hover:underline"
            >
              9oeQpF8...e8AQ
            </a>
          </div>
        </div>
      </div>

      {/* Zero Founder Fees */}
      <div className="card bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-green-400"
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
          </div>
          <div>
            <h3 className="font-semibold">{t('transparency.zeroFounderFees')}</h3>
            <p className="text-sm text-gray-400">{t('transparency.zeroFounderFeesText')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
