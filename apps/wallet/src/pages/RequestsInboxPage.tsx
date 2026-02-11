import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../hooks/useToast';
import { track, AnalyticsEvents } from '../lib/analytics';

interface PaymentRequestItem {
  id: string;
  recipientAddress: string;
  token: string;
  amount: number;
  amountRaw: string;
  memo: string | null;
  status: string;
  paymentTx: string | null;
  expiresAt: string;
  createdAt: string;
  requesterId: string | null;
  requesterUsername: string | null;
  requesteeAddress: string | null;
  note: string | null;
  declinedAt: string | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: 'bg-yellow-500/20 text-yellow-400',
    PAID: 'bg-green-500/20 text-green-400',
    DECLINED: 'bg-red-500/20 text-red-400',
    EXPIRED: 'bg-gray-500/20 text-gray-400',
    CANCELLED: 'bg-gray-500/20 text-gray-400',
  };
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase ${colors[status] || colors.PENDING}`}
    >
      {status}
    </span>
  );
}

export default function RequestsInboxPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [incoming, setIncoming] = useState<PaymentRequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<PaymentRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    track(AnalyticsEvents.INBOX_VIEWED);
    const load = async () => {
      setLoading(true);
      try {
        const [inc, out] = await Promise.all([
          apiFetch<PaymentRequestItem[]>('/payments/requests-for-me'),
          apiFetch<PaymentRequestItem[]>('/payments/my-requests'),
        ]);
        setIncoming(inc);
        setOutgoing(out);
      } catch {
        // Silent fail — show empty
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleDecline = async (id: string) => {
    if (!window.confirm(t('request.declineConfirm'))) return;
    try {
      await apiFetch(`/payments/request/${id}/decline`, { method: 'PATCH' });
      track(AnalyticsEvents.REQUEST_DECLINED);
      setIncoming((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'DECLINED' } : r)));
      showToast('success', t('request.declined'));
    } catch {
      showToast('error', t('request.declineFailed'));
    }
  };

  const handlePay = (req: PaymentRequestItem) => {
    track(AnalyticsEvents.REQUEST_PAID);
    navigate(
      `/send?to=${req.recipientAddress}&amount=${req.amount}&token=${req.token}&requestId=${req.id}`
    );
  };

  const items = tab === 'incoming' ? incoming : outgoing;

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
        <h1 className="text-2xl font-bold">{t('request.inbox')}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded">
        <button
          onClick={() => setTab('incoming')}
          className={`flex-1 py-2 text-sm font-medium rounded transition ${
            tab === 'incoming' ? 'bg-gold-500 text-black' : 'text-gray-400 hover:text-white'
          }`}
        >
          {t('request.incoming')} {incoming.length > 0 && `(${incoming.length})`}
        </button>
        <button
          onClick={() => setTab('outgoing')}
          className={`flex-1 py-2 text-sm font-medium rounded transition ${
            tab === 'outgoing' ? 'bg-gold-500 text-black' : 'text-gray-400 hover:text-white'
          }`}
        >
          {t('request.outgoing')} {outgoing.length > 0 && `(${outgoing.length})`}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-8">
          {tab === 'incoming' ? t('request.emptyIncoming') : t('request.emptyOutgoing')}
        </p>
      )}

      {/* Request list */}
      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((req) => (
            <div key={req.id} className="card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-gold-400">
                    {tab === 'incoming'
                      ? (req.requesterUsername || '?')[0].toUpperCase()
                      : (req.requesteeAddress || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {tab === 'incoming'
                        ? req.requesterUsername
                          ? `@${req.requesterUsername}`
                          : `${req.recipientAddress.slice(0, 6)}...${req.recipientAddress.slice(-4)}`
                        : req.requesteeAddress
                          ? `${req.requesteeAddress.slice(0, 6)}...${req.requesteeAddress.slice(-4)}`
                          : '—'}
                    </p>
                    <p className="text-[10px] text-gray-500">{timeAgo(req.createdAt)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gold-400">
                    ${req.amount.toFixed(2)} {req.token}
                  </p>
                  <StatusBadge status={req.status} />
                </div>
              </div>

              {/* Note */}
              {req.note && (
                <p className="text-xs text-gray-400 bg-white/5 px-3 py-1.5 rounded">{req.note}</p>
              )}

              {/* Actions (incoming + pending only) */}
              {tab === 'incoming' && req.status === 'PENDING' && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handlePay(req)}
                    className="flex-1 py-2 bg-gold-500 text-black text-sm font-medium rounded hover:bg-gold-400 transition"
                  >
                    {t('request.pay')}
                  </button>
                  <button
                    onClick={() => handleDecline(req.id)}
                    className="flex-1 py-2 bg-white/10 text-gray-300 text-sm rounded hover:bg-white/20 transition"
                  >
                    {t('request.decline')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New request link */}
      <Link
        to="/request"
        className="block text-center text-sm text-gold-500 hover:text-gold-400 transition"
      >
        + {t('request.newRequest')}
      </Link>
    </div>
  );
}
