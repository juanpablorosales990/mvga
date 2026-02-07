'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import GridBackground from '@/components/GridBackground';
import { API_BASE, formatNumber, formatMvga } from '@/lib/utils';

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

interface WalletInfo {
  name: string;
  address: string;
  description: string;
  balance: number;
  loading: boolean;
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

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

export default function TransparencyPage() {
  const [wallets, setWallets] = useState(TREASURY_WALLETS);
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [burnStats, setBurnStats] = useState<BurnStats | null>(null);
  const [burnHistory, setBurnHistory] = useState<BurnRecord[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    setLastUpdated(new Date().toLocaleString());

    const fetchBalances = async () => {
      const updatedWallets = await Promise.all(
        TREASURY_WALLETS.map(async (wallet) => {
          try {
            if (wallet.address.includes('_ADDRESS')) {
              return { ...wallet, loading: false };
            }
            const response = await fetch(`${API_BASE}/wallet/${wallet.address}/balances`);
            if (!response.ok) return { ...wallet, loading: false };
            const balances: { symbol: string; balance: number }[] = await response.json();
            const sol = balances.find((b) => b.symbol === 'SOL')?.balance ?? 0;
            return { ...wallet, balance: sol, loading: false };
          } catch {
            return { ...wallet, loading: false };
          }
        })
      );
      setWallets(updatedWallets);
    };

    fetchBalances();

    Promise.all([
      fetch(`${API_BASE}/metrics`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/burn/stats`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/burn/history?limit=5`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([m, b, bh]) => {
        if (m) setMetrics(m);
        if (b) setBurnStats(b);
        if (bh) setBurnHistory(bh);
      })
      .catch(() => {});
  }, []);

  return (
    <GridBackground>
      <main id="main-content" className="min-h-screen bg-black text-white">
        <Nav />

        {/* ── HERO ─────────────────────────────────────────────── */}
        <section className="pt-32 md:pt-40 pb-20 px-6">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
                Full Transparency
              </p>
            </motion.div>

            <div className="overflow-hidden">
              {['VERIFY', "DON'T", 'TRUST'].map((word, i) => (
                <motion.div
                  key={word}
                  initial={{ opacity: 0, y: 80 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 * i, duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <h1 className="text-[14vw] md:text-[10vw] font-black uppercase tracking-tighter leading-[0.85]">
                    {word}
                  </h1>
                </motion.div>
              ))}
            </div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="text-lg md:text-xl text-white/40 max-w-2xl mt-10 leading-relaxed"
            >
              Every wallet is public. Every transaction is on-chain. Every dollar is accounted for.
            </motion.p>

            {lastUpdated && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-xs text-white/20 font-mono mt-4"
              >
                Last updated: {lastUpdated}
              </motion.p>
            )}
          </div>
        </section>

        {/* ── LIVE METRICS ───────────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              Live Protocol Data
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-16">
              Real-time metrics from the Solana blockchain.
            </h2>

            <motion.div
              className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/10"
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {[
                {
                  label: 'Total Value Locked',
                  value: metrics ? `${formatMvga(metrics.tvl)} MVGA` : '---',
                },
                { label: 'Total Users', value: metrics ? formatNumber(metrics.totalUsers) : '---' },
                {
                  label: 'Total Stakers',
                  value: metrics ? formatNumber(metrics.totalStakers) : '---',
                },
                {
                  label: '24h Volume',
                  value: metrics ? `${formatMvga(metrics.volume24h)} MVGA` : '---',
                },
              ].map((stat, i) => (
                <motion.div key={stat.label} custom={i} variants={fadeUp} className="bg-black p-8">
                  <p className="text-xs tracking-[0.2em] uppercase text-white/30 mb-3">
                    {stat.label}
                  </p>
                  <p className="text-2xl md:text-3xl font-mono font-bold">{stat.value}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── BURN TRACKER ───────────────────────────────────────── */}
        {burnStats && burnStats.totalBurned > 0 && (
          <section className="py-24 md:py-32 px-6 border-t border-white/10">
            <div className="max-w-7xl mx-auto">
              <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
                Deflationary
              </p>
              <h2 className="text-3xl md:text-5xl font-bold mb-16">Token Burns</h2>

              <div className="grid md:grid-cols-3 gap-px bg-white/10 mb-12">
                {[
                  {
                    label: 'Total Burned',
                    value: `${formatMvga(burnStats.totalBurned)} MVGA`,
                    sub: 'Permanently destroyed',
                  },
                  {
                    label: 'Burn Count',
                    value: String(burnStats.burnCount),
                    sub: 'Weekly burns executed',
                  },
                  {
                    label: 'Supply Reduced',
                    value: `${burnStats.supplyReduction.toFixed(4)}%`,
                    sub: 'Of total 1B supply',
                  },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-black p-8"
                  >
                    <p className="text-xs tracking-[0.2em] uppercase text-white/30 mb-3">
                      {stat.label}
                    </p>
                    <p className="text-3xl font-mono font-bold text-gold-500">{stat.value}</p>
                    <p className="text-xs text-white/20 mt-2">{stat.sub}</p>
                  </motion.div>
                ))}
              </div>

              {burnHistory.length > 0 && (
                <div className="border border-white/10 p-8">
                  <h3 className="text-xs tracking-[0.3em] uppercase text-white/30 font-mono mb-6">
                    Recent Burns
                  </h3>
                  <div className="divide-y divide-white/5">
                    {burnHistory.map((burn) => (
                      <div key={burn.id} className="flex justify-between items-center py-4">
                        <span className="font-mono font-bold text-gold-500">
                          {formatMvga(burn.amount)} MVGA
                        </span>
                        <a
                          href={`https://solscan.io/tx/${burn.signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-white/30 hover:text-white transition animated-underline font-mono"
                        >
                          {new Date(burn.createdAt).toLocaleDateString()}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── REVENUE FLOW ───────────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              Economics
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Revenue Flow</h2>
            <p className="text-white/40 mb-16">
              Zero goes to founders. Every fee flows back to the community.
            </p>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="max-w-3xl mx-auto flex flex-col items-center"
            >
              <div className="w-full border border-white/10 p-6 text-center">
                <p className="text-xs tracking-[0.3em] uppercase text-white/30 mb-1">
                  Swap &amp; Trade Fees (3%)
                </p>
                <p className="text-xl font-bold">Protocol Revenue</p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="w-full border border-gold-500/30 bg-gold-500/[0.03] p-4 text-center">
                <p className="font-mono font-bold text-gold-500">5% BURNED FOREVER</p>
                <p className="text-xs text-white/30 mt-1">Reducing supply every week</p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="grid grid-cols-3 gap-px bg-white/10 w-full">
                {[
                  { pct: '40%', label: 'Liquidity', sub: 'Strengthens price floor' },
                  { pct: '40%', label: 'Staking', sub: 'Vault refill + fee sharing' },
                  { pct: '20%', label: 'Grants', sub: 'Community-voted funding' },
                ].map((item) => (
                  <div key={item.label} className="bg-black p-5 text-center">
                    <p className="text-2xl font-mono font-bold">{item.pct}</p>
                    <p className="text-xs tracking-[0.2em] uppercase text-white/30 mt-2">
                      {item.label}
                    </p>
                    <p className="text-xs text-white/15 mt-1">{item.sub}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── TREASURY WALLETS ───────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              Public Wallets
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-16">Treasury Wallets</h2>

            <motion.div
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10"
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {wallets.map((wallet, i) => (
                <motion.div key={wallet.name} custom={i} variants={fadeUp} className="bg-black p-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-sm uppercase tracking-wide">{wallet.name}</h3>
                    {wallet.loading ? (
                      <span className="w-16 h-5 bg-white/5 animate-pulse" />
                    ) : (
                      <span className="font-mono font-bold text-gold-500">
                        {wallet.balance.toFixed(2)} SOL
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/30 mb-4">{wallet.description}</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-white/15 font-mono flex-1 truncate">
                      {wallet.address}
                    </code>
                    <a
                      href={`https://solscan.io/account/${wallet.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-white/30 hover:text-gold-500 transition shrink-0"
                    >
                      View
                    </a>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── VERIFY CLAIMS ──────────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">Proof</p>
            <h2 className="text-3xl md:text-5xl font-bold mb-16">Verify Our Claims</h2>

            <div className="grid md:grid-cols-2 gap-px bg-white/10">
              {[
                {
                  title: 'LP Locked (3 Years)',
                  desc: 'Liquidity is locked via Streamflow until 2027. Cannot be rugged.',
                  link: null,
                  linkText: 'Streamflow lock verification coming soon',
                },
                {
                  title: 'Mint Authority Renounced',
                  desc: 'No new tokens can ever be minted. Supply is fixed at 1 billion.',
                  link: 'https://solscan.io/token/DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh',
                  linkText: 'Verify on Solscan',
                },
                {
                  title: 'Team Tokens Vesting',
                  desc: 'Team tokens vest over 2 years with a 6-month cliff. All public.',
                  link: null,
                  linkText: 'Vesting schedule verification coming soon',
                },
                {
                  title: 'Open Source Code',
                  desc: 'All code is public on GitHub. Anyone can audit and verify.',
                  link: 'https://github.com/juanpablorosales990/mvga',
                  linkText: 'View on GitHub',
                },
              ].map((claim, i) => (
                <motion.div
                  key={claim.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-black p-8"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-6 h-6 border border-gold-500/50 flex items-center justify-center">
                      <div className="w-2 h-2 bg-gold-500" />
                    </div>
                    <h3 className="font-bold uppercase tracking-wide text-sm">{claim.title}</h3>
                  </div>
                  <p className="text-sm text-white/40 mb-4">{claim.desc}</p>
                  {claim.link ? (
                    <a
                      href={claim.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gold-500 hover:text-white transition animated-underline"
                    >
                      {claim.linkText}
                    </a>
                  ) : (
                    <span className="text-sm text-white/20">{claim.linkText}</span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TOKEN DISTRIBUTION ──────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              Allocation
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-16">Token Distribution</h2>

            <div className="max-w-3xl">
              <div className="space-y-5">
                {[
                  {
                    label: 'Community & Liquidity',
                    pct: 40,
                    address: 'H9j1W4u5LEiw8AZdui6c8AmN6t4tKkPQCAULPW8eMiTE',
                    gold: true,
                  },
                  {
                    label: 'Team (2yr vest)',
                    pct: 20,
                    address: '8m8L2CGoneYwP3xEYyss5sjbj7GKy7cK3YxDcG2yNbH4',
                    gold: false,
                  },
                  {
                    label: 'Humanitarian Fund',
                    pct: 15,
                    address: 'HvtvFhuVMu9XGmhW5zWNvtPK7ttiMBg7Ag7C9oRpyKwP',
                    gold: false,
                  },
                  {
                    label: 'Startup Ecosystem',
                    pct: 10,
                    address: 'EjX2UrqvJkWvc4B1FPz3gU3ERAAB5BkVbpWrcGMdZkR3',
                    gold: false,
                  },
                  {
                    label: 'Marketing',
                    pct: 10,
                    address: 'DA5VQFLsx87hNQqL2EsM36oVhGnzM2CnqPSe6E9RFpeo',
                    gold: false,
                  },
                  {
                    label: 'Advisors (1yr vest)',
                    pct: 5,
                    address: 'Huq3ea9KKf6HFb5Qiacdx2pJDSM4c881WdyMCBHXq4hF',
                    gold: false,
                  },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between mb-2 text-sm">
                      <span className="text-white/60">{item.label}</span>
                      <div className="flex items-center gap-3">
                        <a
                          href={`https://solscan.io/account/${item.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-white/15 font-mono hover:text-gold-500 transition"
                        >
                          {item.address.slice(0, 8)}...
                        </a>
                        <span className="font-mono text-white/60">{item.pct}%</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-white/5">
                      <motion.div
                        className={item.gold ? 'h-full bg-gold-500' : 'h-full bg-white/30'}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${item.pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── BLOCKCHAIN FOOTER NOTE ─────────────────────────────── */}
        <section className="py-12 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-xs text-white/20 font-mono">
              All data is fetched directly from the Solana blockchain. Last updated:{' '}
              {lastUpdated || '...'}
            </p>
          </div>
        </section>

        <Footer />
      </main>
    </GridBackground>
  );
}
