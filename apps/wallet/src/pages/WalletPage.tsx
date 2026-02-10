import { useConnection } from '@solana/wallet-adapter-react';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useTranslation } from 'react-i18next';
import TokenCard from '../components/TokenCard';
import GettingStartedCard from '../components/GettingStartedCard';
import { usePrices } from '../hooks/usePrices';
import { useWalletStore, TokenBalance } from '../stores/walletStore';
import { showToast } from '../hooks/useToast';
import { API_URL } from '../config';

const KNOWN_TOKENS: Record<
  string,
  { symbol: string; name: string; decimals: number; logoUrl: string }
> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoUrl:
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    logoUrl:
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
  },
  DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh: {
    symbol: 'MVGA',
    name: 'Make Venezuela Great Again',
    decimals: 9,
    logoUrl: 'https://gateway.irys.xyz/J47ckDJCqKGrt5QHo4ZjDSa4LcaitMFXkcEJ3qyM2qnD',
  },
};

export default function WalletPage() {
  const { t } = useTranslation();
  const { connected, publicKey } = useSelfCustodyWallet();
  const { connection } = useConnection();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const { formatUsdValue } = usePrices();
  const preferredCurrency = useWalletStore((s) => s.preferredCurrency);
  const kycStatus = useWalletStore((s) => s.kycStatus);
  const storeSetBalances = useWalletStore((s) => s.setBalances);
  const balanceVersion = useWalletStore((s) => s.balanceVersion);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchBalances() {
      if (!connected || !publicKey) {
        setBalances([]);
        setTotalValue(0);
        return;
      }

      setLoading(true);
      try {
        // Fetch SOL balance
        const solBalance = await connection.getBalance(publicKey);
        const solAmount = solBalance / LAMPORTS_PER_SOL;

        // Fetch SPL token accounts
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
          programId: TOKEN_PROGRAM_ID,
        });

        // Fetch prices from our API (centralizes CoinGecko + DexScreener)
        const tokenPrices: Record<string, number> = {};
        try {
          const priceRes = await fetch(`${API_URL}/wallet/prices`, { signal: controller.signal });
          if (priceRes.ok) {
            const data: { symbol: string; price: number }[] = await priceRes.json();
            const mintMap: Record<string, string> = {
              SOL: 'So11111111111111111111111111111111111111112',
              USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
              USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
              MVGA: 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh',
            };
            for (const entry of data) {
              const mint = mintMap[entry.symbol];
              if (mint) tokenPrices[mint] = entry.price;
            }
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') return;
          tokenPrices['So11111111111111111111111111111111111111112'] = 150;
        }

        const solPrice = tokenPrices['So11111111111111111111111111111111111111112'] || 0;

        const newBalances: TokenBalance[] = [
          {
            mint: 'So11111111111111111111111111111111111111112',
            symbol: 'SOL',
            name: 'Solana',
            balance: solAmount,
            decimals: 9,
            usdValue: solAmount * solPrice,
            logoUrl:
              'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
          },
        ];

        // Process SPL token accounts
        for (const { account } of tokenAccounts.value) {
          const parsed = account.data.parsed?.info;
          if (!parsed) continue;
          const mint = parsed.mint as string;
          const tokenInfo = KNOWN_TOKENS[mint];
          if (!tokenInfo) continue;

          const amount = Number(parsed.tokenAmount?.uiAmount || 0);
          const price = tokenPrices[mint] || 0;

          newBalances.push({
            mint,
            symbol: tokenInfo.symbol,
            name: tokenInfo.name,
            balance: amount,
            decimals: tokenInfo.decimals,
            usdValue: amount * price,
            logoUrl: tokenInfo.logoUrl,
          });
        }

        // Add MVGA with 0 balance if not found (so it always shows)
        if (!newBalances.find((b) => b.symbol === 'MVGA')) {
          newBalances.push({
            mint: 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh',
            symbol: 'MVGA',
            name: 'Make Venezuela Great Again',
            balance: 0,
            decimals: 9,
            usdValue: 0,
            logoUrl: 'https://gateway.irys.xyz/J47ckDJCqKGrt5QHo4ZjDSa4LcaitMFXkcEJ3qyM2qnD',
          });
        }

        setBalances(newBalances);
        setTotalValue(newBalances.reduce((sum, b) => sum + b.usdValue, 0));
        storeSetBalances(newBalances);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError')
          showToast('error', t('common.somethingWrong'));
      } finally {
        setLoading(false);
      }
    }

    fetchBalances();
    const interval = setInterval(fetchBalances, 30000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [connected, publicKey, connection, balanceVersion]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 border border-gold-500/30 flex items-center justify-center mb-6">
          <svg
            className="w-8 h-8 text-gold-500"
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
        <h2 className="text-2xl font-bold mb-2 uppercase tracking-tight">{t('wallet.title')}</h2>
        <p className="text-white/40 mb-6 max-w-sm text-sm">{t('wallet.connectPrompt')}</p>
        <p className="text-xs text-white/20 font-mono">{t('wallet.clickConnect')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Total Balance Card */}
      <div className="card text-center py-8">
        <p className="text-xs text-white/40 font-mono uppercase tracking-wider mb-2">
          {t('wallet.totalBalance')}
        </p>
        <h1 className="text-4xl font-black tracking-tight mb-2 font-mono">
          {formatUsdValue(totalValue, preferredCurrency)}
        </h1>
        <p className="text-xs text-white/20 font-mono">
          {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-8)}
        </p>
      </div>

      {/* Primary actions (Meru-style, MVGA-brutalist) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Link to="/deposit" className="btn-primary flex items-center justify-center gap-2">
          <span className="text-lg" aria-hidden="true">
            ↑
          </span>
          {t('wallet.deposit')}
        </Link>
        <Link to="/cashout" className="btn-secondary flex items-center justify-center gap-2">
          <span className="text-lg" aria-hidden="true">
            ↓
          </span>
          {t('cashout.title')}
        </Link>
        <Link
          to="/charge"
          className="btn-secondary col-span-2 md:col-span-1 flex items-center justify-center gap-2"
        >
          <span className="text-lg" aria-hidden="true">
            ↗
          </span>
          {t('wallet.charge')}
        </Link>
      </div>

      {/* Getting Started Checklist */}
      <GettingStartedCard />

      {/* KYC Banner */}
      {kycStatus !== 'APPROVED' && (
        <Link
          to="/kyc"
          className="card flex items-center gap-3 border border-gold-500/20 hover:border-gold-500/40 transition"
        >
          <div className="w-10 h-10 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
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
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">{t('kyc.verifyPrompt')}</p>
            <p className="text-xs text-white/30">{t('kyc.verifyDesc')}</p>
          </div>
          <span className="text-gold-500 text-sm font-mono flex-shrink-0">→</span>
        </Link>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-6 gap-2">
        {[
          { label: t('wallet.send'), icon: '↑', href: '/send' },
          { label: t('wallet.receive'), icon: '↓', href: '/receive' },
          { label: t('wallet.swap'), icon: '⇄', href: '/swap' },
          { label: t('wallet.deposit'), icon: '$', href: '/deposit' },
          { label: t('scan.title'), icon: '⎘', href: '/scan' },
          { label: t('wallet.share'), icon: '★', href: '/referral' },
        ].map((action) => (
          <Link
            key={action.label}
            to={action.href}
            className="flex flex-col items-center gap-1.5 p-3 border border-white/10 hover:border-gold-500/30 hover:bg-gold-500/5 transition"
          >
            <span className="text-lg text-gold-500 font-bold">{action.icon}</span>
            <span className="text-[10px] text-white/50 font-mono uppercase tracking-wider">
              {action.label}
            </span>
          </Link>
        ))}
      </div>

      {/* Charts Link */}
      <Link
        to="/charts"
        className="card flex items-center justify-between hover:bg-white/5 transition"
      >
        <span className="text-sm font-medium">{t('charts.viewChart')}</span>
        <span className="text-gold-500 text-sm font-mono">→</span>
      </Link>

      {/* Token List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider">{t('wallet.assets')}</h2>
          <Link to="/history" className="text-xs text-gold-500 font-mono uppercase tracking-wider">
            {t('wallet.viewAll')}
          </Link>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/5" />
                  <div className="flex-1">
                    <div className="h-4 bg-white/5 w-20 mb-2" />
                    <div className="h-3 bg-white/5 w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {balances.map((token) => (
              <TokenCard key={token.symbol} token={token} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
