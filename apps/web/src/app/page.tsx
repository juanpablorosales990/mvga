import Link from 'next/link';

export default function Home() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white"
    >
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-display font-bold gradient-text">MVGA</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <Link href="#mission" className="text-gray-300 hover:text-white transition">
              Mission
            </Link>
            <Link href="#features" className="text-gray-300 hover:text-white transition">
              Features
            </Link>
            <Link href="#transparency" className="text-gray-300 hover:text-white transition">
              Transparency
            </Link>
            <Link href="#tokenomics" className="text-gray-300 hover:text-white transition">
              Tokenomics
            </Link>
            <Link href="/grants" className="text-gray-300 hover:text-white transition">
              Grants
            </Link>
          </div>
          <Link
            href="https://app.mvga.io"
            target="_blank"
            className="bg-primary-500 hover:bg-primary-600 text-black font-semibold px-6 py-2 rounded-full transition"
          >
            Launch App
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-sm text-gray-300">Open Source &bull; Community Owned</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-display font-bold mb-6">
            <span className="gradient-text">Make Venezuela</span>
            <br />
            <span className="text-white">Great Again</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-10">
            Venezuela&apos;s open-source financial infrastructure. Send money to family, hold stable
            value, support small businesses. No middlemen. No corruption.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="https://app.mvga.io"
              target="_blank"
              className="bg-primary-500 hover:bg-primary-600 text-black font-semibold px-8 py-4 rounded-full text-lg transition"
            >
              Open Wallet
            </Link>
            <Link
              href="#transparency"
              className="border border-white/30 hover:bg-white/10 text-white font-semibold px-8 py-4 rounded-full text-lg transition"
            >
              View All Wallets
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20 max-w-4xl mx-auto">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary-500">$0</div>
              <div className="text-gray-500">Total Volume</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-secondary-500">0</div>
              <div className="text-gray-500">Users</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-accent-500">0</div>
              <div className="text-gray-500">Businesses Funded</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-green-500">100%</div>
              <div className="text-gray-500">Open Source</div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section id="mission" className="py-20 px-6 bg-black/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-display font-bold text-center mb-4">
            Our Mission
          </h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-16">
            We believe every Venezuelan deserves access to stable money, regardless of where they
            live.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="glass rounded-2xl p-8">
              <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">💸</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Zero Fee Remittances</h3>
              <p className="text-gray-400">
                Send money to Venezuela without losing 15% to middlemen. P2P exchange directly with
                other users.
              </p>
            </div>

            <div className="glass rounded-2xl p-8">
              <div className="w-12 h-12 bg-secondary-500/20 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">🏪</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Support Local Business</h3>
              <p className="text-gray-400">
                Vote on micro-grants for Venezuelan entrepreneurs. Help rebuild the economy from the
                ground up.
              </p>
            </div>

            <div className="glass rounded-2xl p-8">
              <div className="w-12 h-12 bg-accent-500/20 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">🔓</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">100% Open Source</h3>
              <p className="text-gray-400">
                Every line of code is public. Every wallet is visible. No hidden agendas. No regime
                ties.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-display font-bold text-center mb-4">
            What We&apos;re Building
          </h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-16">
            A complete financial ecosystem for Venezuelans, wherever they are.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="glass rounded-2xl p-8 hover:bg-white/5 transition">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center text-black font-bold">
                  1
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">MVGA Wallet</h3>
                  <p className="text-gray-400">
                    Hold USDC, MVGA, and SOL. Send to anyone instantly. View your balance in USD.
                    Works on any phone.
                  </p>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-8 hover:bg-white/5 transition">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-secondary-500 rounded-lg flex items-center justify-center text-white font-bold">
                  2
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">P2P Exchange</h3>
                  <p className="text-gray-400">
                    Trade crypto for Zelle, PayPal, or bank transfer. Smart contract escrow protects
                    both parties.
                  </p>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-8 hover:bg-white/5 transition">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-accent-500 rounded-lg flex items-center justify-center text-white font-bold">
                  3
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Staking & Rewards</h3>
                  <p className="text-gray-400">
                    Stake MVGA to earn protocol fees. Higher tiers unlock lower fees and governance
                    voting rights.
                  </p>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-8 hover:bg-white/5 transition">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold">
                  4
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Business Grants</h3>
                  <p className="text-gray-400">
                    Community-funded micro-grants for Venezuelan small businesses. You vote on who
                    gets funded.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Transparency Section */}
      <section id="transparency" className="py-20 px-6 bg-black/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-display font-bold text-center mb-4">
            Full Transparency
          </h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-16">
            Every wallet is public. Every transaction is on-chain. Verify, don&apos;t trust.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: 'Treasury', address: 'H9j1W4u5LEiw8AZdui6c8AmN6t4tKkPQCAULPW8eMiTE' },
              {
                name: 'Humanitarian Fund',
                address: '82XeVLtfjniaE6qvrDiY7UaCHvkimyhVximvRDdQsdqS',
              },
              { name: 'Staking Vault', address: 'GNhLCjqThNJAJAdDYvRTr2EfWyGXAFUymaPuKaL1duEh' },
              { name: 'Team Vesting', address: '8m8L2CGoneYwP3xEYyss5sjbj7GKy7cK3YxDcG2yNbH4' },
              { name: 'Marketing', address: 'DA5VQFLsx87hNQqL2EsM36oVhGnzM2CnqPSe6E9RFpeo' },
              { name: 'Advisors', address: 'Huq3ea9KKf6HFb5Qiacdx2pJDSM4c881WdyMCBHXq4hF' },
            ].map((wallet) => (
              <div key={wallet.name} className="glass rounded-xl p-6">
                <div className="mb-4">
                  <span className="text-gray-400">{wallet.name}</span>
                </div>
                <a
                  href={`https://solscan.io/account/${wallet.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-500 hover:text-primary-500 break-all transition"
                >
                  {wallet.address}
                </a>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="https://github.com/juanpablorosales990/mvga"
              target="_blank"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              View Source Code on GitHub
            </Link>
          </div>
        </div>
      </section>

      {/* Tokenomics Section */}
      <section id="tokenomics" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-display font-bold text-center mb-4">
            Tokenomics
          </h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-16">
            Fair launch. Long vesting. Community first.
          </p>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="space-y-4">
                {[
                  { label: 'Community & Liquidity', pct: 40, color: 'bg-primary-500' },
                  { label: 'Team (2yr vest)', pct: 20, color: 'bg-secondary-500' },
                  { label: 'Humanitarian Fund', pct: 15, color: 'bg-green-500' },
                  { label: 'Startup Ecosystem', pct: 10, color: 'bg-purple-500' },
                  { label: 'Marketing', pct: 10, color: 'bg-pink-500' },
                  { label: 'Advisors', pct: 5, color: 'bg-gray-500' },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-300">{item.label}</span>
                      <span className="text-gray-400">{item.pct}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-3">
                      <div
                        className={`${item.color} h-3 rounded-full`}
                        style={{ width: `${item.pct}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-2xl p-8">
              <h3 className="text-xl font-semibold mb-6">Token Details</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-400">Name</span>
                  <span>Make Venezuela Great Again</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Symbol</span>
                  <span>MVGA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Network</span>
                  <span>Solana</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Supply</span>
                  <span>1,000,000,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Buy/Sell Tax</span>
                  <span>3% each</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">LP Lock</span>
                  <span>3 years</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-primary-500/20 via-secondary-500/20 to-accent-500/20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">Join the Movement</h2>
          <p className="text-xl text-gray-300 mb-10">
            Be part of Venezuela&apos;s financial revolution. Community-owned. Open source.
            Transparent.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="https://t.me/mvga"
              target="_blank"
              className="bg-white text-black font-semibold px-8 py-4 rounded-full text-lg hover:bg-gray-200 transition"
            >
              Join Telegram
            </Link>
            <Link
              href="https://twitter.com/mvga"
              target="_blank"
              className="border border-white/30 hover:bg-white/10 text-white font-semibold px-8 py-4 rounded-full text-lg transition"
            >
              Follow on X
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xl font-display font-bold gradient-text">MVGA</span>
              <span className="text-gray-500">|</span>
              <span className="text-gray-400">Patria y Vida</span>
            </div>
            <div className="flex items-center gap-4 text-gray-500 text-sm">
              <span>100% Open Source. Built with love for Venezuela.</span>
              <span className="text-gray-700">|</span>
              <Link href="/privacy" className="hover:text-gray-300 transition">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-gray-300 transition">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
