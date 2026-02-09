import { unstable_noStore as noStore } from 'next/cache';
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

async function safeFetch(url: string): Promise<Proposal[]> {
  noStore();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    clearTimeout(timer);
    return [];
  }
}

export const metadata = {
  title: 'Grants - MVGA',
  description:
    'Community-funded micro-grants for Venezuelan small businesses. Vote with your staked MVGA tokens.',
};

export default async function GrantsPage() {
  const [funded, voting] = await Promise.all([
    safeFetch(`${API_BASE}/grants/proposals?status=FUNDED`),
    safeFetch(`${API_BASE}/grants/proposals?status=VOTING`),
  ]);
  return <GrantsClient funded={funded} voting={voting} />;
}
