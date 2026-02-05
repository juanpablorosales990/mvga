import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

interface Proposal {
  id: string;
  businessName: string;
  businessLocation: string;
  description: string;
  requestedAmount: number;
  applicantAddress: string;
  status: string;
  votesFor: number;
  votesAgainst: number;
  totalVotes: number;
  votingEndsAt: string;
  fundedAt: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  VOTING: 'bg-blue-500/20 text-blue-400',
  APPROVED: 'bg-green-500/20 text-green-400',
  REJECTED: 'bg-red-500/20 text-red-400',
  FUNDED: 'bg-primary-500/20 text-primary-400',
  COMPLETED: 'bg-gray-500/20 text-gray-400',
};

export default function GrantsPage() {
  const { t } = useTranslation();
  const { publicKey } = useWallet();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'funded' | 'mine'>('active');

  useEffect(() => {
    setLoading(true);
    const statusFilter = tab === 'active' ? 'VOTING' : tab === 'funded' ? 'FUNDED' : '';
    const url = statusFilter
      ? `${API_URL}/grants/proposals?status=${statusFilter}`
      : `${API_URL}/grants/proposals`;

    fetch(url)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (tab === 'mine' && publicKey) {
          setProposals(data.filter((p: Proposal) => p.applicantAddress === publicKey.toBase58()));
        } else {
          setProposals(data);
        }
      })
      .catch(() => setProposals([]))
      .finally(() => setLoading(false));
  }, [tab, publicKey]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('grants.title')}</h1>
        <Link
          to="/grants/create"
          className="bg-primary-500 text-black px-4 py-2 rounded-lg font-medium text-sm"
        >
          {t('grants.propose')}
        </Link>
      </div>

      <p className="text-sm text-gray-400">{t('grants.subtitle')}</p>

      {/* Tabs */}
      <div className="flex bg-white/5 rounded-xl p-1">
        {(['active', 'funded', 'mine'] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`flex-1 py-2 rounded-lg font-medium text-sm transition ${
              tab === tabKey ? 'bg-primary-500 text-black' : 'text-gray-400'
            }`}
          >
            {tabKey === 'active'
              ? t('grants.voting')
              : tabKey === 'funded'
                ? t('grants.funded')
                : t('grants.myProposals')}
          </button>
        ))}
      </div>

      {/* Proposals */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse h-32" />
          ))}
        </div>
      ) : proposals.length === 0 ? (
        <div className="card text-center py-8 text-gray-400">
          <p>{t('grants.noProposals')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((p) => (
            <Link
              key={p.id}
              to={`/grants/${p.id}`}
              className="card block hover:bg-white/10 transition"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold">{p.businessName}</h3>
                  <p className="text-xs text-gray-500">{p.businessLocation}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[p.status] || ''}`}>
                  {p.status}
                </span>
              </div>
              <p className="text-sm text-gray-400 line-clamp-2 mb-3">{p.description}</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">
                  ${p.requestedAmount.toLocaleString()} requested
                </span>
                <span className="text-gray-500">
                  {p.votesFor} for / {p.votesAgainst} against
                </span>
              </div>
              {p.status === 'VOTING' && (
                <div className="mt-2">
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full"
                      style={{
                        width: `${
                          p.votesFor + p.votesAgainst > 0
                            ? (p.votesFor / (p.votesFor + p.votesAgainst)) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Voting ends {new Date(p.votingEndsAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
