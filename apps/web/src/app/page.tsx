'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import GridBackground from '@/components/GridBackground';
import Marquee from '@/components/Marquee';
import { API_BASE, formatNumber } from '@/lib/utils';

interface LiveMetrics {
  tvl: number;
  volume24h: number;
  revenue24h: number;
  totalUsers: number;
  activeUsers: number;
  totalStakers: number;
  totalBurned: number;
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

const WALLETS = [
  { name: 'Treasury', address: 'H9j1W4u5LEiw8AZdui6c8AmN6t4tKkPQCAULPW8eMiTE' },
  { name: 'Humanitarian Fund', address: 'HvtvFhuVMu9XGmhW5zWNvtPK7ttiMBg7Ag7C9oRpyKwP' },
  { name: 'Staking Vault', address: 'GNhLCjqThNJAJAdDYvRTr2EfWyGXAFUymaPuKaL1duEh' },
  { name: 'Team Vesting', address: '8m8L2CGoneYwP3xEYyss5sjbj7GKy7cK3YxDcG2yNbH4' },
  { name: 'Marketing', address: 'DA5VQFLsx87hNQqL2EsM36oVhGnzM2CnqPSe6E9RFpeo' },
  { name: 'Advisors', address: 'Huq3ea9KKf6HFb5Qiacdx2pJDSM4c881WdyMCBHXq4hF' },
];

export default function Home() {
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const missionRef = useRef(null);
  const missionInView = useInView(missionRef, { once: true });

  useEffect(() => {
    fetch(`${API_BASE}/metrics`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setMetrics)
      .catch(() => {});
  }, []);

  const marqueeItems = [
    { label: 'TVL', value: metrics ? `${formatNumber(metrics.tvl)} MVGA` : '---' },
    { label: 'USERS', value: metrics ? formatNumber(metrics.totalUsers) : '---' },
    { label: 'BURNED', value: metrics ? `${formatNumber(metrics.totalBurned)} MVGA` : '---' },
    { label: 'STATUS', value: '100% OPEN SOURCE' },
    { label: 'FOUNDER FEES', value: '0%' },
    { label: 'NETWORK', value: 'SOLANA' },
    { label: 'BUILT BY', value: 'VENEZUELANS FOR VENEZUELANS' },
  ];

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
              className="flex flex-wrap gap-3 mb-10"
            >
              <span className="text-xs tracking-[0.25em] uppercase border border-white/20 px-3 py-1 text-white/50">
                Open Source
              </span>
              <span className="text-xs tracking-[0.25em] uppercase border border-gold-500/30 px-3 py-1 text-gold-500">
                Zero Founder Fees
              </span>
            </motion.div>

            <div className="overflow-hidden">
              {['MAKE', 'VENEZUELA', 'GREAT AGAIN'].map((word, i) => (
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
              Venezuela&apos;s free financial infrastructure. A bank account in your pocket with US
              dollars you can spend anywhere in the world. Made by Venezuelans, for Venezuelans.
              Zero middlemen. Zero founder fees.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75, duration: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 mt-10"
            >
              <Link
                href="https://app.mvga.io"
                target="_blank"
                className="bg-white text-black font-bold text-sm uppercase tracking-wider px-8 py-4 hover:bg-transparent hover:text-white border border-white transition-all text-center"
              >
                Open Wallet
              </Link>
              <Link
                href="https://github.com/juanpablorosales990/mvga"
                target="_blank"
                className="border border-white/30 text-white font-bold text-sm uppercase tracking-wider px-8 py-4 hover:border-white transition-all text-center"
              >
                View Source
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ── MARQUEE ──────────────────────────────────────────── */}
        <Marquee items={marqueeItems} />

        {/* ── MISSION ──────────────────────────────────────────── */}
        <section id="mission" className="py-24 md:py-32 px-6" ref={missionRef}>
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              Our Mission
            </p>
            <h2 className="text-3xl md:text-5xl font-bold leading-tight max-w-3xl mb-16">
              Every Venezuelan deserves access to stable money, regardless of where they live.
            </h2>

            <motion.div
              className="grid md:grid-cols-3 gap-px bg-white/10"
              variants={stagger}
              initial="hidden"
              animate={missionInView ? 'visible' : 'hidden'}
            >
              {[
                {
                  num: '01',
                  title: 'Zero Fee Remittances',
                  desc: 'Send money to Venezuela without losing 15% to middlemen. P2P exchange directly with other users. Keep every dollar.',
                },
                {
                  num: '02',
                  title: 'Your Money, Stable',
                  desc: 'Hold US dollars as USDC stablecoins in your pocket. No more watching your savings evaporate to inflation. Your money holds its value.',
                },
                {
                  num: '03',
                  title: '100% Open Source',
                  desc: 'Every line of code is public on GitHub. Every wallet is visible on-chain. Anyone can audit. No hidden agendas.',
                },
              ].map((card, i) => (
                <motion.div
                  key={card.num}
                  custom={i}
                  variants={fadeUp}
                  className="bg-black p-8 hover:bg-white/[0.02] transition group"
                >
                  <span className="font-mono text-sm text-gold-500 mb-4 block">{card.num}</span>
                  <h3 className="text-xl font-bold mb-3">{card.title}</h3>
                  <p className="text-white/40 leading-relaxed">{card.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── STABLECOIN WALLET ───────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              Digital Dollar Account
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">A bank account in your pocket.</h2>
            <p className="text-white/40 mb-16 max-w-2xl">
              Hold USDC stablecoins pegged 1:1 to the US dollar. Send, receive, and spend anywhere
              in the world. No bank required. No minimums. No KYC to get started.
            </p>

            <motion.div
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10"
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {[
                {
                  num: '01',
                  title: 'Hold Stablecoins',
                  desc: 'USDC pegged 1:1 to USD. Your balance stays stable while you sleep. No more watching the bolivar crash.',
                },
                {
                  num: '02',
                  title: 'Send Anywhere',
                  desc: 'Transfer to any wallet in seconds. Send to family in Venezuela or pay someone across the world. Near-zero fees on Solana.',
                },
                {
                  num: '03',
                  title: 'Multi-Currency',
                  desc: 'Hold USDC, MVGA, and SOL all in one wallet. View your total balance in USD. Switch between assets instantly.',
                },
                {
                  num: '04',
                  title: 'Works on Any Phone',
                  desc: 'Progressive Web App that works on any device with a browser. No app store needed. Install it like a native app.',
                },
                {
                  num: '05',
                  title: 'Non-Custodial',
                  desc: 'Your keys, your coins. We never hold your funds. Your wallet is secured by your private key on your device.',
                },
                {
                  num: '06',
                  title: 'Real-Time Balances',
                  desc: 'See your portfolio value update in real-time. Track every transaction. Full history always available on-chain.',
                },
              ].map((item, i) => (
                <motion.div
                  key={item.num}
                  custom={i}
                  variants={fadeUp}
                  className="bg-black p-8 hover:bg-white/[0.02] transition"
                >
                  <span className="font-mono text-sm text-gold-500 mb-4 block">{item.num}</span>
                  <h3 className="text-lg font-bold mb-3">{item.title}</h3>
                  <p className="text-white/40 leading-relaxed text-sm">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── DEBIT CARD ─────────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-start">
              <div>
                <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
                  Coming Soon
                </p>
                <h2 className="text-3xl md:text-5xl font-bold mb-6">
                  Spend your stablecoins anywhere.
                </h2>
                <p className="text-white/40 leading-relaxed mb-8">
                  The MVGA Card turns your USDC balance into a Visa debit card you can use at any
                  store, restaurant, or ATM worldwide. Pay in US dollars from your phone. Your
                  stablecoins are automatically converted at the point of sale.
                </p>
                <div className="space-y-4">
                  {[
                    'Visa card accepted at 80M+ merchants worldwide',
                    'Spend USDC directly — auto-converted at point of sale',
                    'Real-time transaction notifications in the app',
                    'Freeze and unfreeze your card instantly from the wallet',
                    'Set daily spending limits and control online purchases',
                    'No monthly fees. No hidden charges.',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <span className="text-gold-500 mt-0.5 shrink-0 font-mono text-sm">/</span>
                      <p className="text-white/50 text-sm">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="border border-white/10 p-8"
              >
                <div className="aspect-[1.6/1] bg-gradient-to-br from-gold-500/20 via-gold-500/5 to-transparent border border-gold-500/20 p-6 flex flex-col justify-between mb-8">
                  <div className="flex items-start justify-between">
                    <span className="text-xl font-black tracking-tighter">MVGA</span>
                    <span className="text-xs font-mono text-gold-500 border border-gold-500/30 px-2 py-0.5">
                      VISA
                    </span>
                  </div>
                  <div>
                    <p className="font-mono text-white/30 text-sm tracking-widest mb-2">
                      **** **** **** 4242
                    </p>
                    <p className="text-xs text-white/20 uppercase tracking-wider">Your Name Here</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/30">Card Type</span>
                    <span className="font-mono">Visa Debit</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/30">Funding</span>
                    <span className="font-mono">USDC Stablecoin</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/30">Monthly Fee</span>
                    <span className="font-mono text-gold-500">$0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/30">Status</span>
                    <span className="font-mono text-white/50">Waitlist Open</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── FEATURES ─────────────────────────────────────────── */}
        <section id="features" className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              Platform Features
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-16">
              Everything you need in one app.
            </h2>

            <div className="divide-y divide-white/10">
              {[
                {
                  num: '01',
                  title: 'MVGA Wallet',
                  desc: 'Hold USDC, MVGA, and SOL in a non-custodial wallet. View your total balance in USD. Send to anyone instantly with near-zero Solana fees. Works as a PWA on any phone — no app store required.',
                },
                {
                  num: '02',
                  title: 'P2P Exchange',
                  desc: 'Trade crypto for Zelle, PayPal, Venmo, or bank transfer directly with other users. Smart contract escrow locks funds until both parties confirm. Built-in reputation system and dispute resolution.',
                },
                {
                  num: '03',
                  title: 'Staking & Tier Rewards',
                  desc: 'Stake MVGA tokens to earn a share of all protocol fees. Four tiers — Bronze, Silver, Gold, Diamond — each unlocking lower trading fees, cashback on swaps, and governance voting power. Diamond stakers pay zero fees.',
                },
                {
                  num: '04',
                  title: 'Business Grants',
                  desc: 'Community-funded micro-grants for Venezuelan small businesses. Stakers vote on which businesses get funded. 20% of all protocol revenue goes to the grants pool. Every grant is on-chain and verifiable.',
                },
                {
                  num: '05',
                  title: 'Debit Card',
                  desc: 'Spend your USDC balance anywhere Visa is accepted. Real-time notifications, instant freeze/unfreeze, daily spending limits, and online purchase controls — all from the app. Coming soon.',
                },
                {
                  num: '06',
                  title: 'Deflationary Token Burns',
                  desc: '5% of all protocol fees are used to buy back and permanently burn MVGA tokens every week. Reducing supply forever. Every burn transaction is public and verifiable on Solscan.',
                },
                {
                  num: '07',
                  title: 'Referral Program',
                  desc: 'Invite friends and earn a percentage of their trading fees. Track your referrals, earnings, and network growth directly in the app. The more people you bring, the more you earn.',
                },
                {
                  num: '08',
                  title: 'Token Swaps',
                  desc: 'Swap between USDC, MVGA, and SOL directly in the wallet. Real-time price quotes. Tier-based fee discounts — Bronze pays 3%, Diamond pays 0%. Cashback rewards on every swap.',
                },
              ].map((feat, i) => (
                <motion.div
                  key={feat.num}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-6 md:gap-12 py-10"
                >
                  <span className="text-[6rem] md:text-[8rem] font-mono text-white/[0.03] font-black leading-none shrink-0 hidden md:block">
                    {feat.num}
                  </span>
                  <div className="pt-4">
                    <span className="font-mono text-sm text-gold-500 md:hidden">{feat.num}</span>
                    <h3 className="text-2xl font-bold mb-3">{feat.title}</h3>
                    <p className="text-white/40 leading-relaxed max-w-xl">{feat.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── STAKING TIERS ──────────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              Earn While You Hold
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Stake MVGA. Earn fees. Unlock benefits.
            </h2>
            <p className="text-white/40 mb-16 max-w-2xl">
              The more you stake, the more you earn. Higher tiers unlock lower fees, cashback
              rewards, and governance voting power. All staking rewards come from real protocol
              revenue — not inflation.
            </p>

            <motion.div
              className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10"
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {[
                {
                  tier: 'Bronze',
                  stake: '1,000+',
                  feeDiscount: '0%',
                  cashback: '0%',
                  color: 'text-white/50',
                },
                {
                  tier: 'Silver',
                  stake: '10,000+',
                  feeDiscount: '10%',
                  cashback: '0.5%',
                  color: 'text-white/70',
                },
                {
                  tier: 'Gold',
                  stake: '50,000+',
                  feeDiscount: '25%',
                  cashback: '1%',
                  color: 'text-gold-500',
                },
                {
                  tier: 'Diamond',
                  stake: '250,000+',
                  feeDiscount: '100%',
                  cashback: '2%',
                  color: 'text-white',
                },
              ].map((t, i) => (
                <motion.div key={t.tier} custom={i} variants={fadeUp} className="bg-black p-8">
                  <h3 className={`text-lg font-bold uppercase tracking-wide mb-6 ${t.color}`}>
                    {t.tier}
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/30">Stake Required</span>
                      <span className="font-mono">{t.stake} MVGA</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/30">Fee Discount</span>
                      <span className="font-mono text-gold-500">{t.feeDiscount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/30">Cashback</span>
                      <span className="font-mono text-gold-500">{t.cashback}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/30">Voting Power</span>
                      <span className="font-mono">Yes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/30">Fee Sharing</span>
                      <span className="font-mono">Yes</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── TREASURY FLOW ────────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              Self-Sustaining Treasury
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Every fee flows back to the community.
            </h2>
            <p className="text-white/40 mb-16">Zero goes to founders.</p>

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

        {/* ── TRANSPARENCY ─────────────────────────────────────── */}
        <section id="transparency" className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              Full Transparency
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Every wallet is public. Every transaction is on-chain.
            </h2>
            <p className="text-white/40 mb-16">Verify, don&apos;t trust.</p>

            <motion.div
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10"
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {WALLETS.map((wallet, i) => (
                <motion.div key={wallet.name} custom={i} variants={fadeUp} className="bg-black p-6">
                  <h3 className="font-bold text-sm uppercase tracking-wide mb-3">{wallet.name}</h3>
                  <a
                    href={`https://solscan.io/account/${wallet.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-white/20 hover:text-gold-500 break-all transition block"
                  >
                    {wallet.address}
                  </a>
                </motion.div>
              ))}
            </motion.div>

            <div className="mt-10">
              <a
                href="https://github.com/juanpablorosales990/mvga"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white/30 hover:text-white transition animated-underline inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
                View Source Code on GitHub
              </a>
            </div>
          </div>
        </section>

        {/* ── OPEN SOURCE ────────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              Open Source
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Built in public. Auditable by anyone.
            </h2>
            <p className="text-white/40 mb-16 max-w-2xl">
              The entire MVGA platform is open source. The API, the wallet app, and this website are
              all public on GitHub. Anyone can read the code, audit the smart contracts, and verify
              that we do exactly what we say.
            </p>

            <motion.div
              className="grid md:grid-cols-3 gap-px bg-white/10"
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {[
                {
                  num: '01',
                  title: 'API (NestJS)',
                  desc: 'Backend API handling staking, P2P escrow, grants, burns, metrics, and wallet operations. TypeScript, PostgreSQL, Solana RPC.',
                },
                {
                  num: '02',
                  title: 'Wallet App (React)',
                  desc: 'Progressive Web App built with React and Vite. Non-custodial wallet, P2P trading, staking dashboard, grant voting, and card management.',
                },
                {
                  num: '03',
                  title: 'Marketing Site (Next.js)',
                  desc: 'This website. Built with Next.js 14, Framer Motion, and Tailwind CSS. Server-rendered with live data from the Solana blockchain.',
                },
              ].map((repo, i) => (
                <motion.div
                  key={repo.num}
                  custom={i}
                  variants={fadeUp}
                  className="bg-black p-8 hover:bg-white/[0.02] transition"
                >
                  <span className="font-mono text-sm text-gold-500 mb-4 block">{repo.num}</span>
                  <h3 className="text-lg font-bold mb-3">{repo.title}</h3>
                  <p className="text-white/40 leading-relaxed text-sm">{repo.desc}</p>
                </motion.div>
              ))}
            </motion.div>

            <div className="mt-10 flex flex-wrap gap-6">
              <a
                href="https://github.com/juanpablorosales990/mvga"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white/30 hover:text-white transition animated-underline inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
                View Full Repository
              </a>
            </div>
          </div>
        </section>

        {/* ── TOKENOMICS ───────────────────────────────────────── */}
        <section id="tokenomics" className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              Tokenomics
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-16">
              Fair launch. Long vesting. Community first.
            </h2>

            <div className="grid lg:grid-cols-2 gap-12 items-start">
              <div className="space-y-5">
                {[
                  { label: 'Community & Liquidity', pct: 40, gold: true },
                  { label: 'Team (2yr vest)', pct: 20, gold: false },
                  { label: 'Humanitarian Fund', pct: 15, gold: false },
                  { label: 'Startup Ecosystem', pct: 10, gold: false },
                  { label: 'Marketing', pct: 10, gold: false },
                  { label: 'Advisors', pct: 5, gold: false },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between mb-2 text-sm">
                      <span className="text-white/60">{item.label}</span>
                      <span className="font-mono text-white/60">{item.pct}%</span>
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

              <div className="border border-white/10 p-8">
                <h3 className="text-xs tracking-[0.3em] uppercase text-white/30 font-mono mb-6">
                  Token Details
                </h3>
                <div className="divide-y divide-white/5">
                  {[
                    { k: 'Name', v: 'Make Venezuela Great Again' },
                    { k: 'Symbol', v: 'MVGA' },
                    { k: 'Network', v: 'Solana' },
                    { k: 'Total Supply', v: '1,000,000,000' },
                    { k: 'Buy/Sell Tax', v: '3% each' },
                    { k: 'Weekly Burn', v: '5% of fees', gold: true },
                    { k: 'Founder Fees', v: '0%', gold: true },
                    { k: 'LP Lock', v: '3 years' },
                    { k: 'Mint Authority', v: 'Renounced', gold: true },
                  ].map((row) => (
                    <div key={row.k} className="flex justify-between py-3">
                      <span className="text-white/40 text-sm">{row.k}</span>
                      <span
                        className={`font-mono text-sm ${row.gold ? 'text-gold-500' : 'text-white'}`}
                      >
                        {row.v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── ROADMAP ──────────────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              Roadmap
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-16">Building in public.</h2>

            <motion.div
              className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10"
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {[
                {
                  phase: '01',
                  name: 'Foundation',
                  items: [
                    'Non-Custodial Wallet',
                    'P2P Exchange',
                    'Token Staking',
                    'Weekly Burns',
                    'Referral System',
                  ],
                  live: true,
                },
                {
                  phase: '02',
                  name: 'Growth',
                  items: [
                    'Business Grants',
                    'Staking Tiers',
                    'Token Swaps',
                    'Mobile PWA',
                    'Fiat On-Ramp',
                  ],
                  live: false,
                },
                {
                  phase: '03',
                  name: 'Expansion',
                  items: [
                    'Visa Debit Card',
                    'Multi-chain Support',
                    'DAO Governance',
                    'Insurance Fund',
                    'Card Spending Controls',
                  ],
                  live: false,
                },
                {
                  phase: '04',
                  name: 'Scale',
                  items: [
                    'Latin America Expansion',
                    'Banking License',
                    'Enterprise API',
                    'Credit System',
                    'Euro Support',
                  ],
                  live: false,
                },
              ].map((phase, i) => (
                <motion.div key={phase.phase} custom={i} variants={fadeUp} className="bg-black p-6">
                  <span className="font-mono text-4xl text-white/[0.06] font-bold block mb-4">
                    {phase.phase}
                  </span>
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg font-bold uppercase">{phase.name}</h3>
                    {phase.live && (
                      <span className="text-xs font-mono text-gold-500 border border-gold-500/30 px-2 py-0.5">
                        LIVE
                      </span>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {phase.items.map((item) => (
                      <li key={item} className="text-sm text-white/30">
                        {item}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-4xl mx-auto text-center">
            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-6xl font-black uppercase tracking-tight mb-6"
            >
              Join the Movement
            </motion.h2>
            <p className="text-xl text-white/40 mb-10">
              Venezuela&apos;s free financial infrastructure. Made by Venezuelans, for Venezuelans.
              Community-owned. Open source. Transparent.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="https://app.mvga.io"
                target="_blank"
                className="bg-white text-black font-bold text-sm uppercase tracking-wider px-8 py-4 hover:bg-transparent hover:text-white border border-white transition-all"
              >
                Open Wallet
              </Link>
              <Link
                href="https://t.me/mvga"
                target="_blank"
                className="border border-white/30 text-white font-bold text-sm uppercase tracking-wider px-8 py-4 hover:border-white transition-all"
              >
                Join Telegram
              </Link>
              <Link
                href="https://twitter.com/mvga"
                target="_blank"
                className="border border-white/30 text-white font-bold text-sm uppercase tracking-wider px-8 py-4 hover:border-white transition-all"
              >
                Follow on X
              </Link>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </GridBackground>
  );
}
