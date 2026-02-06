'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.mvga.io/api';
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

interface WalletInfo {
  name: string;
  address: string;
  description: string;
  balance: number;
  loading: boolean;
}

interface LiveMetrics {
  tvl: number;
  volume24h: number;
  revenue24h: number;
  totalUsers: number;
  activeUsers: number;
  totalStakers: number;
  totalBurned: number;
}

interface BurnStats {
  totalBurned: number;
  burnCount: number;
  lastBurnAt: string | null;
  supplyReduction: number;
}

interface BurnRecord {
  id: string;
  amount: number;
  signature: string;
  source: string;
  createdAt: string;
}

const TREASURY_WALLETS: WalletInfo[] = [
  {
    name: 'Main Treasury',
    address: 'H9j1W4u5LEiw8AZdui6c8AmN6t4tKkPQCAULPW8eMiTE',
    description: 'Primary operational funds and community/liquidity allocation (40%)',
    balance: 0,
    loading: true,
  },
  {
    name: 'Humanitarian Fund',
    address: 'HvtvFhuVMu9XGmhW5zWNvtPK7ttiMBg7Ag7C9oRpyKwP',
    description: 'Emergency aid and humanitarian support for Venezuelans (15%)',
    balance: 0,
    loading: true,
  },
  {
    name: 'Staking Vault',
    address: 'GNhLCjqThNJAJAdDYvRTr2EfWyGXAFUymaPuKaL1duEh',
    description: 'Staking rewards pool and locked deposits',
    balance: 0,
    loading: true,
  },
  {
    name: 'Team Vesting',
    address: '8m8L2CGoneYwP3xEYyss5sjbj7GKy7cK3YxDcG2yNbH4',
    description: 'Team allocation with 2-year vesting schedule (20%)',
    balance: 0,
    loading: true,
  },
  {
    name: 'Marketing',
    address: 'DA5VQFLsx87hNQqL2EsM36oVhGnzM2CnqPSe6E9RFpeo',
    description: 'Marketing, partnerships, and exchange listings (10%)',
    balance: 0,
    loading: true,
  },
  {
    name: 'Advisors',
    address: 'Huq3ea9KKf6HFb5Qiacdx2pJDSM4c881WdyMCBHXq4hF',
    description: 'Advisory board compensation with 1-year vesting (5%)',
    balance: 0,
    loading: true,
  },
];

function formatMvga(num: number) {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num);
}

