import { API_BASE } from '@/lib/utils';
import GrantsClient from './grants-client';

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
    const res = await fetch(`${API_BASE}/grants/proposals?status=FUNDED`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getVotingProposals(): Promise<Proposal[]> {
  try {
    const res = await fetch(`${API_BASE}/grants/proposals?status=VOTING`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5000),
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
  return <GrantsClient funded={funded} voting={voting} />;
}
