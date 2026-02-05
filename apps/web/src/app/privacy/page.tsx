import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy - MVGA',
  description: 'MVGA privacy policy: how we collect, use, and protect your data.',
};

export default function PrivacyPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <Link href="/" className="text-primary-500 hover:underline text-sm mb-8 inline-block">
          &larr; Back to Home
        </Link>

        <h1 className="text-4xl font-display font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-10">Last updated: February 2026</p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
            <p>
              MVGA collects minimal data necessary to operate the platform. When you connect your
              wallet, we store your public wallet address. We do not collect names, emails, phone
              numbers, or government IDs unless you voluntarily provide them in grant proposals.
            </p>
            <p className="mt-2">
              <strong className="text-white">On-chain data:</strong> All Solana transactions are
              public. We index relevant transactions (staking, P2P trades, grant funding) for
              display within the app.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Authenticate your wallet session</li>
              <li>Display your staking positions, trade history, and referral stats</li>
              <li>Calculate staking rewards and tier status</li>
              <li>Process P2P trades and escrow operations</li>
              <li>Prevent fraud and abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Data Sharing</h2>
            <p>
              We do not sell your data. We may share anonymized, aggregated statistics publicly
              (e.g., total staked, number of users). P2P trade counterparties can see your wallet
              address and reputation score.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Data Security</h2>
            <p>
              We use industry-standard security practices including encrypted connections (HTTPS),
              secure authentication (wallet signature verification), and rate limiting. Your private
              keys never leave your device.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Your Rights</h2>
            <p>
              You can disconnect your wallet at any time. On-chain data cannot be deleted as it is
              part of the Solana blockchain. Off-chain data (reputation scores, trade records) can
              be requested for deletion by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Cookies</h2>
            <p>
              We use essential cookies and local storage for session management and user
              preferences. We do not use third-party tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Contact</h2>
            <p>
              For privacy questions or data deletion requests, reach us on{' '}
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
