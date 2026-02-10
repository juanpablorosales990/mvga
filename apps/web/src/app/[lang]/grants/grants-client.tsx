'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import GridBackground from '@/components/GridBackground';

interface Proposal {
  id: string;
  businessName: string;
  businessLocation: string;
  description: string;
  requestedAmount: number;
  status: string;
  votesFor: number;
  votesAgainst: number;
  totalVotes: number;
  fundedAt: string | null;
  fundingTx: string | null;
  createdAt: string;
  updates: { id: string; title: string; content: string; createdAt: string }[];
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

export default function GrantsClient({
  funded,
  voting,
}: {
  funded: Proposal[];
  voting: Proposal[];
}) {
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
                Community Grants
              </p>
            </motion.div>

            <div className="overflow-hidden">
              {['FUND', 'VENEZUELAN', 'BUSINESSES'].map((word, i) => (
                <motion.div
                  key={word}
                  initial={{ opacity: 0, y: 80 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 * i, duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <h1 className="text-[12vw] md:text-[8vw] font-black uppercase tracking-tighter leading-[0.85]">
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
              Stake MVGA to vote on proposals. 100% transparent and on-chain. Every dollar is
              tracked.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75, duration: 0.5 }}
              className="mt-10"
            >
              <Link
                href="https://app.mvga.io/grants/create"
                target="_blank"
                className="bg-white text-black font-bold text-sm uppercase tracking-wider px-8 py-4 hover:bg-transparent hover:text-white border border-white transition-all inline-block"
              >
                Submit a Proposal
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ── HOW IT WORKS ───────────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              Process
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-16">How It Works</h2>

            <motion.div
              className="grid md:grid-cols-4 gap-px bg-white/10"
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {[
                {
                  num: '01',
                  title: 'Apply',
                  desc: 'Venezuelan business owners submit proposals with a description and funding amount.',
                },
                {
                  num: '02',
                  title: 'Vote',
                  desc: 'MVGA stakers vote on proposals. Your vote weight equals your staked amount.',
                },
                {
                  num: '03',
                  title: 'Fund',
                  desc: 'Approved proposals receive on-chain funding from the community treasury.',
                },
                {
                  num: '04',
                  title: 'Update',
                  desc: 'Funded businesses post progress updates. Full accountability, on-chain.',
                },
              ].map((step, i) => (
                <motion.div
                  key={step.num}
                  custom={i}
                  variants={fadeUp}
                  className="bg-black p-8 hover:bg-white/[0.02] transition"
                >
                  <span className="font-mono text-sm text-gold-500 mb-4 block">{step.num}</span>
                  <h3 className="text-xl font-bold mb-3 uppercase">{step.title}</h3>
                  <p className="text-white/40 leading-relaxed text-sm">{step.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── OPEN FOR VOTING ────────────────────────────────────── */}
        {voting.length > 0 && (
          <section className="py-24 md:py-32 px-6 border-t border-white/10">
            <div className="max-w-7xl mx-auto">
              <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
                Active Proposals
              </p>
              <h2 className="text-3xl md:text-5xl font-bold mb-16">Open for Voting</h2>

              <div className="grid md:grid-cols-2 gap-px bg-white/10">
                {voting.map((p, i) => {
                  const total = p.votesFor + p.votesAgainst;
                  const pct = total > 0 ? (p.votesFor / total) * 100 : 50;
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-black p-8"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-bold">{p.businessName}</h3>
                          <p className="text-sm text-white/30 font-mono">{p.businessLocation}</p>
                        </div>
                        <span className="text-xs font-mono text-gold-500 border border-gold-500/30 px-2 py-1 uppercase">
                          Voting
                        </span>
                      </div>
                      <p className="text-sm text-white/40 line-clamp-3 mb-6">{p.description}</p>
                      <div className="flex items-center justify-between text-sm mb-3">
                        <span className="font-mono font-bold">
                          ${p.requestedAmount.toLocaleString()}
                        </span>
                        <span className="text-white/30 font-mono text-xs">
                          {p.votesFor} for / {p.votesAgainst} against
                        </span>
                      </div>
                      <div className="w-full h-1 bg-white/5 mb-6">
                        <div className="h-full bg-gold-500" style={{ width: `${pct}%` }} />
                      </div>
                      <Link
                        href={`https://app.mvga.io/grants/${p.id}`}
                        target="_blank"
                        className="text-sm text-white/30 hover:text-white transition animated-underline"
                      >
                        Vote in App
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── FUNDED BUSINESSES ──────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              Impact
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Funded Businesses</h2>
            <p className="text-white/40 mb-16">
              Every grant is on-chain. Click the transaction to verify on Solscan.
            </p>

            {funded.length === 0 ? (
              <div className="border border-white/10 p-12 text-center">
                <p className="text-white/40 text-lg mb-2">No funded proposals yet</p>
                <p className="text-white/20 text-sm">
                  Be the first to submit a proposal and get funded by the MVGA community.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {funded.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="py-10"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                      <div>
                        <h3 className="text-2xl font-bold">{p.businessName}</h3>
                        <p className="text-sm text-white/30 font-mono">{p.businessLocation}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold text-xl">
                          ${p.requestedAmount.toLocaleString()}
                        </span>
                        <span className="text-xs font-mono text-gold-500 border border-gold-500/30 px-2 py-1 uppercase">
                          Funded
                        </span>
                      </div>
                    </div>

                    <p className="text-white/40 mb-6 max-w-3xl">{p.description}</p>

                    <div className="flex flex-wrap gap-6 text-sm">
                      {p.fundedAt && (
                        <span className="text-white/20 font-mono">
                          {new Date(p.fundedAt).toLocaleDateString()}
                        </span>
                      )}
                      {p.fundingTx && (
                        <a
                          href={`https://solscan.io/tx/${p.fundingTx}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gold-500 hover:text-white transition animated-underline"
                        >
                          Verify on Solscan
                        </a>
                      )}
                      <span className="text-white/20 font-mono">
                        {p.totalVotes} votes ({p.votesFor} for, {p.votesAgainst} against)
                      </span>
                    </div>

                    {p.updates && p.updates.length > 0 && (
                      <div className="mt-8 border-l border-white/10 pl-6">
                        <h4 className="text-xs tracking-[0.3em] uppercase text-white/30 font-mono mb-4">
                          Progress Updates
                        </h4>
                        <div className="space-y-4">
                          {p.updates.map((u) => (
                            <div key={u.id}>
                              <p className="text-sm font-bold">{u.title}</p>
                              <p className="text-sm text-white/40 mt-1">{u.content}</p>
                              <p className="text-xs text-white/20 font-mono mt-2">
                                {new Date(u.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
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
              Want to Get Funded?
            </motion.h2>
            <p className="text-xl text-white/40 mb-10">
              If you run a small business in Venezuela, submit a proposal. The MVGA community votes
              on which businesses to fund.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="https://app.mvga.io/grants/create"
                target="_blank"
                className="bg-white text-black font-bold text-sm uppercase tracking-wider px-8 py-4 hover:bg-transparent hover:text-white border border-white transition-all"
              >
                Submit Proposal
              </Link>
              <Link
                href="https://app.mvga.io/grants"
                target="_blank"
                className="border border-white/30 text-white font-bold text-sm uppercase tracking-wider px-8 py-4 hover:border-white transition-all"
              >
                View All Proposals
              </Link>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </GridBackground>
  );
}