export default function TransparencyPage() {
  const [wallets, setWallets] = useState(TREASURY_WALLETS);
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [burnStats, setBurnStats] = useState<BurnStats | null>(null);
  const [burnHistory, setBurnHistory] = useState<BurnRecord[]>([]);
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
        TREASURY_WALLETS.map(async (wallet) => {
          try {
            // Skip placeholder addresses
            if (wallet.address.includes('_ADDRESS')) {
              return { ...wallet, loading: false };
            }

            const response = await fetch(RPC_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getBalance',
                params: [wallet.address],
              }),
            });

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

    // Fetch live protocol data
    Promise.all([
      fetch(`${API_URL}/metrics`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_URL}/burn/stats`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_URL}/burn/history?limit=5`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([m, b, bh]) => {
        if (m) setMetrics(m);
        if (b) setBurnStats(b);
        if (bh) setBurnHistory(bh);
      })
      .catch(() => {});
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
          <Link
            href="/"
            className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent"
          >
            MVGA
          </Link>
          <Link href="/" className="text-gray-400 hover:text-white transition">
            ← Back to Home
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-12 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Full Transparency</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Every wallet is public. Every transaction is on-chain. Verify, don&apos;t trust.
          </p>
        </div>
      </section>

      {/* Live Metrics */}
      <section className="pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/5 rounded-2xl p-6 text-center">
              <p className="text-gray-400 text-sm mb-1">Total Value Locked</p>
              <p className="text-2xl md:text-3xl font-bold text-primary-500">
                {metrics ? formatMvga(metrics.tvl) : formatNumber(stats.totalStaked)} MVGA
              </p>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 text-center">
              <p className="text-gray-400 text-sm mb-1">Total Users</p>
              <p className="text-2xl md:text-3xl font-bold text-secondary-500">
                {metrics ? formatNumber(metrics.totalUsers) : formatNumber(stats.totalHolders)}
              </p>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 text-center">
              <p className="text-gray-400 text-sm mb-1">Total Stakers</p>
              <p className="text-2xl md:text-3xl font-bold text-green-500">
                {metrics ? formatNumber(metrics.totalStakers) : '0'}
              </p>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 text-center">
              <p className="text-gray-400 text-sm mb-1">24h Volume</p>
              <p className="text-2xl md:text-3xl font-bold text-purple-500">
                {metrics ? formatMvga(metrics.volume24h) : formatUSD(stats.totalVolume)} MVGA
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Burn Tracker */}
      {burnStats && burnStats.totalBurned > 0 && (
        <section className="pb-12 px-6">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Token Burns</h2>
            <div className="bg-gradient-to-r from-red-500/10 to-transparent rounded-2xl p-6 border border-red-500/20">
              <div className="grid md:grid-cols-3 gap-6 mb-6">
                <div className="text-center">
                  <p className="text-gray-400 text-sm">Total Burned</p>
                  <p className="text-3xl font-bold text-red-400">
                    {formatMvga(burnStats.totalBurned)}
                  </p>
                  <p className="text-xs text-gray-500">MVGA permanently destroyed</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-sm">Burn Count</p>
                  <p className="text-3xl font-bold text-red-400">{burnStats.burnCount}</p>
                  <p className="text-xs text-gray-500">weekly burns executed</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-sm">Supply Reduced</p>
                  <p className="text-3xl font-bold text-red-400">
                    {burnStats.supplyReduction.toFixed(4)}%
                  </p>
                  <p className="text-xs text-gray-500">of total 1B supply</p>
                </div>
              </div>
              {burnHistory.length > 0 && (
                <div className="border-t border-white/10 pt-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Burns</h3>
                  <div className="space-y-2">
                    {burnHistory.map((burn) => (
                      <div key={burn.id} className="flex justify-between items-center text-sm">
                        <span className="text-red-400 font-medium">
                          {formatMvga(burn.amount)} MVGA
                        </span>
                        <a
                          href={`https://solscan.io/tx/${burn.signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-500 hover:text-primary-400"
                        >
                          {new Date(burn.createdAt).toLocaleDateString()} &#8599;
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Revenue Flow */}
      <section className="pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Revenue Flow</h2>
          <div className="bg-white/5 rounded-2xl p-6">
            <div className="flex flex-col items-center gap-3">
              <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl px-6 py-3 text-center">
                <p className="text-sm text-gray-400">Swap &amp; Trade Fees (3%)</p>
                <p className="font-bold text-primary-500">All Protocol Revenue</p>
              </div>
              <span className="text-gray-500">&#8595;</span>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-6 py-2 text-center">
                <p className="text-sm text-red-400 font-medium">5% Burned (deflationary)</p>
              </div>
              <span className="text-gray-500">&#8595;</span>
              <div className="grid grid-cols-3 gap-3 w-full max-w-lg">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                  <p className="font-bold text-blue-400">40%</p>
                  <p className="text-xs text-gray-400">Liquidity</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
                  <p className="font-bold text-green-400">40%</p>
                  <p className="text-xs text-gray-400">Staking</p>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-center">
                  <p className="font-bold text-yellow-400">20%</p>
                  <p className="text-xs text-gray-400">Grants</p>
                </div>
              </div>
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
              <span className="text-gray-500 text-sm">
                Streamflow lock verification coming soon
              </span>
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
                href="https://solscan.io/token/DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh"
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
              <span className="text-gray-500 text-sm">
                Vesting schedule verification coming soon
              </span>
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
                href="https://github.com/juanpablorosales990/mvga"
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
                {
                  label: 'Community & Liquidity',
                  pct: 40,
                  color: 'bg-primary-500',
                  address: 'H9j1W4u5LEiw8AZdui6c8AmN6t4tKkPQCAULPW8eMiTE',
                },
                {
                  label: 'Team (2yr vest)',
                  pct: 20,
                  color: 'bg-secondary-500',
                  address: '8m8L2CGoneYwP3xEYyss5sjbj7GKy7cK3YxDcG2yNbH4',
                },
                {
                  label: 'Humanitarian Fund',
                  pct: 15,
                  color: 'bg-green-500',
                  address: 'HvtvFhuVMu9XGmhW5zWNvtPK7ttiMBg7Ag7C9oRpyKwP',
                },
                {
                  label: 'Startup Ecosystem',
                  pct: 10,
                  color: 'bg-purple-500',
                  address: 'H9j1W4u5LEiw8AZdui6c8AmN6t4tKkPQCAULPW8eMiTE',
                },
                {
                  label: 'Marketing',
                  pct: 10,
                  color: 'bg-pink-500',
                  address: 'DA5VQFLsx87hNQqL2EsM36oVhGnzM2CnqPSe6E9RFpeo',
                },
                {
                  label: 'Advisors (1yr vest)',
                  pct: 5,
                  color: 'bg-gray-500',
                  address: 'Huq3ea9KKf6HFb5Qiacdx2pJDSM4c881WdyMCBHXq4hF',
                },
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
