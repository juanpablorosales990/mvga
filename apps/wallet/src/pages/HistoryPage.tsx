import { useState, useEffect } from 'react';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { useTranslation } from 'react-i18next';
import { showToast } from '../hooks/useToast';
import { API_URL } from '../config';
import { track, AnalyticsEvents } from '../lib/analytics';
import ReceiptModal from '../components/ReceiptModal';
import type { ReceiptData } from '../lib/receiptGenerator';

interface EnhancedTx {
  signature: string;
  timestamp: number;
  type: string;
  source: string;
  description: string;
  fee: number;
  feePayer: string;
  nativeTransfers: { fromUserAccount: string; toUserAccount: string; amount: number }[];
  tokenTransfers: {
    fromUserAccount: string;
    toUserAccount: string;
    mint: string;
    tokenAmount: number;
    tokenStandard: string;
  }[];
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
  source?: string;
  description?: string;
  amount?: number;
  token?: string;
  status?: string;
  fee?: number;
  isOutgoing?: boolean;
  counterparty?: string;
  sourceLabel: 'chain' | 'log';
}

// Helius transaction type → display label key
const HELIUS_TYPE_LABELS: Record<string, string> = {
  TRANSFER: 'history.transfer',
  SWAP: 'history.swap',
  NFT_SALE: 'history.nftSale',
  NFT_MINT: 'history.nftMint',
  STAKE_SOL: 'history.stakeType',
  UNSTAKE_SOL: 'history.unstakeType',
  TOKEN_MINT: 'history.tokenMint',
  BURN: 'history.burn',
  UNKNOWN: 'history.unknown',
};

// DB log type labels (existing)
const LOG_TYPE_LABELS: Record<string, string> = {
  STAKE: 'history.stakeType',
  UNSTAKE: 'history.unstakeType',
  P2P_ESCROW_LOCK: 'history.escrowLock',
  P2P_ESCROW_RELEASE: 'history.escrowRelease',
  P2P_ESCROW_REFUND: 'history.escrowRefund',
};

const TYPE_COLORS: Record<string, string> = {
  TRANSFER: 'bg-blue-500/20 text-blue-400',
  transfer: 'bg-blue-500/20 text-blue-400',
  SWAP: 'bg-purple-500/20 text-purple-400',
  NFT_SALE: 'bg-pink-500/20 text-pink-400',
  NFT_MINT: 'bg-indigo-500/20 text-indigo-400',
  STAKE: 'bg-gold-500/20 text-gold-400',
  STAKE_SOL: 'bg-gold-500/20 text-gold-400',
  UNSTAKE: 'bg-orange-500/20 text-orange-400',
  UNSTAKE_SOL: 'bg-orange-500/20 text-orange-400',
  P2P_ESCROW_LOCK: 'bg-purple-500/20 text-purple-400',
  P2P_ESCROW_RELEASE: 'bg-green-500/20 text-green-400',
  P2P_ESCROW_REFUND: 'bg-red-500/20 text-red-400',
  TOKEN_MINT: 'bg-emerald-500/20 text-emerald-400',
  BURN: 'bg-red-500/20 text-red-400',
  UNKNOWN: 'bg-gray-500/20 text-gray-400',
};

// Helius source → friendly label
const SOURCE_LABELS: Record<string, string> = {
  JUPITER: 'Jupiter',
  RAYDIUM: 'Raydium',
  MARINADE: 'Marinade',
  ORCA: 'Orca',
  PHANTOM: 'Phantom',
  MAGIC_EDEN: 'Magic Eden',
  TENSOR: 'Tensor',
  SYSTEM_PROGRAM: 'System',
};

