import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import GridBackground from '@/components/GridBackground';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service - MVGA',
  description: 'MVGA terms of service: usage rules, responsibilities, and disclaimers.',
};

const sections = [
  {
    num: '01',
    title: 'Acceptance of Terms',
    content: (
      <p>
        By connecting your wallet and using MVGA, you agree to these terms. If you do not agree, do
        not use the platform. MVGA is open-source software provided as-is.
      </p>
    ),
  },
  {
    num: '02',
    title: 'Description of Service',
    content: (
      <p>
        MVGA provides a non-custodial wallet interface, peer-to-peer exchange, token staking, and
        community grant voting on the Solana blockchain. We do not hold custody of your funds at any
        time except during active P2P escrow periods.
      </p>
    ),
  },
  {
    num: '03',
    title: 'User Responsibilities',
    content: (
      <ul className="space-y-2">
        <li className="flex items-start gap-3">
          <span className="text-gold-500 mt-1 shrink-0">/</span>
          <span>You are responsible for securing your wallet and private keys</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-gold-500 mt-1 shrink-0">/</span>
          <span>You must comply with applicable laws in your jurisdiction</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-gold-500 mt-1 shrink-0">/</span>
          <span>
            You must not use the platform for money laundering, fraud, or terrorism financing
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-gold-500 mt-1 shrink-0">/</span>
          <span>You are responsible for all transactions initiated from your wallet</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-gold-500 mt-1 shrink-0">/</span>
          <span>P2P trade disputes must be conducted in good faith</span>
        </li>
      </ul>
    ),
  },
  {
    num: '04',
    title: 'Risks',
    content: (
      <p>
        Cryptocurrency involves significant risks including but not limited to: price volatility,
        smart contract bugs, network congestion, regulatory changes, and loss of private keys.
        Staking rewards are not guaranteed. MVGA token value may fluctuate significantly.
      </p>
    ),
  },
  {
    num: '05',
    title: 'No Warranty',
    content: (
      <p>
        MVGA is provided &quot;as is&quot; without warranty of any kind. We do not guarantee uptime,
        accuracy, or completeness of information. Smart contracts may contain bugs. Use at your own
        risk.
      </p>
    ),
  },
  {
    num: '06',
    title: 'Limitation of Liability',
    content: (
      <p>
        To the maximum extent permitted by law, MVGA and its contributors shall not be liable for
        any indirect, incidental, special, or consequential damages arising from your use of the
        platform, including but not limited to loss of funds, data, or profits.
      </p>
    ),
  },
  {
    num: '07',
    title: 'P2P Exchange Terms',
    content: (
      <p>
        MVGA facilitates peer-to-peer trades but is not a party to any transaction. Escrow services
        are provided to reduce counterparty risk. Disputes are resolved through our dispute
        resolution process. MVGA reserves the right to release or refund escrowed funds based on
        available evidence.
      </p>
    ),
  },
  {
    num: '08',
    title: 'Modifications',
    content: (
      <p>
        We may update these terms at any time. Continued use after changes constitutes acceptance.
        Material changes will be communicated through the platform.
      </p>
    ),
  },
  {
    num: '09',
    title: 'Contact',
    content: (
      <p>
        For questions about these terms, reach us on{' '}
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

export default function TermsPage() {
  return (
    <GridBackground>
      <main id="main-content" className="min-h-screen bg-black text-white">
        <Nav />

        <section className="pt-32 md:pt-40 pb-20 px-6">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">Legal</p>
            <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-4">
              Terms of Service
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
