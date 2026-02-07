import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { usePrices } from '../hooks/usePrices';
import { useWalletStore } from '../stores/walletStore';
import { useCard } from '../hooks/useCard';
import { showToast } from '../hooks/useToast';
import { SkeletonStatCard } from '../components/Skeleton';
import { API_URL } from '../config';

interface RecentTx {
  id: string;
  type: string;
  amount: number;
  token: string;
  createdAt: string;
}

const EARN_OPPORTUNITIES = [
  { protocol: 'Kamino', apy: 5.2, token: 'USDC' },
  { protocol: 'MarginFi', apy: 4.8, token: 'USDT' },
  { protocol: 'Drift', apy: 6.1, token: 'USDC' },
];

export default function BankingPage() {
  const { t } = useTranslation();
  const { connected, publicKey } = useSelfCustodyWallet();
  const balances = useWalletStore((s) => s.balances);
  const preferredCurrency = useWalletStore((s) => s.preferredCurrency);
  const { prices, formatUsdValue } = usePrices();
  const [recentTxs, setRecentTxs] = useState<RecentTx[]>([]);
  const [loading, setLoading] = useState(true);

  const { cardStatus, card, balance: cardBalance } = useCard();
  const usdcBalance = balances.find((b) => b.symbol === 'USDC');
  const usdtBalance = balances.find((b) => b.symbol === 'USDT');
  const stablecoinUsd = (usdcBalance?.usdValue ?? 0) + (usdtBalance?.usdValue ?? 0);

  const mockApy = 5.2;
  const projectedMonthly = (stablecoinUsd * (mockApy / 100)) / 12;

  useEffect(() => {
    if (!connected || !publicKey) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const addr = publicKey.toBase58();
    setLoading(true);
    fetch(`${API_URL}/wallet/${addr}/transaction-log?limit=5`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        const txs = Array.isArray(data) ? data : [];
        setRecentTxs(txs.filter((tx: RecentTx) => tx.token === 'USDC' || tx.token === 'USDT'));
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') showToast('error', t('common.somethingWrong'));
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [connected, publicKey, t]);

  const formatUsd = (usd: number) => formatUsdValue(usd, preferredCurrency);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('banking.connectPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('banking.title')}</h1>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonStatCard key={i} />
          ))}
        </div>
      ) : (
        <>
          {/* Stablecoin Balance */}
          <div className="card p-5 bg-gradient-to-br from-green-500/10 to-emerald-600/5 border-green-500/20">
            <p className="text-sm text-gray-400">{t('banking.stablecoinBalance')}</p>
            <p className="text-3xl font-bold mt-1">{formatUsd(stablecoinUsd)}</p>
            <div className="flex gap-3 mt-2 text-xs text-gray-400">
              {usdcBalance && <span>{usdcBalance.balance.toLocaleString()} USDC</span>}
              {usdtBalance && <span>{usdtBalance.balance.toLocaleString()} USDT</span>}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-3">
            <Link
              to="/receive"
              className="card p-3 flex flex-col items-center gap-2 hover:bg-white/10 transition"
            >
              <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </div>
              <span className="text-xs font-medium">{t('banking.deposit')}</span>
            </Link>
            <Link
              to="/send"
              className="card p-3 flex flex-col items-center gap-2 hover:bg-white/10 transition"
            >
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                  />
                </svg>
              </div>
              <span className="text-xs font-medium">{t('banking.withdraw')}</span>
            </Link>
            <Link
              to="/banking/card"
              className="card p-3 flex flex-col items-center gap-2 hover:bg-white/10 transition"
            >
              <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-purple-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>
              <span className="text-xs font-medium">
                {cardStatus === 'active' || cardStatus === 'frozen'
                  ? t('card.myCard')
                  : t('banking.card')}
              </span>
            </Link>
          </div>

          {/* Savings Preview */}
          <Link
            to="/banking/savings"
            className="card p-4 space-y-2 hover:bg-white/5 transition block"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{t('banking.savingsPreview')}</h2>
              <span className="text-xs text-gold-400">{t('banking.viewSavings')}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold">{formatUsd(stablecoinUsd)}</span>
              <span className="text-xs text-green-400 font-medium">
                {mockApy}% {t('banking.apy')}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              {t('banking.projectedMonthly')}: {formatUsd(projectedMonthly)}
            </p>
          </Link>

          {/* Virtual Card Preview */}
          {cardStatus === 'active' || cardStatus === 'frozen' ? (
            <Link
              to="/banking/card"
              className="card overflow-hidden block hover:bg-white/5 transition"
            >
              <div
                className="relative p-5"
                style={{
                  background:
                    cardStatus === 'frozen'
                      ? 'linear-gradient(135deg, #374151, #1f2937)'
                      : 'linear-gradient(135deg, #f59e0b, #b45309)',
                }}
              >
                {cardStatus === 'frozen' && (
                  <div className="absolute top-3 right-3 bg-red-500/80 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                    {t('card.frozen')}
                  </div>
                )}
                <p className="text-white/70 text-xs font-medium tracking-wider">MVGA</p>
                <p className="text-white font-mono text-lg mt-6 tracking-widest">
                  •••• •••• •••• {card?.last4 ?? '4242'}
                </p>
                <div className="flex justify-between items-end mt-4">
                  <div>
                    <p className="text-white/50 text-[10px]">{t('banking.cardHolder')}</p>
                    <p className="text-white text-sm font-medium">
                      {card?.cardholderName ?? 'MVGA USER'}
                    </p>
                  </div>
                  <p className="text-white/70 text-sm font-medium">VISA</p>
                </div>
              </div>
              <div className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">{t('card.balance')}</p>
                  <p className="text-lg font-bold">
                    ${cardBalance?.available.toFixed(2) ?? '0.00'}
                  </p>
                </div>
                <span className="text-xs text-gold-400">{t('card.manage')}</span>
              </div>
            </Link>
          ) : (
            <div className="card overflow-hidden">
              <div
                className="relative p-5"
                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
              >
                <div className="absolute top-3 right-3 bg-black/30 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                  {t('banking.comingSoon')}
                </div>
                <p className="text-white/70 text-xs font-medium tracking-wider">MVGA</p>
                <p className="text-white font-mono text-lg mt-6 tracking-widest">
                  {t('banking.cardNumber')}
                </p>
                <div className="flex justify-between items-end mt-4">
                  <div>
                    <p className="text-white/50 text-[10px]">{t('banking.cardHolder')}</p>
                    <p className="text-white text-sm font-medium">MVGA USER</p>
                  </div>
                  <p className="text-white/70 text-sm font-medium">VISA</p>
                </div>
              </div>
              <div className="p-4">
                <h2 className="font-semibold">{t('banking.virtualCard')}</h2>
                <p className="text-xs text-gray-400 mt-1">{t('banking.cardFeatures')}</p>
                <Link
                  to="/banking/card"
                  className="mt-3 block w-full text-center py-2.5 bg-gold-500 text-black font-medium text-sm hover:bg-gold-400 transition"
                >
                  {t('banking.joinWaitlist')}
                </Link>
              </div>
            </div>
          )}

          {/* Recent Stablecoin Transactions */}
          {recentTxs.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-semibold">{t('banking.recentStablecoinTx')}</h2>
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

          {/* Earn Section */}
          <div className="space-y-3">
            <h2 className="font-semibold">{t('banking.earnTitle')}</h2>
            {EARN_OPPORTUNITIES.map((opp) => (
              <div key={opp.protocol} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{opp.protocol}</p>
                  <p className="text-xs text-gray-400">{opp.token}</p>
                </div>
                <span className="text-green-400 font-semibold">{opp.apy}% APY</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