function formatDate(ts: number, locale: string) {
  return new Date(ts * 1000).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function groupByDate(items: HistoryItem[], locale: string) {
  const groups: Record<string, HistoryItem[]> = {};
  for (const item of items) {
    const date = formatDate(item.timestamp, locale);
    if (!groups[date]) groups[date] = [];
    groups[date].push(item);
  }
  return groups;
}

export default function HistoryPage() {
  const { t, i18n } = useTranslation();
  const { connected, publicKey } = useSelfCustodyWallet();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [receiptTx, setReceiptTx] = useState<HistoryItem | null>(null);

  useEffect(() => {
    if (!connected || !publicKey) return;
    const controller = new AbortController();

    async function fetchHistory() {
      setLoading(true);
      const addr = publicKey!.toBase58();

      try {
        const [chainRes, logRes] = await Promise.all([
          fetch(`${API_URL}/wallet/${addr}/transactions`, { signal: controller.signal }),
          fetch(`${API_URL}/wallet/${addr}/transaction-log`, { signal: controller.signal }),
        ]);

        const chainTxs: EnhancedTx[] = chainRes.ok ? await chainRes.json() : [];
        const logEntries: LogEntry[] = logRes.ok ? await logRes.json() : [];

        // Merge: log entries override chain txs for matching signatures
        const logSigs = new Set(logEntries.map((l) => l.signature));

        const merged: HistoryItem[] = [];

        // Add log entries first (our own richer data)
        for (const entry of logEntries) {
          merged.push({
            signature: entry.signature,
            timestamp: Math.floor(new Date(entry.createdAt).getTime() / 1000),
            type: entry.type,
            amount: entry.amount,
            token: entry.token,
            status: entry.status,
            sourceLabel: 'log',
          });
        }

        // Add chain txs that aren't in logs (with Helius enhanced data)
        for (const tx of chainTxs) {
          if (!logSigs.has(tx.signature)) {
            // Determine direction
            const isOutgoing =
              tx.tokenTransfers?.some((xfer) => xfer.fromUserAccount === addr) ||
              tx.nativeTransfers?.some((xfer) => xfer.fromUserAccount === addr) ||
              false;

            // Find counterparty
            let counterparty: string | undefined;
            if (tx.tokenTransfers?.length) {
              const transfer = tx.tokenTransfers[0];
              counterparty = isOutgoing ? transfer.toUserAccount : transfer.fromUserAccount;
            } else if (tx.nativeTransfers?.length) {
              const transfer = tx.nativeTransfers[0];
              counterparty = isOutgoing ? transfer.toUserAccount : transfer.fromUserAccount;
            }

            merged.push({
              signature: tx.signature,
              timestamp: tx.timestamp,
              type: tx.type,
              source: tx.source,
              description: tx.description,
              amount: tx.amount,
              token: tx.token,
              fee: tx.fee,
              isOutgoing,
              counterparty,
              sourceLabel: 'chain',
            });
          }
        }

        // Sort by timestamp descending
        merged.sort((a, b) => b.timestamp - a.timestamp);
        setItems(merged);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError')
          showToast('error', t('common.somethingWrong'));
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
    return () => controller.abort();
  }, [connected, publicKey, t]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('history.connectPrompt')}</p>
      </div>
    );
  }

  const grouped = groupByDate(items, i18n.language);

  const exportCSV = () => {
    if (items.length === 0) return;
    const header = 'Date,Type,Direction,Amount,Token,Counterparty,Signature,Status';
    const rows = items.map((tx) => {
      const date = new Date(tx.timestamp * 1000).toISOString();
      const direction = tx.isOutgoing === false ? 'IN' : tx.isOutgoing ? 'OUT' : '';
      const amount = tx.amount != null ? tx.amount : '';
      const token = tx.token || '';
      const counterparty = tx.counterparty || '';
      const status = tx.status || 'CONFIRMED';
      return `${date},${tx.type},${direction},${amount},${token},${counterparty},${tx.signature},${status}`;
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mvga-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    track(AnalyticsEvents.EXPORT_CSV, { count: items.length });
    showToast('success', t('history.exported'));
  };

  const exportPDF = async () => {
    if (items.length === 0 || !publicKey) return;
    const { exportTransactionsPdf } = await import('../lib/exportPdf');
    await exportTransactionsPdf(items, publicKey.toBase58(), t);
    track(AnalyticsEvents.EXPORT_PDF, { count: items.length });
    showToast('success', t('history.exported'));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('history.title')}</h1>
        {items.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={exportCSV}
              className="text-xs text-gold-500 hover:text-gold-400 font-medium"
            >
              {t('history.exportCsv')}
            </button>
            <button
              onClick={exportPDF}
              className="text-xs text-gold-500 hover:text-gold-400 font-medium"
            >
              {t('history.exportPdf')}
            </button>
          </div>
        )}
      </div>

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
                  {/* Direction arrow */}
                  <div
                    className={`w-8 h-8 flex items-center justify-center text-lg ${
                      tx.isOutgoing === false
                        ? 'text-green-400'
                        : tx.isOutgoing
                          ? 'text-red-400'
                          : 'text-gray-400'
                    }`}
                  >
                    {tx.isOutgoing === false ? '\u2193' : tx.isOutgoing ? '\u2191' : '\u2022'}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Type badge + source */}
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                          TYPE_COLORS[tx.type] || 'bg-gray-500/20 text-gray-400'
                        }`}
                      >
                        {LOG_TYPE_LABELS[tx.type]
                          ? t(LOG_TYPE_LABELS[tx.type])
                          : HELIUS_TYPE_LABELS[tx.type]
                            ? t(HELIUS_TYPE_LABELS[tx.type])
                            : tx.type}
                      </span>
                      {tx.source && SOURCE_LABELS[tx.source] && (
                        <span className="text-xs text-gray-500">
                          {t('history.via')} {SOURCE_LABELS[tx.source]}
                        </span>
                      )}
                    </div>

                    {/* Description or counterparty */}
                    {tx.description ? (
                      <p className="text-xs text-gray-400 truncate">{tx.description}</p>
                    ) : tx.counterparty ? (
                      <p className="text-xs text-gray-500 font-mono truncate">
                        {tx.isOutgoing ? '\u2192' : '\u2190'} {tx.counterparty.slice(0, 8)}...
                        {tx.counterparty.slice(-4)}
                      </p>
                    ) : (
                      <p className="text-xs font-mono text-gray-500 truncate">
                        {tx.signature.slice(0, 16)}...
                      </p>
                    )}
                  </div>

                  {/* Amount */}
                  {tx.amount != null && (
                    <div className="text-right flex-shrink-0">
                      <p
                        className={`text-sm font-medium ${
                          tx.isOutgoing === false
                            ? 'text-green-400'
                            : tx.isOutgoing
                              ? 'text-white'
                              : 'text-white'
                        }`}
                      >
                        {tx.isOutgoing === false ? '+' : tx.isOutgoing ? '-' : ''}
                        {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </p>
                      <p className="text-xs text-gray-500">{tx.token || ''}</p>
                    </div>
                  )}

                  {/* Status badge (for DB entries) */}
                  {tx.status && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                        tx.status === 'CONFIRMED'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}
                    >
                      {tx.status === 'CONFIRMED' ? 'OK' : tx.status}
                    </span>
                  )}

                  {/* Receipt button */}
                  {tx.amount != null && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setReceiptTx(tx);
                      }}
                      className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-white/30 hover:text-gold-400 transition"
                      title={t('receipt.viewReceipt')}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  )}
                </a>
              ))}
            </div>
          </div>
        ))
      )}

      {receiptTx && publicKey && (
        <ReceiptModal
          open={!!receiptTx}
          onClose={() => setReceiptTx(null)}
          data={{
            signature: receiptTx.signature,
            timestamp: receiptTx.timestamp,
            type: receiptTx.type,
            amount: receiptTx.amount || 0,
            token: receiptTx.token || 'SOL',
            isOutgoing: receiptTx.isOutgoing,
            counterparty: receiptTx.counterparty,
            status: receiptTx.status || 'CONFIRMED',
            fee: receiptTx.fee,
          }}
          walletAddress={publicKey.toBase58()}
        />
      )}
    </div>
  );
}
