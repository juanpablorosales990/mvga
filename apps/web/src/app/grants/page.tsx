import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.mvga.io/api';

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

async function getProposals(): Promise<Proposal[]> {
  try {
    const res = await fetch(`${API_URL}/grants/proposals?status=FUNDED`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getVotingProposals(): Promise<Proposal[]> {
  try {
    const res = await fetch(`${API_URL}/grants/proposals?status=VOTING`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export const metadata = {
  title: 'Grants - MVGA',
  description:
    'Community-funded micro-grants for Venezuelan small businesses. Vote with your staked MVGA tokens.',
};

export default async function GrantsPage() {
  const [funded, voting] = await Promise.all([getProposals(), getVotingProposals()]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-display font-bold gradient-text">MVGA</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-gray-300 hover:text-white transition">
              Home
            </Link>
            <Link href="/grants" className="text-white font-medium">
              Grants
            </Link>
          </div>
          <Link
            href="https://app.mvga.io"
            className="bg-primary-500 hover:bg-primary-600 text-black font-semibold px-6 py-2 rounded-full transition"
          >
            Launch App
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-4">
            <span className="gradient-text">Community Grants</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
            Fund Venezuelan small businesses. Stake MVGA to vote on proposals. 100% transparent and
            on-chain.
          </p>
          <Link
            href="https://app.mvga.io/grants/create"
            className="inline-block bg-primary-500 hover:bg-primary-600 text-black font-semibold px-8 py-3 rounded-full transition"
          >
            Submit a Proposal
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-6 bg-black/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-center mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: '1',
                title: 'Apply',
                desc: 'Venezuelan business owners submit proposals with a description and funding amount.',
              },
              {
                step: '2',
                title: 'Vote',
                desc: 'MVGA stakers vote on proposals. Your vote weight equals your staked amount.',
              },
              {
                step: '3',
                title: 'Fund',
                desc: 'Approved proposals receive on-chain funding from the community treasury.',
              },
              {
                step: '4',
                title: 'Update',
                desc: 'Funded businesses post progress updates. Full accountability, on-chain.',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center text-black font-bold text-lg mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Voting Now */}
      {voting.length > 0 && (
        <section className="py-16 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-8">Open for Voting</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {voting.map((p) => (
                <div key={p.id} className="glass rounded-2xl p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold">{p.businessName}</h3>
                      <p className="text-sm text-gray-500">{p.businessLocation}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">
                      VOTING
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 line-clamp-3 mb-4">{p.description}</p>
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-primary-500 font-medium">
                      ${p.requestedAmount.toLocaleString()}
                    </span>
                    <span className="text-gray-500">
                      {p.votesFor} for / {p.votesAgainst} against
                    </span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{
                        width: `${
                          p.votesFor + p.votesAgainst > 0
                            ? (p.votesFor / (p.votesFor + p.votesAgainst)) * 100
                            : 50
                        }%`,
                      }}
                    />
                  </div>
                  <Link
                    href={`https://app.mvga.io/grants/${p.id}`}
                    className="text-primary-500 text-sm font-medium hover:underline"
                  >
                    Vote in App &rarr;
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Funded Businesses */}
      <section className="py-16 px-6 bg-black/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-2">Funded Businesses</h2>
          <p className="text-gray-400 mb-8">
            Every grant is on-chain. Click the transaction to verify on Solscan.
          </p>

          {funded.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <p className="text-gray-400 text-lg mb-2">No funded proposals yet</p>
              <p className="text-gray-500">
                Be the first to submit a proposal and get funded by the MVGA community.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {funded.map((p) => (
                <div key={p.id} className="glass rounded-2xl p-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-xl font-semibold">{p.businessName}</h3>
                      <p className="text-sm text-gray-500">{p.businessLocation}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-primary-500 font-bold text-lg">
                        ${p.requestedAmount.toLocaleString()}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-primary-500/20 text-primary-400">
                        FUNDED
                      </span>
                    </div>
                  </div>

                  <p className="text-gray-400 mb-4">{p.description}</p>

                  <div className="flex flex-wrap gap-4 text-sm">
                    {p.fundedAt && (
                      <span className="text-gray-500">
                        Funded {new Date(p.fundedAt).toLocaleDateString()}
                      </span>
                    )}
                    {p.fundingTx && (
                      <a
                        href={`https://solscan.io/tx/${p.fundingTx}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-400 hover:underline"
                      >
                        View Transaction on Solscan
                      </a>
                    )}
                    <span className="text-gray-500">
                      {p.totalVotes} votes ({p.votesFor} for, {p.votesAgainst} against)
                    </span>
                  </div>

                  {/* Updates timeline */}
                  {p.updates && p.updates.length > 0 && (
                    <div className="mt-6 border-t border-white/10 pt-4">
                      <h4 className="text-sm font-semibold text-gray-300 mb-3">Progress Updates</h4>
                      <div className="space-y-3">
                        {p.updates.map((u) => (
                          <div key={u.id} className="pl-4 border-l-2 border-primary-500/30">
                            <p className="text-sm font-medium">{u.title}</p>
                            <p className="text-sm text-gray-400">{u.content}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">Want to get funded?</h2>
          <p className="text-gray-400 mb-8">
            If you run a small business in Venezuela, submit a proposal. The MVGA community votes on
            which businesses to fund.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="https://app.mvga.io/grants/create"
              className="bg-primary-500 hover:bg-primary-600 text-black font-semibold px-8 py-3 rounded-full transition"
            >
              Submit Proposal
            </Link>
            <Link
              href="https://app.mvga.io/grants"
              className="border border-white/30 hover:bg-white/10 text-white font-semibold px-8 py-3 rounded-full transition"
            >
              View All Proposals
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xl font-display font-bold gradient-text">MVGA</span>
            <span className="text-gray-500">|</span>
            <span className="text-gray-400">Patria y Vida</span>
          </div>
          <div className="text-gray-500 text-sm">
            100% Open Source. Built with love for Venezuela.
          </div>
        </div>
      </footer>
    </main>
  );
}
