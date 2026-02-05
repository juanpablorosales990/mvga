import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useTranslation } from 'react-i18next';
import TokenCard from '../components/TokenCard';
import { usePrices } from '../hooks/usePrices';
import { useWalletStore } from '../stores/walletStore';

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

interface TokenBalance {
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
  logoUrl?: string;
}

export default function WalletPage() {
  const { t } = useTranslation();
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const { prices } = usePrices();
  const preferredCurrency = useWalletStore((s) => s.preferredCurrency);

  useEffect(() => {
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
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
        const tokenPrices: Record<string, number> = {};
        try {
          const priceRes = await fetch(`${API_URL}/wallet/prices`);
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
        } catch {
          tokenPrices['So11111111111111111111111111111111111111112'] = 150;
        }

        const solPrice = tokenPrices['So11111111111111111111111111111111111111112'] || 0;

        const newBalances: TokenBalance[] = [
          {
            symbol: 'SOL',
            name: 'Solana',
            balance: solAmount,
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
            symbol: tokenInfo.symbol,
            name: tokenInfo.name,
            balance: amount,
            usdValue: amount * price,
            logoUrl: tokenInfo.logoUrl,
          });
        }

        // Add MVGA with 0 balance if not found (so it always shows)
        if (!newBalances.find((b) => b.symbol === 'MVGA')) {
          newBalances.push({
            symbol: 'MVGA',
            name: 'Make Venezuela Great Again',
            balance: 0,
            usdValue: 0,
            logoUrl: 'https://gateway.irys.xyz/J47ckDJCqKGrt5QHo4ZjDSa4LcaitMFXkcEJ3qyM2qnD',
          });
        }

        setBalances(newBalances);
        setTotalValue(newBalances.reduce((sum, b) => sum + b.usdValue, 0));
      } catch {
        // Balance fetch failed — user sees stale or empty state
      } finally {
        setLoading(false);
      }
    }

    fetchBalances();
    const interval = setInterval(fetchBalances, 30000);
    return () => clearInterval(interval);
  }, [connected, publicKey, connection]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-primary-500/20 rounded-full flex items-center justify-center mb-6">
          <svg
            className="w-10 h-10 text-primary-500"
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
        <h2 className="text-2xl font-bold mb-2">{t('wallet.title')}</h2>
        <p className="text-gray-400 mb-6 max-w-sm">{t('wallet.connectPrompt')}</p>
        <p className="text-sm text-gray-500">{t('wallet.clickConnect')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Total Balance Card */}
      <div className="card text-center py-8">
        <p className="text-gray-400 text-sm mb-1">{t('wallet.totalBalance')}</p>
        <h1 className="text-4xl font-bold mb-1">
          {preferredCurrency === 'VES'
            ? `Bs ${(totalValue * prices.vesRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </h1>
        <p className="text-gray-500 text-sm">
          {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-8)}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: t('wallet.send'), icon: '↑', href: '/send', color: 'bg-blue-500' },
          { label: t('wallet.receive'), icon: '↓', href: '/receive', color: 'bg-green-500' },
          { label: t('wallet.swap'), icon: '⇄', href: '/swap', color: 'bg-purple-500' },
          { label: t('wallet.stake'), icon: '◎', href: '/stake', color: 'bg-primary-500' },
        ].map((action) => (
          <Link
            key={action.label}
            to={action.href}
            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition"
          >
            <div
              className={`w-10 h-10 ${action.color} rounded-full flex items-center justify-center text-white font-bold`}
            >
              {action.icon}
            </div>
            <span className="text-xs text-gray-400">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* Charts Link */}
      <Link
        to="/charts"
        className="card flex items-center justify-between hover:bg-white/10 transition"
      >
        <span className="text-sm font-medium">{t('charts.viewChart')}</span>
        <span className="text-primary-500 text-sm">→</span>
      </Link>

      {/* Token List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">{t('wallet.assets')}</h2>
          <Link to="/history" className="text-sm text-primary-500">
            {t('wallet.viewAll')}
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-700 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-700 rounded w-20 mb-2" />
                    <div className="h-3 bg-gray-700 rounded w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {balances.map((token) => (
              <TokenCard key={token.symbol} token={token} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
