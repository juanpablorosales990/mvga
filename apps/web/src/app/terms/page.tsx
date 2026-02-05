import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service - MVGA',
  description: 'MVGA terms of service: usage rules, responsibilities, and disclaimers.',
};

export default function TermsPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <Link href="/" className="text-primary-500 hover:underline text-sm mb-8 inline-block">
          &larr; Back to Home
        </Link>

        <h1 className="text-4xl font-display font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-500 mb-10">Last updated: February 2026</p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By connecting your wallet and using MVGA, you agree to these terms. If you do not
              agree, do not use the platform. MVGA is open-source software provided as-is.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
            <p>
              MVGA provides a non-custodial wallet interface, peer-to-peer exchange, token staking,
              and community grant voting on the Solana blockchain. We do not hold custody of your
              funds at any time except during active P2P escrow periods.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. User Responsibilities</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You are responsible for securing your wallet and private keys</li>
              <li>You must comply with applicable laws in your jurisdiction</li>
              <li>
                You must not use the platform for money laundering, fraud, or terrorism financing
              </li>
              <li>You are responsible for all transactions initiated from your wallet</li>
              <li>P2P trade disputes must be conducted in good faith</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Risks</h2>
            <p>
              Cryptocurrency involves significant risks including but not limited to: price
              volatility, smart contract bugs, network congestion, regulatory changes, and loss of
              private keys. Staking rewards are not guaranteed. MVGA token value may fluctuate
              significantly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. No Warranty</h2>
            <p>
              MVGA is provided &quot;as is&quot; without warranty of any kind. We do not guarantee
              uptime, accuracy, or completeness of information. Smart contracts may contain bugs.
              Use at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, MVGA and its contributors shall not be liable
              for any indirect, incidental, special, or consequential damages arising from your use
              of the platform, including but not limited to loss of funds, data, or profits.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. P2P Exchange Terms</h2>
            <p>
              MVGA facilitates peer-to-peer trades but is not a party to any transaction. Escrow
              services are provided to reduce counterparty risk. Disputes are resolved through our
              dispute resolution process. MVGA reserves the right to release or refund escrowed
              funds based on available evidence.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Modifications</h2>
            <p>
              We may update these terms at any time. Continued use after changes constitutes
              acceptance. Material changes will be communicated through the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Contact</h2>
            <p>
              For questions about these terms, reach us on{' '}
              <Link href="https://twitter.com/mvga" className="text-primary-500 hover:underline">
                X (Twitter)
              </Link>{' '}
              or open an issue on our{' '}
              <Link
                href="https://github.com/juanrosales/mvga"
                className="text-primary-500 hover:underline"
              >
                GitHub repository
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
