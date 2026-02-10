'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import GridBackground from '@/components/GridBackground';
import Marquee from '@/components/Marquee';
import AppStoreBadges from '@/components/AppStoreBadges';
import { API_BASE, formatNumber } from '@/lib/utils';
import type { Dictionary, Locale } from '@/i18n';

interface LiveMetrics {
  tvl: number;
  volume24h: number;
  revenue24h: number;
  totalUsers: number;
  activeUsers: number;
  totalStakers: number;
  totalBurned: number;
}

export default function HomeClient({ dict, lang }: { dict: Dictionary; lang: Locale }) {
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
    { label: dict.marquee.users, value: metrics ? formatNumber(metrics.totalUsers) : '---' },
    { label: dict.marquee.transfers, value: dict.marquee.transfersValue },
    { label: dict.marquee.platformFees, value: dict.marquee.platformFeesValue },
    { label: dict.marquee.currencies, value: dict.marquee.currenciesValue },
    { label: dict.marquee.languages, value: dict.marquee.languagesValue },
    { label: dict.marquee.selfCustody, value: dict.marquee.selfCustodyValue },
    { label: dict.marquee.card, value: dict.marquee.cardValue },
    { label: dict.marquee.auditRounds, value: dict.marquee.auditRoundsValue },
  ];

  return (
    <GridBackground>
      <main id="main-content" className="min-h-screen bg-black text-white">
        <Nav lang={lang} dict={dict} />

        {/* ── HERO ─────────────────────────────────────────────── */}
        <section className="pt-32 md:pt-40 pb-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap gap-3 mb-10 hero-badges">
              <span className="text-xs tracking-[0.25em] uppercase border border-gold-500/30 px-3 py-1 text-gold-500">
                {dict.hero.badge1}
              </span>
              <span className="text-xs tracking-[0.25em] uppercase border border-white/20 px-3 py-1 text-white/50">
                {dict.hero.badge2}
              </span>
              <span className="text-xs tracking-[0.25em] uppercase border border-emerald-500/30 px-3 py-1 text-emerald-400">
                {dict.hero.badge3}
              </span>
            </div>

            <div className="overflow-hidden">
              <div className="hero-line-1">
                <h1 className="text-[12vw] md:text-[9vw] font-black uppercase tracking-tighter leading-[0.85]">
                  {dict.hero.line1}
                </h1>
              </div>
              <div className="hero-line-2">
                <h1 className="text-[12vw] md:text-[9vw] font-black uppercase tracking-tighter leading-[0.85]">
                  {dict.hero.line2}
                </h1>
              </div>
            </div>

            <p className="text-lg md:text-xl text-white/40 max-w-2xl mt-10 leading-relaxed hero-desc">
              {dict.hero.desc}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mt-10 hero-cta">
              <Link
                href="https://app.mvga.io"
                target="_blank"
                className="bg-white text-black font-bold text-sm uppercase tracking-wider px-8 py-4 hover:bg-transparent hover:text-white border border-white transition-all text-center"
              >
                {dict.hero.cta1}
              </Link>
              <Link
                href="#how-it-works"
                className="border border-white/30 text-white font-bold text-sm uppercase tracking-wider px-8 py-4 hover:border-white transition-all text-center"
              >
                {dict.hero.cta2}
              </Link>
            </div>

            <AppStoreBadges className="mt-8 hero-cta" />
          </div>
        </section>

        {/* ── MARQUEE ──────────────────────────────────────────── */}
        <Marquee items={marqueeItems} />

        {/* ── THE PROBLEM ────────────────────────────────────────── */}
        <section id="mission" className="py-24 md:py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              {dict.problem.label}
            </p>
            <h2 className="text-3xl md:text-5xl font-bold leading-tight max-w-3xl mb-16">
              {dict.problem.title}
            </h2>

            <div className="grid md:grid-cols-3 gap-px bg-white/10 stagger">
              {dict.problem.cards.map((card) => (
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
              {dict.digitalDollar.label}
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">{dict.digitalDollar.title}</h2>
            <p className="text-white/40 mb-16 max-w-2xl">{dict.digitalDollar.subtitle}</p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 stagger">
              {dict.digitalDollar.cards.map((item) => (
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
                  {dict.visaCard.label}
                </p>
                <h2 className="text-3xl md:text-5xl font-bold mb-6">{dict.visaCard.title}</h2>
                <p className="text-white/40 leading-relaxed mb-8">{dict.visaCard.desc}</p>
                <div className="space-y-4">
                  {dict.visaCard.features.map((item) => (
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
                    <p className="text-xs text-white/20 uppercase tracking-wider">
                      {dict.visaCard.yourNameHere}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/30">{dict.visaCard.cardType}</span>
                    <span className="font-mono">{dict.visaCard.cardTypeValue}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/30">{dict.visaCard.funding}</span>
                    <span className="font-mono">{dict.visaCard.fundingValue}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/30">{dict.visaCard.monthlyFee}</span>
                    <span className="font-mono text-gold-500">$0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/30">{dict.visaCard.fxFees}</span>
                    <span className="font-mono text-gold-500">$0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/30">{dict.visaCard.applePay}</span>
                    <span className="font-mono text-gold-500">{dict.visaCard.yes}</span>
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
              {dict.comparison.label}
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">{dict.comparison.title}</h2>
            <p className="text-white/40 mb-16 max-w-2xl">{dict.comparison.subtitle}</p>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 pr-4 text-sm text-white/30 font-mono uppercase tracking-wider">
                      {dict.comparison.feature}
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
                      {dict.comparison.dollarWallets}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {dict.comparison.rows.map((row) => (
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
              {dict.advantages.label}
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">{dict.advantages.title}</h2>
            <p className="text-white/40 mb-16 max-w-2xl">{dict.advantages.subtitle}</p>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 stagger">
              {dict.advantages.cards.map((card) => (
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
              {dict.features.label}
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">{dict.features.title}</h2>
            <p className="text-white/40 mb-16 max-w-2xl">{dict.features.subtitle}</p>

            <div className="divide-y divide-white/10">
              {dict.features.items.map((feat) => (
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
              {dict.builtFor.label}
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">{dict.builtFor.title}</h2>
            <p className="text-white/40 mb-16 max-w-2xl">{dict.builtFor.subtitle}</p>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 stagger">
              {dict.builtFor.cards.map((item) => (
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
              {dict.howItWorks.label}
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-16 text-center">
              {dict.howItWorks.title}
            </h2>

            <div className="grid md:grid-cols-3 gap-px bg-white/10 stagger">
              {dict.howItWorks.steps.map((step) => (
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
              {dict.partners.label}
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-16 text-center">
              {dict.partners.title}
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 stagger">
              {dict.partners.items.map((partner) => (
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
              {dict.testimonials.label}
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">{dict.testimonials.title}</h2>
            <p className="text-white/40 mb-16 max-w-2xl">{dict.testimonials.subtitle}</p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 stagger">
              {dict.testimonials.items.map((testimonial, i) => (
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
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              {dict.team.label}
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">{dict.team.title}</h2>
            <p className="text-white/40 mb-16 max-w-2xl">{dict.team.subtitle}</p>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 stagger">
              {dict.team.members.map((member) => (
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
              {dict.faq.title}
            </h2>
            <div className="space-y-0">
              {dict.faq.items.map((faq, i) => (
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
              {dict.cta.title}
            </h2>
            <p className="text-xl text-white/40 mb-10">{dict.cta.subtitle}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="https://app.mvga.io"
                target="_blank"
                className="bg-white text-black font-bold text-sm uppercase tracking-wider px-8 py-4 hover:bg-transparent hover:text-white border border-white transition-all"
              >
                {dict.cta.cta1}
              </Link>
              <Link
                href="https://t.me/mvga"
                target="_blank"
                className="border border-white/30 text-white font-bold text-sm uppercase tracking-wider px-8 py-4 hover:border-white transition-all"
              >
                {dict.cta.cta2}
              </Link>
            </div>

            <AppStoreBadges className="mt-8 justify-center" />
          </div>
        </section>

        <Footer lang={lang} dict={dict} />

        {/* ── STICKY CTA ─────────────────────────────────────── */}
        <div className="fixed bottom-6 right-6 z-40 hidden md:block sticky-cta">
          <Link
            href="https://app.mvga.io"
            target="_blank"
            className="bg-gold-500 text-black font-bold text-sm uppercase tracking-wider px-6 py-3 hover:bg-gold-400 transition-all shadow-lg shadow-gold-500/20 flex items-center gap-2"
          >
            <span>{dict.stickyCta}</span>
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
