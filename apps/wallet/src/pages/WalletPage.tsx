import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import TokenCard from '../components/TokenCard';

interface TokenBalance {
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
  logoUrl?: string;
}

export default function WalletPage() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(false);

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

        // For now, use placeholder USD values
        // In production, fetch from Jupiter or CoinGecko
        const solPrice = 150; // Placeholder

        const newBalances: TokenBalance[] = [
          {
            symbol: 'SOL',
            name: 'Solana',
            balance: solAmount,
            usdValue: solAmount * solPrice,
            logoUrl:
              'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
          },
          // TODO: Fetch actual SPL token balances (USDC, USDT, MVGA)
          {
            symbol: 'USDC',
            name: 'USD Coin',
            balance: 0,
            usdValue: 0,
            logoUrl:
              'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
          },
          {
            symbol: 'MVGA',
            name: 'Make Venezuela Great Again',
            balance: 0,
            usdValue: 0,
            logoUrl: '/mvga-logo.png',
          },
        ];

        setBalances(newBalances);
        setTotalValue(newBalances.reduce((sum, b) => sum + b.usdValue, 0));
      } catch (error) {
        console.error('Error fetching balances:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchBalances();
    // Refresh every 30 seconds
    const interval = setInterval(fetchBalances, 30000);
    return () => clearInterval(interval);
  }, [connected, publicKey, connection]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-primary-500/20 rounded-full flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">Welcome to MVGA</h2>
        <p className="text-gray-400 mb-6 max-w-sm">
          Connect your wallet to view balances, send tokens, and participate in the Venezuelan
          financial revolution.
        </p>
        <p className="text-sm text-gray-500">Click &quot;Connect Wallet&quot; above to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Total Balance Card */}
      <div className="card text-center py-8">
        <p className="text-gray-400 text-sm mb-1">Total Balance</p>
        <h1 className="text-4xl font-bold mb-1">
          ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </h1>
        <p className="text-gray-500 text-sm">
          {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-8)}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Send', icon: '↑', href: '/send', color: 'bg-blue-500' },
          { label: 'Receive', icon: '↓', href: '/receive', color: 'bg-green-500' },
          { label: 'Swap', icon: '⇄', href: '/swap', color: 'bg-purple-500' },
          { label: 'Stake', icon: '◎', href: '/stake', color: 'bg-primary-500' },
        ].map((action) => (
          <a
            key={action.label}
            href={action.href}
            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition"
          >
            <div className={`w-10 h-10 ${action.color} rounded-full flex items-center justify-center text-white font-bold`}>
              {action.icon}
            </div>
            <span className="text-xs text-gray-400">{action.label}</span>
          </a>
        ))}
      </div>

      {/* Token List */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Assets</h2>
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
