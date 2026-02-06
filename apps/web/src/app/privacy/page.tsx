import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import GridBackground from '@/components/GridBackground';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy - MVGA',
  description: 'MVGA privacy policy: how we collect, use, and protect your data.',
};

const sections = [
  {
    num: '01',
    title: 'Information We Collect',
    content: (
      <>
        <p>
          MVGA collects minimal data necessary to operate the platform. When you connect your
          wallet, we store your public wallet address. We do not collect names, emails, phone
          numbers, or government IDs unless you voluntarily provide them in grant proposals.
        </p>
        <p className="mt-4">
          <strong className="text-white">On-chain data:</strong> All Solana transactions are public.
          We index relevant transactions (staking, P2P trades, grant funding) for display within the
          app.
        </p>
      </>
    ),
  },
  {
    num: '02',
    title: 'How We Use Your Data',
    content: (
      <ul className="space-y-2">
        <li className="flex items-start gap-3">
          <span className="text-gold-500 mt-1 shrink-0">/</span>
          <span>Authenticate your wallet session</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-gold-500 mt-1 shrink-0">/</span>
          <span>Display your staking positions, trade history, and referral stats</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-gold-500 mt-1 shrink-0">/</span>
          <span>Calculate staking rewards and tier status</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-gold-500 mt-1 shrink-0">/</span>
          <span>Process P2P trades and escrow operations</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-gold-500 mt-1 shrink-0">/</span>
          <span>Prevent fraud and abuse</span>
        </li>
      </ul>
    ),
  },
  {
    num: '03',
    title: 'Data Sharing',
    content: (
      <p>
        We do not sell your data. We may share anonymized, aggregated statistics publicly (e.g.,
        total staked, number of users). P2P trade counterparties can see your wallet address and
        reputation score.
      </p>
    ),
  },
  {
    num: '04',
    title: 'Data Security',
    content: (
      <p>
        We use industry-standard security practices including encrypted connections (HTTPS), secure
        authentication (wallet signature verification), and rate limiting. Your private keys never
        leave your device.
      </p>
    ),
  },
  {
    num: '05',
    title: 'Your Rights',
    content: (
      <p>
        You can disconnect your wallet at any time. On-chain data cannot be deleted as it is part of
        the Solana blockchain. Off-chain data (reputation scores, trade records) can be requested
        for deletion by contacting us.
      </p>
    ),
  },
  {
    num: '06',
    title: 'Cookies',
    content: (
      <p>
        We use essential cookies and local storage for session management and user preferences. We
        do not use third-party tracking cookies.
      </p>
    ),
  },
  {
    num: '07',
    title: 'Contact',
    content: (
      <p>
        For privacy questions or data deletion requests, reach us on{' '}
        <Link
          href="https://twitter.com/mvga"
          target="_blank"
          className="text-gold-500 hover:text-white transition animated-underline"
        >
          X (Twitter)
        </Link>{' '}
        or open an issue on our{' '}
        <Link
          href="https://github.com/juanpablorosales990/mvga"
          target="_blank"
          className="text-gold-500 hover:text-white transition animated-underline"
        >
          GitHub repository
        </Link>
        .
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <GridBackground>
      <main id="main-content" className="min-h-screen bg-black text-white">
        <Nav />

        <section className="pt-32 md:pt-40 pb-20 px-6">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">Legal</p>
            <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-4">
              Privacy Policy
            </h1>
            <p className="text-white/20 font-mono text-sm">Last updated: February 2026</p>
          </div>
        </section>

        <section className="pb-24 px-6">
          <div className="max-w-4xl mx-auto divide-y divide-white/10">
            {sections.map((section) => (
              <div key={section.num} className="py-10">
                <div className="flex items-baseline gap-4 mb-4">
                  <span className="font-mono text-sm text-gold-500">{section.num}</span>
                  <h2 className="text-xl font-bold uppercase tracking-wide">{section.title}</h2>
                </div>
                <div className="text-white/40 leading-relaxed pl-10">{section.content}</div>
              </div>
            ))}
          </div>
        </section>

        <Footer />
      </main>
    </GridBackground>
  );
}
