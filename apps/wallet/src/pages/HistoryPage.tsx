import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

interface OnChainTx {
  signature: string;
  timestamp: number;
  type: string;
  amount?: number;
  token?: string;
}

interface LogEntry {
  id: string;
  type: string;
  signature: string;
  amount: number;
  token: string;
  status: string;
  createdAt: string;
}

interface HistoryItem {
  signature: string;
  timestamp: number;
  type: string;
  amount?: number;
  token?: string;
  status?: string;
  source: 'chain' | 'log';
}

const TYPE_LABELS: Record<string, string> = {
  transfer: 'Transfer',
  STAKE: 'Stake',
  UNSTAKE: 'Unstake',
  P2P_ESCROW_LOCK: 'Escrow Lock',
  P2P_ESCROW_RELEASE: 'Escrow Release',
  P2P_ESCROW_REFUND: 'Escrow Refund',
};

const TYPE_COLORS: Record<string, string> = {
  transfer: 'bg-blue-500/20 text-blue-400',
  STAKE: 'bg-primary-500/20 text-primary-400',
  UNSTAKE: 'bg-orange-500/20 text-orange-400',
  P2P_ESCROW_LOCK: 'bg-purple-500/20 text-purple-400',
  P2P_ESCROW_RELEASE: 'bg-green-500/20 text-green-400',
  P2P_ESCROW_REFUND: 'bg-red-500/20 text-red-400',
};

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function groupByDate(items: HistoryItem[]) {
  const groups: Record<string, HistoryItem[]> = {};
  for (const item of items) {
    const date = formatDate(item.timestamp);
    if (!groups[date]) groups[date] = [];
    groups[date].push(item);
  }
  return groups;
}

export default function HistoryPage() {
  const { t } = useTranslation();
  const { connected, publicKey } = useWallet();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!connected || !publicKey) return;

    async function fetchHistory() {
      setLoading(true);
      const addr = publicKey!.toBase58();

      try {
        const [chainRes, logRes] = await Promise.all([
          fetch(`${API_URL}/wallet/${addr}/transactions`),
          fetch(`${API_URL}/wallet/${addr}/transaction-log`),
        ]);

        const chainTxs: OnChainTx[] = chainRes.ok ? await chainRes.json() : [];
        const logEntries: LogEntry[] = logRes.ok ? await logRes.json() : [];

        // Merge: log entries override chain txs for matching signatures
        const logSigs = new Set(logEntries.map((l) => l.signature));

        const merged: HistoryItem[] = [];

        // Add log entries first (richer data)
        for (const entry of logEntries) {
          merged.push({
            signature: entry.signature,
            timestamp: Math.floor(new Date(entry.createdAt).getTime() / 1000),
            type: entry.type,
            amount: entry.amount,
            token: entry.token,
            status: entry.status,
            source: 'log',
          });
        }

        // Add chain txs that aren't in logs
        for (const tx of chainTxs) {
          if (!logSigs.has(tx.signature)) {
            merged.push({
              signature: tx.signature,
              timestamp: tx.timestamp,
              type: tx.type,
              amount: tx.amount,
              token: tx.token,
              source: 'chain',
            });
          }
        }

        // Sort by timestamp descending
        merged.sort((a, b) => b.timestamp - a.timestamp);
        setItems(merged);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [connected, publicKey]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('history.connectPrompt')}</p>
      </div>
    );
  }

  const grouped = groupByDate(items);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('history.title')}</h1>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card animate-pulse h-16" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-8 text-gray-400">
          <p>{t('history.noTransactions')}</p>
        </div>
      ) : (
        Object.entries(grouped).map(([date, txs]) => (
          <div key={date}>
            <p className="text-xs text-gray-500 font-medium mb-2 px-1">{date}</p>
            <div className="space-y-2">
              {txs.map((tx) => (
                <a
                  key={tx.signature}
                  href={`https://solscan.io/tx/${tx.signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card flex items-center gap-3 hover:bg-white/10 transition"
                >
                  <span
                    className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                      TYPE_COLORS[tx.type] || 'bg-gray-500/20 text-gray-400'
                    }`}
                  >
                    {TYPE_LABELS[tx.type] || tx.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-gray-400 truncate">
                      {tx.signature.slice(0, 16)}...
                    </p>
                  </div>
                  {tx.amount != null && (
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </p>
                      <p className="text-xs text-gray-500">{tx.token || ''}</p>
                    </div>
                  )}
                  {tx.status && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        tx.status === 'CONFIRMED'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}
                    >
                      {tx.status === 'CONFIRMED' ? 'OK' : tx.status}
                    </span>
                  )}
                </a>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
