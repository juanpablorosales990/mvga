'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface WalletInfo {
  name: string;
  address: string;
  description: string;
  balance: number;
  loading: boolean;
}

const TREASURY_WALLETS: WalletInfo[] = [
  {
    name: 'Main Treasury',
    address: 'H9j1W4u5LEiw8AZdui6c8AmN6t4tKkPQCAULPW8eMiTE',
    description: 'Primary operational funds - holds all initial tokens',
    balance: 0,
    loading: true,
  },
  {
    name: 'MVGA Token',
    address: 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh',
    description: 'Official MVGA token mint address',
    balance: 0,
    loading: true,
  },
];

export default function TransparencyPage() {
  const [wallets, setWallets] = useState(TREASURY_WALLETS);
  const [stats, _setStats] = useState({
    totalHolders: 0,
    marketCap: 0,
    totalStaked: 0,
    totalVolume: 0,
  });

  useEffect(() => {
    // Fetch wallet balances from Solana
    const fetchBalances = async () => {
      const updatedWallets = await Promise.all(
        wallets.map(async (wallet) => {
          try {
            // Skip placeholder addresses
            if (wallet.address.includes('_ADDRESS')) {
              return { ...wallet, loading: false };
            }

            const response = await fetch(
              `https://api.mainnet-beta.solana.com`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'getBalance',
                  params: [wallet.address],
                }),
              }
            );

            const data = await response.json();
            const balance = (data.result?.value || 0) / 1e9; // Convert lamports to SOL

            return { ...wallet, balance, loading: false };
          } catch {
            return { ...wallet, loading: false };
          }
        })
      );

      setWallets(updatedWallets);
    };

    fetchBalances();
  }, []);

  const formatUSD = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
            MVGA
          </Link>
          <Link
            href="/"
            className="text-gray-400 hover:text-white transition"
          >
            ← Back to Home
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-12 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Full Transparency
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Every wallet is public. Every transaction is on-chain. Verify, don&apos;t trust.
          </p>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/5 rounded-2xl p-6 text-center">
              <p className="text-gray-400 text-sm mb-1">Total Holders</p>
              <p className="text-2xl md:text-3xl font-bold text-primary-500">
                {formatNumber(stats.totalHolders)}
              </p>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 text-center">
              <p className="text-gray-400 text-sm mb-1">Market Cap</p>
              <p className="text-2xl md:text-3xl font-bold text-secondary-500">
                {formatUSD(stats.marketCap)}
              </p>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 text-center">
              <p className="text-gray-400 text-sm mb-1">Total Staked</p>
              <p className="text-2xl md:text-3xl font-bold text-green-500">
                {formatNumber(stats.totalStaked)} MVGA
              </p>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 text-center">
              <p className="text-gray-400 text-sm mb-1">24h Volume</p>
              <p className="text-2xl md:text-3xl font-bold text-purple-500">
                {formatUSD(stats.totalVolume)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Treasury Wallets */}
      <section className="pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Treasury Wallets</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {wallets.map((wallet) => (
              <div
                key={wallet.name}
                className="bg-white/5 rounded-2xl p-6 border border-white/10 hover:border-white/20 transition"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">{wallet.name}</h3>
                  {wallet.loading ? (
                    <span className="w-16 h-6 bg-gray-700 rounded animate-pulse" />
                  ) : (
                    <span className="text-green-400 font-bold">
                      {wallet.balance.toFixed(2)} SOL
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400 mb-3">{wallet.description}</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-gray-500 bg-black/30 px-2 py-1 rounded flex-1 truncate">
                    {wallet.address}
                  </code>
                  <a
                    href={`https://solscan.io/account/${wallet.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-500 hover:text-primary-400 text-sm"
                  >
                    View ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tokenomics Verification */}
      <section className="pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Verify Our Claims</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-2xl p-6 border border-green-500/30">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">✓</span>
                <h3 className="font-semibold text-green-400">LP Locked (3 Years)</h3>
              </div>
              <p className="text-sm text-gray-400 mb-3">
                Liquidity is locked via Streamflow until 2027. Cannot be rugged.
              </p>
              <a
                href="https://app.streamflow.finance/contract/LOCK_ID_HERE"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-500 hover:underline text-sm"
              >
                Verify on Streamflow →
              </a>
            </div>

            <div className="bg-white/5 rounded-2xl p-6 border border-green-500/30">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">✓</span>
                <h3 className="font-semibold text-green-400">Mint Authority Renounced</h3>
              </div>
              <p className="text-sm text-gray-400 mb-3">
                No new tokens can ever be minted. Supply is fixed at 1 billion.
              </p>
              <a
                href="https://solscan.io/token/MVGA_TOKEN_ADDRESS"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-500 hover:underline text-sm"
              >
                Verify on Solscan →
              </a>
            </div>

            <div className="bg-white/5 rounded-2xl p-6 border border-green-500/30">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">✓</span>
                <h3 className="font-semibold text-green-400">Team Tokens Vesting</h3>
              </div>
              <p className="text-sm text-gray-400 mb-3">
                Team tokens vest over 2 years with a 6-month cliff. All public.
              </p>
              <a
                href="https://app.streamflow.finance/contract/VESTING_ID_HERE"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-500 hover:underline text-sm"
              >
                View Vesting Schedule →
              </a>
            </div>

            <div className="bg-white/5 rounded-2xl p-6 border border-green-500/30">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">✓</span>
                <h3 className="font-semibold text-green-400">Open Source Code</h3>
              </div>
              <p className="text-sm text-gray-400 mb-3">
                All code is public on GitHub. Anyone can audit and verify.
              </p>
              <a
                href="https://github.com/your-repo/mvga"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-500 hover:underline text-sm"
              >
                View on GitHub →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Token Distribution */}
      <section className="pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Token Distribution</h2>
          <div className="bg-white/5 rounded-2xl p-6">
            <div className="space-y-4">
              {[
                { label: 'Community & Liquidity', pct: 40, color: 'bg-primary-500', address: 'COMMUNITY_WALLET' },
                { label: 'Team (2yr vest)', pct: 20, color: 'bg-secondary-500', address: 'TEAM_VESTING_ADDRESS' },
                { label: 'Humanitarian Fund', pct: 15, color: 'bg-green-500', address: 'HUMANITARIAN_FUND_ADDRESS' },
                { label: 'Startup Ecosystem', pct: 10, color: 'bg-purple-500', address: 'STARTUP_FUND_ADDRESS' },
                { label: 'Marketing', pct: 10, color: 'bg-pink-500', address: 'MARKETING_WALLET_ADDRESS' },
                { label: 'Advisors (1yr vest)', pct: 5, color: 'bg-gray-500', address: 'ADVISOR_VESTING_ADDRESS' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between mb-1 text-sm">
                    <span className="text-gray-300">{item.label}</span>
                    <div className="flex items-center gap-3">
                      <code className="text-xs text-gray-500">{item.address.slice(0, 8)}...</code>
                      <span className="text-gray-400">{item.pct}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className={`${item.color} h-2 rounded-full`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/10">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-sm">
          <p>All data is fetched directly from the Solana blockchain.</p>
          <p className="mt-1">Last updated: {new Date().toLocaleString()}</p>
        </div>
      </footer>
    </main>
  );
}
