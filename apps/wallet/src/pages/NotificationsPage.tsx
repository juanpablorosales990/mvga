import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletStore } from '../stores/walletStore';
import { showToast } from '../hooks/useToast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

interface LogEntry {
  id: string;
  type: string;
  signature: string;
  amount: number;
  token: string;
  status: string;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { color: string; labelKey: string }> = {
  TRANSFER: { color: 'bg-blue-500', labelKey: 'notifications.transfer' },
  STAKE: { color: 'bg-amber-500', labelKey: 'notifications.stake' },
  UNSTAKE: { color: 'bg-orange-500', labelKey: 'notifications.unstake' },
  P2P_ESCROW_LOCK: { color: 'bg-purple-500', labelKey: 'notifications.p2p' },
  P2P_ESCROW_RELEASE: { color: 'bg-green-500', labelKey: 'notifications.p2pRelease' },
  P2P_ESCROW_REFUND: { color: 'bg-red-500', labelKey: 'notifications.p2pRefund' },
  REFERRAL: { color: 'bg-pink-500', labelKey: 'notifications.referral' },
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const { connected, publicKey } = useWallet();
  const readNotifications = useWalletStore((s) => s.readNotifications);
  const markAllNotificationsRead = useWalletStore((s) => s.markAllNotificationsRead);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!connected || !publicKey) return;
    const addr = publicKey.toBase58();
    setLoading(true);
    fetch(`${API_URL}/wallet/${addr}/transaction-log`)
      .then((r) => r.json())
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .catch(() => showToast('error', t('common.somethingWrong')))
      .finally(() => setLoading(false));
  }, [connected, publicKey, t]);

  const unreadIds = entries.filter((e) => !readNotifications.includes(e.id)).map((e) => e.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/more" className="text-gray-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold flex-1">{t('notifications.title')}</h1>
        {unreadIds.length > 0 && (
          <button
            onClick={() => markAllNotificationsRead(unreadIds)}
            className="text-xs text-primary-400 hover:text-primary-300 transition"
          >
            {t('notifications.markAllRead')}
          </button>
        )}
      </div>

      {!connected ? (
        <div className="card p-8 text-center">
          <p className="text-gray-400">{t('notifications.connectPrompt')}</p>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-gray-700 rounded" />
                  <div className="h-3 w-32 bg-gray-700/50 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-400">{t('notifications.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const config = TYPE_CONFIG[entry.type] || {
              color: 'bg-gray-500',
              labelKey: 'notifications.activity',
            };
            const isUnread = !readNotifications.includes(entry.id);

            return (
              <div
                key={entry.id}
                className={`card p-4 flex items-center gap-3 ${isUnread ? 'border-l-2 border-l-primary-500' : ''}`}
              >
                <div
                  className={`w-8 h-8 ${config.color} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
                >
                  {entry.type.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t(config.labelKey)}</span>
                    {isUnread && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    {entry.amount} {entry.token}
                  </p>
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {relativeTime(entry.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
