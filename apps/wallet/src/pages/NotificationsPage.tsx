import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { useWalletStore } from '../stores/walletStore';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { showToast } from '../hooks/useToast';
import { API_URL } from '../config';

interface LogEntry {
  id: string;
  type: string;
  signature: string;
  amount: number;
  token: string;
  status: string;
  createdAt: string;
}

interface Preferences {
  p2pTrades: boolean;
  staking: boolean;
  referrals: boolean;
  grants: boolean;
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

const PREF_KEYS: { key: keyof Preferences; labelKey: string }[] = [
  { key: 'p2pTrades', labelKey: 'notifications.prefP2p' },
  { key: 'staking', labelKey: 'notifications.prefStaking' },
  { key: 'referrals', labelKey: 'notifications.prefReferrals' },
  { key: 'grants', labelKey: 'notifications.prefGrants' },
];

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
  const { connected, publicKey } = useSelfCustodyWallet();
  const authToken = useWalletStore((s) => s.authToken);
  const readNotifications = useWalletStore((s) => s.readNotifications);
  const markAllNotificationsRead = useWalletStore((s) => s.markAllNotificationsRead);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [showPrefs, setShowPrefs] = useState(false);

  const {
    isSupported,
    permission,
    isSubscribed,
    loading: pushLoading,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  useEffect(() => {
    if (!connected || !publicKey) return;
    const controller = new AbortController();
    const addr = publicKey.toBase58();
    setLoading(true);
    fetch(`${API_URL}/wallet/${addr}/transaction-log`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .catch((err) => {
        if (err?.name !== 'AbortError') showToast('error', t('common.somethingWrong'));
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [connected, publicKey, t]);

  // Fetch notification preferences
  useEffect(() => {
    if (!connected || !publicKey || !isSubscribed) return;
    const addr = publicKey.toBase58();
    fetch(`${API_URL}/notifications/preferences/${addr}`)
      .then((r) => r.json())
      .then((data) =>
        setPrefs({
          p2pTrades: data.p2pTrades,
          staking: data.staking,
          referrals: data.referrals,
          grants: data.grants,
        })
      )
      .catch(() => {});
  }, [connected, publicKey, isSubscribed]);

  const togglePref = useCallback(
    async (key: keyof Preferences) => {
      if (!publicKey || !authToken || !prefs) return;
      const updated = { ...prefs, [key]: !prefs[key] };
      setPrefs(updated);
      try {
        await fetch(`${API_URL}/notifications/preferences/${publicKey.toBase58()}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ [key]: updated[key] }),
        });
      } catch {
        setPrefs(prefs); // Revert on error
      }
    },
    [publicKey, authToken, prefs]
  );

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
        {isSubscribed && (
          <button
            onClick={() => setShowPrefs(!showPrefs)}
            className="text-gray-400 hover:text-white transition"
            aria-label={t('notifications.settings')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        )}
        {unreadIds.length > 0 && (
          <button
            onClick={() => markAllNotificationsRead(unreadIds)}
            className="text-xs text-gold-400 hover:text-gold-300 transition"
          >
            {t('notifications.markAllRead')}
          </button>
        )}
      </div>

      {/* Push notification banner */}
      {connected && isSupported && permission !== 'denied' && !isSubscribed && (
        <div className="card p-4 border border-gold-500/30 bg-gold-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold-500/20 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-5 h-5 text-gold-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{t('notifications.enablePush')}</p>
              <p className="text-xs text-gray-400">{t('notifications.enablePushDesc')}</p>
            </div>
            <button
              onClick={subscribe}
              disabled={pushLoading}
              className="px-4 py-2 bg-gold-500 text-black text-sm font-medium rounded-lg hover:bg-gold-400 transition disabled:opacity-50"
            >
              {pushLoading ? '...' : t('notifications.enable')}
            </button>
          </div>
        </div>
      )}

      {/* Push subscribed — disable option */}
      {connected && isSubscribed && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-green-400">{t('notifications.pushActive')}</span>
          <button
            onClick={unsubscribe}
            disabled={pushLoading}
            className="text-xs text-gray-500 hover:text-red-400 transition"
          >
            {t('notifications.disable')}
          </button>
        </div>
      )}

      {/* Notification preferences panel */}
      {showPrefs && prefs && (
        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">{t('notifications.categories')}</h3>
          {PREF_KEYS.map(({ key, labelKey }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-gray-300">{t(labelKey)}</span>
              <button
                onClick={() => togglePref(key)}
                className={`w-10 h-6 rounded-full transition-colors relative ${prefs[key] ? 'bg-gold-500' : 'bg-gray-600'}`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${prefs[key] ? 'translate-x-4' : ''}`}
                />
              </button>
            </div>
          ))}
        </div>
      )}

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
                      <span className="w-1.5 h-1.5 rounded-full bg-gold-500 flex-shrink-0" />
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
