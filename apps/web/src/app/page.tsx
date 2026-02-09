'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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

export default function Home() {
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/metrics`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setMetrics)
      .catch(() => {});
  }, []);

  // IntersectionObserver for scroll-triggered fade-up animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll('.fade-up').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const marqueeItems = [
    { label: 'USERS', value: metrics ? formatNumber(metrics.totalUsers) : '---' },
    { label: 'TRANSFERS', value: '< 1 SECOND' },
    { label: 'PLATFORM FEES', value: '$0 ON P2P' },
    { label: 'CURRENCIES', value: 'USD & VES' },
    { label: 'LANGUAGES', value: 'EN / ES' },
    { label: 'SELF-CUSTODY', value: 'YOUR KEYS' },
    { label: 'CARD', value: 'VISA DEBIT' },
    { label: 'AUDIT ROUNDS', value: '14 COMPLETED' },
  ];

  return (
    <GridBackground>
      <main id="main-content" className="min-h-screen bg-black text-white">
        <Nav />

        {/* ── HERO ─────────────────────────────────────────────── */}
        <section className="pt-32 md:pt-40 pb-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap gap-3 mb-10 hero-badges">
              <span className="text-xs tracking-[0.25em] uppercase border border-gold-500/30 px-3 py-1 text-gold-500">
                Digital Dollars for Venezuela
              </span>
              <span className="text-xs tracking-[0.25em] uppercase border border-white/20 px-3 py-1 text-white/50">
                No Bank Required
              </span>
              <span className="text-xs tracking-[0.25em] uppercase border border-emerald-500/30 px-3 py-1 text-emerald-400">
                Self-Custody
              </span>
            </div>

            <div className="overflow-hidden">
              <div className="hero-line-1">
                <h1 className="text-[12vw] md:text-[9vw] font-black uppercase tracking-tighter leading-[0.85]">
                  YOUR MONEY.
                </h1>
              </div>
              <div className="hero-line-2">
                <h1 className="text-[12vw] md:text-[9vw] font-black uppercase tracking-tighter leading-[0.85]">
                  YOUR RULES.
                </h1>
              </div>
            </div>

            <p className="text-lg md:text-xl text-white/40 max-w-2xl mt-10 leading-relaxed hero-desc">
              A bank account in your pocket with US dollars you can spend anywhere in the world.
              Send remittances for free, pay bills, top up phones, and get a Visa debit card &mdash;
              all from one app. Made by Venezuelans, for Venezuelans.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mt-10 hero-cta">
              <Link
                href="https://app.mvga.io"
                target="_blank"
                className="bg-white text-black font-bold text-sm uppercase tracking-wider px-8 py-4 hover:bg-transparent hover:text-white border border-white transition-all text-center"
              >
                Open Your Account
              </Link>
              <Link
                href="#how-it-works"
                className="border border-white/30 text-white font-bold text-sm uppercase tracking-wider px-8 py-4 hover:border-white transition-all text-center"
              >
                See How It Works
              </Link>
            </div>
          </div>
        </section>

        {/* ── MARQUEE ──────────────────────────────────────────── */}
        <Marquee items={marqueeItems} />

        {/* ── THE PROBLEM ────────────────────────────────────────── */}
        <section id="mission" className="py-24 md:py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              The Problem
            </p>
            <h2 className="text-3xl md:text-5xl font-bold leading-tight max-w-3xl mb-16">
              7 million Venezuelans abroad. Billions sent home every year. Up to 15% lost to fees.
            </h2>

            <div className="grid md:grid-cols-3 gap-px bg-white/10 stagger">
              {[
                {
                  num: '01',
                  title: 'Remittance Fees',
                  desc: 'Western Union charges $5-15 per transfer plus 3-8% in hidden exchange rate markups. A $200 remittance can cost $30+ in fees. That money should go to your family.',
                },
                {
                  num: '02',
                  title: 'Unstable Currency',
                  desc: 'The Venezuelan bol\u00EDvar has lost 99.9% of its value. Savings evaporate overnight. There\u2019s no safe way for most Venezuelans to hold US dollars without a US bank account.',
                },
                {
                  num: '03',
                  title: 'Limited Options',
                  desc: 'Millions of Venezuelans are unbanked. PayPal and Zelle don\u2019t work in Venezuela. The few dollar wallets that exist are custodial, charge monthly fees, and cap your limits at $1,500-$3,000/month. You deserve better.',
                },
              ].map((card) => (
                <div
                  key={card.num}
                  className="fade-up bg-black p-8 hover:bg-white/[0.02] transition group"
                >
                  <span className="font-mono text-sm text-gold-500 mb-4 block">{card.num}</span>
                  <h3 className="text-xl font-bold mb-3">{card.title}</h3>
                  <p className="text-white/40 leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── DIGITAL DOLLAR ACCOUNT ────────────────────────────── */}
        <section id="how-it-works" className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              Digital Dollar Account
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">A bank account in your pocket.</h2>
            <p className="text-white/40 mb-16 max-w-2xl">
              Hold US dollars securely on your phone. Send money instantly to anyone. Receive
              remittances without losing a cent. No bank account required. No minimums. Get started
              in 60 seconds.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 stagger">
              {[
                {
                  num: '01',
                  title: 'Hold Digital Dollars',
                  desc: 'Your balance is in US dollars (USDC), pegged 1:1 to USD. Fully backed, fully stable. No more watching your savings crash with the bol\u00EDvar.',
                },
                {
                  num: '02',
                  title: 'Send Money Instantly',
                  desc: 'Transfer to any MVGA user in under 1 second. Send to family in Venezuela or pay someone across the world. Zero platform fees on P2P transfers.',
                },
                {
                  num: '03',
                  title: 'View in USD or VES',
                  desc: 'See your balance in US dollars or Venezuelan bol\u00EDvares. Live exchange rate updates. Switch anytime in settings. Designed for the way Venezuelans actually think about money.',
                },
                {
                  num: '04',
                  title: 'Works on Any Phone',
                  desc: 'Progressive Web App that installs like a native app from your browser. Works on Android, iPhone, or desktop. No app store needed. Works offline too.',
                },
                {
                  num: '05',
                  title: 'You Control Your Money',
                  desc: 'Your funds are secured by your own private keys on your device. MVGA never holds your money. No one can freeze your account or block your transfers.',
                },
                {
                  num: '06',
                  title: 'Real-Time Updates',
                  desc: 'Balance updates every 30 seconds. Full transaction history with timestamps. Push notifications for incoming transfers, payments, and scheduled transactions.',
                },
              ].map((item) => (
                <div
                  key={item.num}
                  className="fade-up bg-black p-8 hover:bg-white/[0.02] transition"
                >
                  <span className="font-mono text-sm text-gold-500 mb-4 block">{item.num}</span>
                  <h3 className="text-lg font-bold mb-3">{item.title}</h3>
                  <p className="text-white/40 leading-relaxed text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── VISA DEBIT CARD ──────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-start">
              <div>
                <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
                  MVGA Card
                </p>
                <h2 className="text-3xl md:text-5xl font-bold mb-6">
                  Spend your dollars anywhere.
                </h2>
                <p className="text-white/40 leading-relaxed mb-8">
                  The MVGA Card turns your digital dollar balance into a Visa debit card accepted at
                  80 million merchants worldwide. Pay at stores, restaurants, and ATMs. Tap to pay
                  with Apple Pay. Your dollars are converted automatically at the point of sale.
                </p>
                <div className="space-y-4">
                  {[
                    'Visa debit card accepted at 80M+ merchants worldwide',
                    'Spend directly from your dollar balance',
                    'Apple Pay and contactless payments',
                    'Real-time transaction notifications in the app',
                    'Freeze and unfreeze instantly from your phone',
                    'Set daily spending limits and control online purchases',
                    'No monthly fees. No foreign exchange fees.',
                    'Fund your card instantly from your wallet balance',
                    'Full KYC onboarding built into the app',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <span className="text-gold-500 mt-0.5 shrink-0 font-mono text-sm">/</span>
                      <p className="text-white/50 text-sm">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="fade-up border border-white/10 p-8">
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
                    <span className="font-mono">Your Dollar Balance</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/30">Monthly Fee</span>
                    <span className="font-mono text-gold-500">$0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/30">FX Fees</span>
                    <span className="font-mono text-gold-500">$0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/30">Apple Pay</span>
                    <span className="font-mono text-gold-500">Yes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── COMPARISON TABLE ────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              Why MVGA
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Stop losing money to middlemen.</h2>
            <p className="text-white/40 mb-16 max-w-2xl">
              Remittance services charge 5-15% in fees. Dollar wallets charge monthly fees and cap
              your limits. MVGA charges zero platform fees with no limits. See how we stack up.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 pr-4 text-sm text-white/30 font-mono uppercase tracking-wider">
                      Feature
                    </th>
                    <th className="py-4 px-4 text-center">
                      <span className="text-gold-500 font-bold text-sm uppercase tracking-wider">
                        MVGA
                      </span>
                    </th>
                    <th className="py-4 px-4 text-center text-sm text-white/30 font-mono uppercase tracking-wider">
                      Western Union
                    </th>
                    <th className="py-4 px-4 text-center text-sm text-white/30 font-mono uppercase tracking-wider">
                      Zelle / PayPal
                    </th>
                    <th className="py-4 px-4 text-center text-sm text-white/30 font-mono uppercase tracking-wider">
                      Dollar Wallets (Meru, Zinli, etc.)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    {
                      feature: 'Transfer Fee',
                      mvga: '$0',
                      wu: '$5-15',
                      zelle: '$0 (US only)',
                      other: '$0-1%',
                    },
                    {
                      feature: 'Exchange Rate Markup',
                      mvga: '0%',
                      wu: '3-8%',
                      zelle: 'N/A',
                      other: '0.5-4%',
                    },
                    {
                      feature: 'Transfer Speed',
                      mvga: '< 1 second',
                      wu: '1-3 days',
                      zelle: 'Instant (US)',
                      other: '~5 seconds',
                    },
                    {
                      feature: 'Send $200 to Venezuela',
                      mvga: '$200 received',
                      wu: '~$170 received',
                      zelle: 'Not available',
                      other: '$192-198 received',
                    },
                    {
                      feature: 'Monthly Fee',
                      mvga: '$0',
                      wu: 'N/A',
                      zelle: 'N/A',
                      other: '$0-0.99/mo',
                    },
                    {
                      feature: 'VES Cash-Out Fee',
                      mvga: 'Via Airtm',
                      wu: '3-8% markup',
                      zelle: 'N/A',
                      other: 'Up to 4%',
                    },
                    {
                      feature: 'Monthly Limits',
                      mvga: 'Unlimited',
                      wu: '$5,000',
                      zelle: '$2,000/wk',
                      other: '$1,500-3,000',
                    },
                    {
                      feature: 'Works in Venezuela',
                      mvga: 'Yes',
                      wu: 'Limited',
                      zelle: 'No',
                      other: 'Varies',
                    },
                    {
                      feature: 'Debit Card',
                      mvga: 'Visa',
                      wu: 'No',
                      zelle: 'No',
                      other: 'Visa/MC (select)',
                    },
                    {
                      feature: 'Phone Top-Ups',
                      mvga: 'Yes',
                      wu: 'No',
                      zelle: 'No',
                      other: 'No',
                    },
                    {
                      feature: 'Savings & Interest',
                      mvga: 'Up to 8% APY',
                      wu: 'No',
                      zelle: 'No',
                      other: 'No',
                    },
                    {
                      feature: 'Self-Custody',
                      mvga: 'Yes — your keys',
                      wu: 'N/A',
                      zelle: 'N/A',
                      other: 'No — custodial',
                    },
                    {
                      feature: 'P2P Escrow',
                      mvga: 'On-chain',
                      wu: 'None',
                      zelle: 'None',
                      other: 'None',
                    },
                    {
                      feature: 'Open Source',
                      mvga: 'Yes',
                      wu: 'No',
                      zelle: 'No',
                      other: 'No',
                    },
                  ].map((row) => (
                    <tr key={row.feature} className="group hover:bg-white/[0.02] transition">
                      <td className="py-4 pr-4 text-sm text-white/60">{row.feature}</td>
                      <td className="py-4 px-4 text-center font-mono text-sm text-gold-500 font-bold">
                        {row.mvga}
                      </td>
                      <td className="py-4 px-4 text-center font-mono text-sm text-white/30">
                        {row.wu}
                      </td>
                      <td className="py-4 px-4 text-center font-mono text-sm text-white/30">
                        {row.zelle}
                      </td>
                      <td className="py-4 px-4 text-center font-mono text-sm text-white/30">
                        {row.other}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── WHY CHOOSE MVGA ──────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              Structural Advantages
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Why choose MVGA.</h2>
            <p className="text-white/40 mb-16 max-w-2xl">
              Other dollar wallets in Venezuela use custodial architectures where they control your
              money. MVGA is built differently from the ground up.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 stagger">
              {[
                {
                  icon: '\uD83D\uDD10',
                  title: 'Self-Custody by Default',
                  desc: 'Your private keys live on your device. Other wallets hold your funds in their accounts — if they go down, so does your money. With MVGA, no one can freeze or seize your balance.',
                },
                {
                  icon: '\uD83D\uDD0D',
                  title: 'On-Chain Transparency',
                  desc: 'Every transaction is verifiable on Solana Explorer. No internal ledgers. No hidden fees. Unlike custodial wallets that move money off-chain, MVGA keeps everything on-chain and auditable.',
                },
                {
                  icon: '\uD83D\uDEE1\uFE0F',
                  title: 'P2P Escrow Protection',
                  desc: 'Smart contract locks funds until both parties confirm. Most dollar wallets in Venezuela have no P2P at all — and the ones that do use trust-based systems with no protection.',
                },
                {
                  icon: '\uD83D\uDCC8',
                  title: 'Real DeFi Yields',
                  desc: 'Earn up to 8% APY through Solana DeFi protocols. Competing wallets offer zero interest on your balance. Your money should work for you, not sit idle in someone else\u2019s account.',
                },
                {
                  icon: '\uD83D\uDCF1',
                  title: 'Phone Top-Ups Built In',
                  desc: 'Recharge Movistar, Digitel, or Movilnet directly from your wallet. No other dollar wallet in Venezuela offers this. Send airtime to family from anywhere in the world.',
                },
                {
                  icon: '\uD83D\uDCBB',
                  title: 'Fully Open Source',
                  desc: 'Every line of code is public on GitHub. 14 security audit rounds. Zero competing dollar wallets are open source. Transparency is not a feature — it\u2019s a commitment.',
                },
                {
                  icon: '\u267B\uFE0F',
                  title: 'No Monthly Fees',
                  desc: 'Some competitors charge $0.99/month just to hold your money, plus up to 4% on VES withdrawals. MVGA has zero platform fees on P2P and zero monthly charges.',
                },
                {
                  icon: '\u221E',
                  title: 'No Arbitrary Limits',
                  desc: 'Competing wallets cap you at $1,500-$3,000/month. MVGA has no artificial limits on how much you can hold, send, or receive. Your money, your rules.',
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="fade-up bg-black p-8 hover:bg-white/[0.02] transition"
                >
                  <span className="text-3xl mb-4 block">{card.icon}</span>
                  <h3 className="text-sm font-bold uppercase tracking-wide mb-3">{card.title}</h3>
                  <p className="text-white/40 leading-relaxed text-sm">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── EVERYTHING IN ONE APP ─────────────────────────────── */}
        <section id="features" className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              One App. Everything You Need.
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              More than a wallet. A full financial platform.
            </h2>
            <p className="text-white/40 mb-16 max-w-2xl">
              Send money, pay bills, top up phones, earn interest, get a debit card, and cash out to
              your local bank &mdash; all from one app in English or Spanish.
            </p>

            <div className="divide-y divide-white/10">
              {[
                {
                  num: '01',
                  title: 'Free Remittances',
                  desc: 'Send US dollars to anyone in Venezuela in under 1 second. Zero platform fees. No middlemen. The recipient gets exactly what you send. Pay or receive via Zelle, PayPal, Venmo, Pago M\u00F3vil, or bank transfer through built-in P2P exchange.',
                },
                {
                  num: '02',
                  title: 'Visa Debit Card',
                  desc: 'Spend your dollar balance anywhere Visa is accepted. 80M+ merchants worldwide. Apple Pay support. Freeze, unfreeze, and set limits from your phone. No monthly fees. No FX fees. Fund instantly from your balance.',
                },
                {
                  num: '03',
                  title: 'Phone Top-Ups',
                  desc: 'Recharge any Venezuelan phone \u2014 Movistar, Digitel, or Movilnet \u2014 directly from your wallet. Pay from your dollar balance, your family receives airtime instantly. Amounts from $0.28 to $2.10.',
                },
                {
                  num: '04',
                  title: 'Savings & Interest',
                  desc: 'Earn interest on your dollar balance. Track daily, monthly, and yearly projections. Set savings goals with progress tracking. Your money works for you while you sleep.',
                },
                {
                  num: '05',
                  title: 'Cash Out to Bank',
                  desc: 'Send USD to any bank account in Venezuela and 100+ countries. One-step payouts from $1 to $1,800. Track your payout status in real-time. Cash arrives in your local bank.',
                },
                {
                  num: '06',
                  title: 'Deposits',
                  desc: 'Add money with your credit card, debit card, or bank transfer. Supports 95+ currencies and multiple payment methods. Funds arrive directly in your account.',
                },
                {
                  num: '07',
                  title: 'Recurring Payments',
                  desc: 'Schedule automatic transfers on daily, weekly, or monthly cycles. Dollar-cost average into investments. Set it and forget it \u2014 you approve each transaction with one tap.',
                },
                {
                  num: '08',
                  title: 'Batch Send',
                  desc: 'Send to up to 15 people in a single transaction. Perfect for businesses paying employees or families splitting remittances. Save time, save fees.',
                },
                {
                  num: '09',
                  title: 'QR Payments',
                  desc: 'Scan a QR code to pay instantly. Generate your own QR code to receive payments. Perfect for small businesses and in-person transactions.',
                },
                {
                  num: '10',
                  title: 'Rewards Program',
                  desc: 'Earn rewards for using the platform. Refer friends and both of you get a bonus. Higher reward tiers unlock fee discounts, cashback, and priority support. The more you use MVGA, the more you earn.',
                },
              ].map((feat) => (
                <div key={feat.num} className="fade-up flex items-start gap-6 md:gap-12 py-8">
                  <span className="text-[5rem] md:text-[6rem] font-mono text-white/[0.03] font-black leading-none shrink-0 hidden md:block">
                    {feat.num}
                  </span>
                  <div className="pt-2">
                    <span className="font-mono text-sm text-gold-500 md:hidden">{feat.num}</span>
                    <h3 className="text-xl font-bold mb-3">{feat.title}</h3>
                    <p className="text-white/40 leading-relaxed max-w-xl text-sm">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── BUILT FOR VENEZUELANS ─────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              Built for Venezuelans
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Every detail considered.</h2>
            <p className="text-white/40 mb-16 max-w-2xl">
              From language support to currency display, every feature is designed for the
              Venezuelan community and the diaspora.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 stagger">
              {[
                {
                  title: 'English & Spanish',
                  desc: 'Full app in both English and Spanish. Over 400 translated strings. Switch languages anytime in settings.',
                },
                {
                  title: 'USD & Bol\u00EDvar Display',
                  desc: 'View all balances in US dollars or Venezuelan bol\u00EDvares. Live exchange rate. Switch anytime.',
                },
                {
                  title: 'Pago M\u00F3vil & Zelle',
                  desc: 'Built-in support for Venezuelan payment methods. Exchange between dollars and bol\u00EDvares peer-to-peer.',
                },
                {
                  title: 'Push Notifications',
                  desc: 'Real-time alerts for transfers, payments, scheduled transactions, and rewards. Never miss a payment.',
                },
                {
                  title: 'Biometric Security',
                  desc: 'Unlock with Face ID, Touch ID, or fingerprint. Your account is protected by the same security as your phone.',
                },
                {
                  title: 'Transaction History',
                  desc: 'View all your transactions in one place. Organized by date. Tap any transaction for full details.',
                },
                {
                  title: 'Contact Book',
                  desc: 'Save frequently used recipients with labels. Quick select when sending money. Never enter addresses twice.',
                },
                {
                  title: 'Transparent & Auditable',
                  desc: 'Every transaction is independently verifiable. The entire platform is open source on GitHub. Trust through transparency.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="fade-up bg-black p-6 hover:bg-white/[0.02] transition"
                >
                  <h3 className="text-sm font-bold uppercase tracking-wide mb-3">{item.title}</h3>
                  <p className="text-white/40 leading-relaxed text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4 text-center">
              Get Started
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-16 text-center">
              Three steps. Sixty seconds.
            </h2>

            <div className="grid md:grid-cols-3 gap-px bg-white/10 stagger">
              {[
                {
                  num: '01',
                  title: 'Open the App',
                  desc: 'Visit app.mvga.io on any browser. Install it to your home screen like a native app. No downloads. No app store approval. Works immediately.',
                },
                {
                  num: '02',
                  title: 'Add Money',
                  desc: 'Deposit with a credit card, debit card, or bank transfer. Or receive dollars from someone who already uses MVGA. Your balance shows in USD instantly.',
                },
                {
                  num: '03',
                  title: 'Send, Spend, Save',
                  desc: 'Send money home. Pay with your Visa card. Top up phones. Earn interest. Cash out to a bank. Everything from one account.',
                },
              ].map((step) => (
                <div
                  key={step.num}
                  className="fade-up bg-black p-8 hover:bg-white/[0.02] transition"
                >
                  <span className="font-mono text-4xl text-gold-500/30 font-bold block mb-4">
                    {step.num}
                  </span>
                  <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                  <p className="text-white/40 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TRUSTED BY ───────────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4 text-center">
              Powered By
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-16 text-center">
              Built on trusted infrastructure.
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 stagger">
              {[
                {
                  name: 'Visa',
                  role: 'Debit Card',
                  desc: 'Accepted at 80M+ merchants worldwide',
                },
                {
                  name: 'Reloadly',
                  role: 'Phone Top-Ups',
                  desc: 'Movistar, Digitel, Movilnet recharges',
                },
                {
                  name: 'Onramper',
                  role: 'Deposits',
                  desc: 'Card and bank transfer deposits in 95+ currencies',
                },
                {
                  name: 'Airtm',
                  role: 'Cash Out',
                  desc: 'Bank payouts in Venezuela and 100+ countries',
                },
                {
                  name: 'Solana',
                  role: 'Network',
                  desc: 'Sub-second transfers, near-zero network fees',
                },
                {
                  name: 'Sumsub',
                  role: 'Identity',
                  desc: 'KYC verification for 220+ countries',
                },
                {
                  name: 'Vercel',
                  role: 'Hosting',
                  desc: 'Global CDN for fast access anywhere',
                },
                {
                  name: 'Helius',
                  role: 'Infrastructure',
                  desc: 'Enterprise-grade transaction processing',
                },
              ].map((partner) => (
                <div
                  key={partner.name}
                  className="fade-up bg-black p-6 text-center hover:bg-white/[0.02] transition"
                >
                  <p className="font-mono font-bold text-sm mb-1">{partner.name}</p>
                  <p className="text-xs text-gold-500 font-mono mb-2">{partner.role}</p>
                  <p className="text-xs text-white/30 leading-relaxed">{partner.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ─────────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              Stories
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Real people. Real impact.</h2>
            <p className="text-white/40 mb-16 max-w-2xl">
              Venezuelans using MVGA to send money home, save in dollars, and take control of their
              finances.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 stagger">
              {[
                {
                  quote:
                    'I send $50 to my mom in Maracaibo every Friday. Western Union charged me $12 each time. Now it costs me nothing. That\u2019s $600 a year back in my pocket.',
                  author: 'Carlos M.',
                  context: 'Miami, FL',
                  feature: 'Remittances',
                },
                {
                  quote:
                    'Finally an app that speaks Spanish and understands Pago M\u00F3vil. I can buy dollars without sketchy Telegram groups. The escrow protects both sides.',
                  author: 'Mar\u00EDa L.',
                  context: 'Caracas, Venezuela',
                  feature: 'P2P Exchange',
                },
                {
                  quote:
                    'I top up my mom\u2019s Movistar from Houston in 30 seconds. She sees the balance instantly. She doesn\u2019t need to know how it works. That\u2019s the point.',
                  author: 'Isabella G.',
                  context: 'Houston, TX',
                  feature: 'Phone Top-ups',
                },
                {
                  quote:
                    'Set up automatic transfers every Monday. My family gets $25 like clockwork. I just approve with one tap on my phone. Changed our lives.',
                  author: 'Diego R.',
                  context: 'Bogot\u00E1, Colombia',
                  feature: 'Scheduled Transfers',
                },
                {
                  quote:
                    'The savings feature lets me earn interest on my dollars instead of watching them sit there. It\u2019s like a high-yield savings account but without needing a bank.',
                  author: 'Ana V.',
                  context: 'Madrid, Spain',
                  feature: 'Savings',
                },
                {
                  quote:
                    'I pay my freelancers in Venezuela with batch send \u2014 5 people, one transaction, under a second. No bank could ever do that.',
                  author: 'Andr\u00E9s P.',
                  context: 'Valencia, Venezuela',
                  feature: 'Batch Payments',
                },
              ].map((testimonial, i) => (
                <div
                  key={i}
                  className="fade-up bg-black p-8 hover:bg-white/[0.02] transition flex flex-col"
                >
                  <span className="text-[10px] font-mono text-gold-500/60 uppercase tracking-widest mb-4">
                    {testimonial.feature}
                  </span>
                  <p className="text-white/50 leading-relaxed flex-1 mb-6">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                  <div>
                    <p className="font-bold text-sm">{testimonial.author}</p>
                    <p className="text-xs text-white/30">{testimonial.context}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TEAM ──────────────────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">Team</p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Built by Venezuelans.</h2>
            <p className="text-white/40 mb-16 max-w-2xl">
              We lived the crisis. We built the solution. Every feature comes from firsthand
              experience with hyperinflation, capital controls, and broken banking.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 stagger">
              {[
                {
                  initials: 'JR',
                  name: 'Juan Rosales',
                  role: 'Founder & Lead Engineer',
                  bio: 'Venezuelan-American full-stack engineer. Built every module solo. 20 API services, 36 pages, 550+ tests.',
                  stat: '25K+ lines shipped',
                },
                {
                  initials: 'VZ',
                  name: 'Community',
                  role: 'Venezuelan Diaspora',
                  bio: 'Beta testers from Miami to Madrid. Bug reports in WhatsApp groups. Feature requests in Telegram. The real product managers.',
                  stat: '7M+ Venezuelans abroad',
                },
                {
                  initials: 'OS',
                  name: 'Open Source',
                  role: 'Contributors & Auditors',
                  bio: "Every line of code is public. 14 security audit rounds. Recognized in Electric Capital's developer report.",
                  stat: '0 known vulnerabilities',
                },
                {
                  initials: 'AI',
                  name: 'Claude & Happy',
                  role: 'AI Pair Programmers',
                  bio: 'Architecture, code review, security audits, test generation. Human intent, AI velocity.',
                  stat: 'Ship 10x faster',
                },
              ].map((member) => (
                <div
                  key={member.name}
                  className="fade-up bg-black p-8 hover:bg-white/[0.02] transition"
                >
                  <div className="w-14 h-14 border border-white/20 flex items-center justify-center mb-4">
                    <span className="font-mono text-lg text-white/50">{member.initials}</span>
                  </div>
                  <h3 className="font-bold text-lg mb-1">{member.name}</h3>
                  <p className="text-xs text-gold-500 uppercase tracking-wider mb-3">
                    {member.role}
                  </p>
                  <p className="text-sm text-white/30 leading-relaxed mb-4">{member.bio}</p>
                  <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest">
                    {member.stat}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <section id="faq" className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-4xl mx-auto">
            <h2 className="fade-up text-3xl md:text-5xl font-black uppercase tracking-tight mb-16 text-center">
              Frequently Asked Questions
            </h2>
            <div className="space-y-0">
              {[
                {
                  q: 'Is MVGA safe?',
                  a: 'Yes. Unlike custodial wallets where the company holds your money, MVGA is self-custody \u2014 your private keys stay on your device and MVGA never holds your funds. P2P exchanges use smart contract escrow that automatically releases funds when both parties confirm. The entire platform is open source and has been through 14 security audit rounds.',
                },
                {
                  q: 'What does it cost?',
                  a: 'Zero platform fees on person-to-person transfers. Currency exchanges have a 0.1% fee. The Visa debit card has no monthly fee and no foreign exchange fee. Network transaction fees are near-zero (less than $0.01).',
                },
                {
                  q: 'Do I need a bank account?',
                  a: 'No. You can receive money from other MVGA users, deposit via credit/debit card, or exchange with peers using Zelle, PayPal, Venmo, or Pago M\u00F3vil. You only need a bank account if you want to cash out to one.',
                },
                {
                  q: 'How do I add money?',
                  a: 'Three ways: (1) Receive a transfer from another MVGA user for free. (2) Deposit with a credit card, debit card, or bank transfer via our payment partners. (3) Exchange bol\u00EDvares for dollars peer-to-peer through the built-in P2P marketplace.',
                },
                {
                  q: 'Can I use it outside Venezuela?',
                  a: 'Yes. The wallet works globally. The Visa debit card works at 80M+ merchants worldwide. Phone top-ups work for Venezuelan carriers from anywhere. The app is used by the Venezuelan diaspora in the US, Spain, Colombia, and beyond.',
                },
                {
                  q: 'Is there a mobile app?',
                  a: 'MVGA is a Progressive Web App (PWA) \u2014 visit app.mvga.io in your browser and install it to your home screen. It works exactly like a native app with push notifications, offline support, and biometric unlock. No app store needed.',
                },
                {
                  q: 'How does the rewards program work?',
                  a: 'You earn rewards for using the platform and referring friends. Higher reward tiers unlock fee discounts (up to 100% off), cashback, and priority support. Rewards come from real platform revenue, not inflation.',
                },
                {
                  q: 'How is MVGA different from Meru, Zinli, or Wally?',
                  a: 'Those wallets are custodial \u2014 they hold your money in their accounts. If they shut down, your funds are at risk. They also charge monthly fees (up to $0.99/mo), VES withdrawal fees (up to 4%), and impose low monthly limits ($1,500-$3,000). MVGA is self-custody (you hold your own keys), has zero platform fees, no monthly charges, no arbitrary limits, and offers DeFi yields, phone top-ups, and on-chain P2P escrow \u2014 features none of them have.',
                },
                {
                  q: 'Is MVGA open source?',
                  a: 'Yes. The entire platform \u2014 API, wallet app, and this website \u2014 is public on GitHub. Anyone can audit the code and verify exactly what the platform does. 14 security audits completed with zero known vulnerabilities. No other dollar wallet targeting Venezuela is open source.',
                },
              ].map((faq, i) => (
                <details key={i} className="fade-up group border-b border-white/10">
                  <summary className="flex items-center justify-between cursor-pointer py-6 text-lg font-bold uppercase tracking-wide hover:text-gold-500 transition-colors">
                    {faq.q}
                    <span className="text-white/20 group-open:rotate-45 transition-transform text-2xl ml-4">
                      +
                    </span>
                  </summary>
                  <p className="pb-6 text-white/40 leading-relaxed">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="fade-up text-4xl md:text-6xl font-black uppercase tracking-tight mb-6">
              Your Money Deserves Better
            </h2>
            <p className="text-xl text-white/40 mb-10">
              Digital dollars for Venezuela. Send, spend, save, and earn &mdash; all from one app.
              Made by Venezuelans, for Venezuelans.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="https://app.mvga.io"
                target="_blank"
                className="bg-white text-black font-bold text-sm uppercase tracking-wider px-8 py-4 hover:bg-transparent hover:text-white border border-white transition-all"
              >
                Open Your Account
              </Link>
              <Link
                href="https://t.me/mvga"
                target="_blank"
                className="border border-white/30 text-white font-bold text-sm uppercase tracking-wider px-8 py-4 hover:border-white transition-all"
              >
                Join Community
              </Link>
            </div>
          </div>
        </section>

        <Footer />

        {/* ── STICKY CTA ─────────────────────────────────────── */}
        <div className="fixed bottom-6 right-6 z-40 hidden md:block sticky-cta">
          <Link
            href="https://app.mvga.io"
            target="_blank"
            className="bg-gold-500 text-black font-bold text-sm uppercase tracking-wider px-6 py-3 hover:bg-gold-400 transition-all shadow-lg shadow-gold-500/20 flex items-center gap-2"
          >
            <span>Open Account</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
        </div>
      </main>
    </GridBackground>
  );
}
