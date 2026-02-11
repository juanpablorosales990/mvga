import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { usePrices } from '../hooks/usePrices';
import { useAuth } from '../hooks/useAuth';
import { useWalletStore } from '../stores/walletStore';
import { showToast } from '../hooks/useToast';
import { SkeletonStatCard } from '../components/Skeleton';
import { API_URL } from '../config';

interface StakingData {
  totalStaked: number;
  pendingRewards: number;
  apy: number;
  tier: string;
}

interface ReferralStats {
  totalReferrals: number;
  totalEarned: number;
}

interface RecentTx {
  id: string;
  type: string;
  amount: number;
  token: string;
  createdAt: string;
}

const PIE_COLORS = ['#3b82f6', '#22c55e', '#ec4899'];

export default function PortfolioPage() {
  const { t } = useTranslation();
  const { connected, publicKey } = useSelfCustodyWallet();
  const { isAuthenticated } = useAuth();
  const preferredCurrency = useWalletStore((s) => s.preferredCurrency);
  const totalUsdValue = useWalletStore((s) => s.totalUsdValue);
  const { prices, formatUsdValue } = usePrices();

  const [staking, setStaking] = useState<StakingData | null>(null);
  const [referrals, setReferrals] = useState<ReferralStats | null>(null);
  const [recentTxs, setRecentTxs] = useState<RecentTx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!connected || !publicKey) return;
    const controller = new AbortController();
    const addr = publicKey.toBase58();
    setLoading(true);

    const fetches = [
      // Staking data
      fetch(`${API_URL}/staking/${addr}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => setStaking(data))
        .catch(() => null),

      // Referral stats (authed)
      isAuthenticated
        ? fetch(`${API_URL}/referrals/stats`, {
            credentials: 'include',
            signal: controller.signal,
          })
            .then((r) => r.json())
            .then((data) => setReferrals(data))
            .catch(() => null)
        : Promise.resolve(),

      // Recent transactions
      fetch(`${API_URL}/wallet/${addr}/transaction-log?limit=5`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => setRecentTxs(Array.isArray(data) ? data : []))
        .catch(() => null),
    ];

    Promise.all(fetches)
      .catch((err) => {
        if (err?.name !== 'AbortError') showToast('error', t('common.somethingWrong'));
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [connected, publicKey, isAuthenticated, t]);

  const stakedValueUsd = (staking?.totalStaked ?? 0) * prices.mvga;
  const referralValueUsd = (referrals?.totalEarned ?? 0) * prices.mvga;
  const totalPortfolio = totalUsdValue + stakedValueUsd + referralValueUsd;

  const pieData = [
    { name: t('portfolio.walletBalances'), value: totalUsdValue },
    { name: t('portfolio.staked'), value: stakedValueUsd },
    { name: t('portfolio.referralEarnings'), value: referralValueUsd },
  ].filter((d) => d.value > 0);

  const formatTotal = (usd: number) => formatUsdValue(usd, preferredCurrency);

  if (!connected) {
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
          <h1 className="text-2xl font-bold">{t('portfolio.title')}</h1>
        </div>
        <div className="card p-8 text-center">
          <p className="text-gray-400">{t('portfolio.connectPrompt')}</p>
        </div>
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
        <h1 className="text-2xl font-bold">{t('portfolio.title')}</h1>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonStatCard key={i} />
          ))}
        </div>
      ) : (
        <>
          {/* Total Portfolio Value */}
          <div className="card p-5 bg-gradient-to-br from-primary-500/10 to-primary-600/5 border-gold-500/20">
            <p className="text-sm text-gray-400">{t('portfolio.totalValue')}</p>
            <p className="text-3xl font-bold mt-1">{formatTotal(totalPortfolio)}</p>
          </div>

          {/* Pie Chart */}
          {pieData.length > 0 && (
            <div className="card p-4">
              <h2 className="font-semibold mb-3">{t('portfolio.allocation')}</h2>
              <div className="flex items-center gap-4">
                <div className="w-32 h-32 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={55}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-sm">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="text-gray-300 truncate">{d.name}</span>
                      <span className="text-gray-500 ml-auto flex-shrink-0">
                        {formatTotal(d.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Staking Summary */}
          {staking && staking.totalStaked > 0 && (
            <div className="card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{t('portfolio.stakingSummary')}</h2>
                <Link to="/stake" className="text-xs text-gold-400 hover:text-gold-300">
                  {t('portfolio.viewStaking')}
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-400">{t('stake.staked')}</p>
                  <p className="font-medium">{staking.totalStaked.toLocaleString()} MVGA</p>
                </div>
                <div>
                  <p className="text-gray-400">{t('stake.rewards')}</p>
                  <p className="font-medium">{staking.pendingRewards.toLocaleString()} MVGA</p>
                </div>
                <div>
                  <p className="text-gray-400">{t('stake.yourApy')}</p>
                  <p className="font-medium text-green-400">{staking.apy.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-gray-400">{t('stake.currentTier')}</p>
                  <p className="font-medium">{staking.tier}</p>
                </div>
              </div>
            </div>
          )}

          {/* Referral Summary */}
          {referrals && referrals.totalReferrals > 0 && (
            <div className="card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{t('portfolio.referralSummary')}</h2>
                <Link to="/referral" className="text-xs text-gold-400 hover:text-gold-300">
                  {t('portfolio.viewReferrals')}
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-400">{t('referral.totalReferrals')}</p>
                  <p className="font-medium">{referrals.totalReferrals}</p>
                </div>
                <div>
                  <p className="text-gray-400">{t('referral.totalEarned')}</p>
                  <p className="font-medium">{referrals.totalEarned.toLocaleString()} MVGA</p>
                </div>
              </div>
            </div>
          )}

          {/* Recent Activity */}
          {recentTxs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{t('portfolio.recentActivity')}</h2>
                <Link to="/history" className="text-xs text-gold-400 hover:text-gold-300">
                  {t('wallet.viewAll')}
                </Link>
              </div>
              {recentTxs.map((tx) => (
                <div key={tx.id} className="card p-3 flex items-center gap-3">
                  <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-400">
                    {tx.type}
                  </span>
                  <span className="text-sm flex-1">
                    {tx.amount} {tx.token}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
