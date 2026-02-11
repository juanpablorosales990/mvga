import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../hooks/useToast';
import { track, AnalyticsEvents } from '../lib/analytics';

interface SplitDetail {
  id: string;
  creatorAddress: string;
  totalAmount: number;
  token: string;
  description: string;
  participantCount: number;
  status: string;
  paidCount: number;
  totalCollected: number;
  createdAt: string;
  completedAt: string | null;
  participants: Array<{
    requestId: string;
    requesteeAddress: string | null;
    amount: number;
    status: string;
    paymentTx: string | null;
  }>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: 'bg-yellow-500/20 text-yellow-400',
    PARTIAL: 'bg-blue-500/20 text-blue-400',
    PAID: 'bg-green-500/20 text-green-400',
    COMPLETED: 'bg-green-500/20 text-green-400',
    CANCELLED: 'bg-gray-500/20 text-gray-400',
    DECLINED: 'bg-red-500/20 text-red-400',
    EXPIRED: 'bg-gray-500/20 text-gray-400',
  };
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase ${colors[status] || colors.PENDING}`}
    >
      {status}
    </span>
  );
}

export default function SplitDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [split, setSplit] = useState<SplitDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    track(AnalyticsEvents.SPLIT_VIEWED);
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await apiFetch<SplitDetail>(`/payments/split/${id}`);
        setSplit(data);
      } catch {
        showToast('error', t('split.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, t]);

  const handleCancel = async () => {
    if (!id || !window.confirm(t('split.cancelConfirm'))) return;
    try {
      await apiFetch(`/payments/split/${id}/cancel`, { method: 'PATCH' });
      track(AnalyticsEvents.SPLIT_CANCELLED);
      showToast('success', t('split.cancelled'));
      setSplit((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null));
    } catch {
      showToast('error', t('split.cancelFailed'));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!split) {
    return (
      <div className="space-y-6">
        <Link to="/more" className="text-gray-400 hover:text-white">
          {t('common.back')}
        </Link>
        <p className="text-gray-500 text-center">{t('split.notFound')}</p>
      </div>
    );
  }

  const progress = (split.paidCount / split.participantCount) * 100;

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
        <h1 className="text-2xl font-bold">{t('split.detail')}</h1>
      </div>

      {/* Summary Card */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{split.description}</h2>
          <StatusBadge status={split.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400">{t('split.totalAmount')}</p>
            <p className="font-mono text-gold-400">
              ${split.totalAmount.toFixed(2)} {split.token}
            </p>
          </div>
          <div>
            <p className="text-gray-400">{t('split.collected')}</p>
            <p className="font-mono">${split.totalCollected.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-gray-400">{t('split.participants')}</p>
            <p className="font-mono">{split.participantCount}</p>
          </div>
          <div>
            <p className="text-gray-400">{t('split.paid')}</p>
            <p className="font-mono">
              {split.paidCount} / {split.participantCount}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{t('split.progress')}</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div
              className="bg-gold-500 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Cancel button */}
        {(split.status === 'PENDING' || split.status === 'PARTIAL') && (
          <button
            onClick={handleCancel}
            className="w-full py-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition"
          >
            {t('split.cancel')}
          </button>
        )}
      </div>

      {/* Participants List */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-400">{t('split.participantsList')}</h3>
        {split.participants.map((p, idx) => (
          <div key={p.requestId} className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold">
                {idx + 1}
              </div>
              <div>
                <p className="text-sm font-mono">
                  {p.requesteeAddress
                    ? `${p.requesteeAddress.slice(0, 6)}...${p.requesteeAddress.slice(-4)}`
                    : '—'}
                </p>
                <p className="text-xs text-gray-500">
                  ${p.amount.toFixed(2)} {split.token}
                </p>
              </div>
            </div>
            <StatusBadge status={p.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
