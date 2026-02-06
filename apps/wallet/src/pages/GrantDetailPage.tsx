import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { API_URL } from '../config';

interface ProposalDetail {
  id: string;
  businessName: string;
  businessLocation: string;
  description: string;
  requestedAmount: number;
  videoUrl: string | null;
  applicantAddress: string;
  status: string;
  votesFor: number;
  votesAgainst: number;
  totalVotes: number;
  votingEndsAt: string;
  fundedAt: string | null;
  fundingTx: string | null;
  createdAt: string;
  votes: { voterAddress: string; direction: string; weight: number; createdAt: string }[];
  updates: { id: string; title: string; content: string; createdAt: string }[];
}

export default function GrantDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const { authToken } = useAuth();

  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    fetch(`${API_URL}/grants/proposals/${id}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then(setProposal)
      .catch((err) => {
        if (err.name !== 'AbortError') {
          /* ignore */
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  const handleVote = async (direction: 'FOR' | 'AGAINST') => {
    if (!publicKey || !proposal) return;
    setVoting(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/grants/proposals/${proposal.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ voterAddress: publicKey.toBase58(), direction }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Vote failed');
      }
      // Refresh proposal
      const updated = await fetch(`${API_URL}/grants/proposals/${proposal.id}`);
      if (updated.ok) setProposal(await updated.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vote failed');
    } finally {
      setVoting(false);
    }
  };

  const hasVoted = proposal?.votes.some((v) => v.voterAddress === publicKey?.toBase58());

  if (loading) {
    return <div className="card animate-pulse h-64" />;
  }

  if (!proposal) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p>{t('grants.proposalNotFound')}</p>
        <button onClick={() => navigate('/grants')} className="text-primary-500 mt-2">
          {t('grants.backToGrants')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/grants')} className="text-gray-400 text-sm">
        ← {t('grants.backToGrants')}
      </button>

      <div className="card space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{proposal.businessName}</h1>
          <p className="text-sm text-gray-500">{proposal.businessLocation}</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <span className="text-xs px-2 py-1 rounded-full bg-white/10">
            ${proposal.requestedAmount.toLocaleString()} requested
          </span>
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              proposal.status === 'VOTING'
                ? 'bg-blue-500/20 text-blue-400'
                : proposal.status === 'FUNDED'
                  ? 'bg-primary-500/20 text-primary-400'
                  : 'bg-gray-500/20 text-gray-400'
            }`}
          >
            {proposal.status}
          </span>
        </div>

        <p className="text-gray-300 whitespace-pre-wrap">{proposal.description}</p>

        {proposal.videoUrl && (
          <a
            href={proposal.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-500 text-sm underline"
          >
            {t('grants.watchVideo')}
          </a>
        )}

        {proposal.fundingTx && (
          <a
            href={`https://solscan.io/tx/${proposal.fundingTx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-400 text-sm underline"
          >
            {t('grants.viewFundingTx')}
          </a>
        )}
      </div>

      {/* Voting */}
      {proposal.status === 'VOTING' && (
        <div className="card space-y-3">
          <h2 className="font-semibold">{t('grants.vote')}</h2>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-green-400">{proposal.votesFor} For</span>
            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full"
                style={{
                  width: `${
                    proposal.votesFor + proposal.votesAgainst > 0
                      ? (proposal.votesFor / (proposal.votesFor + proposal.votesAgainst)) * 100
                      : 50
                  }%`,
                }}
              />
            </div>
            <span className="text-red-400">{proposal.votesAgainst} Against</span>
          </div>
          <p className="text-xs text-gray-500">
            Voting ends {new Date(proposal.votingEndsAt).toLocaleDateString()}
          </p>

          {!hasVoted && publicKey ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleVote('FOR')}
                disabled={voting}
                className="flex-1 py-2 rounded-xl font-medium bg-green-500 text-black disabled:opacity-50"
              >
                {voting ? '...' : t('grants.voteFor')}
              </button>
              <button
                onClick={() => handleVote('AGAINST')}
                disabled={voting}
                className="flex-1 py-2 rounded-xl font-medium bg-red-500 text-white disabled:opacity-50"
              >
                {voting ? '...' : t('grants.voteAgainst')}
              </button>
            </div>
          ) : hasVoted ? (
            <p className="text-sm text-gray-400 text-center">{t('grants.alreadyVoted')}</p>
          ) : (
            <p className="text-sm text-gray-400 text-center">{t('grants.connectToVote')}</p>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      )}

      {/* Updates */}
      {proposal.updates.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">{t('grants.updates')}</h2>
          {proposal.updates.map((u) => (
            <div key={u.id} className="card">
              <h3 className="font-medium">{u.title}</h3>
              <p className="text-sm text-gray-400 mt-1">{u.content}</p>
              <p className="text-xs text-gray-500 mt-2">
                {new Date(u.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Voters */}
      {proposal.votes.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-2">
            {t('grants.voters')} ({proposal.totalVotes})
          </h2>
          <div className="space-y-1">
            {proposal.votes.slice(0, 10).map((v, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="font-mono text-gray-400">
                  {v.voterAddress.slice(0, 6)}...{v.voterAddress.slice(-4)}
                </span>
                <span className={v.direction === 'FOR' ? 'text-green-400' : 'text-red-400'}>
                  {v.direction} ({v.weight.toLocaleString()} MVGA)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
