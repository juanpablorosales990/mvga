import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { API_URL } from '../config';
import { track, AnalyticsEvents } from '../lib/analytics';

type FilterTab = 'all' | 'active' | 'paid' | 'expired';

interface PaymentLink {
  id: string;
  recipientAddress: string;
  token: string;
  amount: number;
  memo: string | null;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  paymentTx: string | null;
  expiresAt: string;
  createdAt: string;
}

export default function MyLinksPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();

    async function fetchLinks() {
      try {
        const res = await fetch(`${API_URL}/payments/my-links`, {
          credentials: 'include',
          signal: controller.signal,
        });
        if (res.ok) setLinks(await res.json());
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
      } finally {
        setLoading(false);
      }
    }

    fetchLinks();
    return () => controller.abort();
  }, [isAuthenticated]);

  const filtered = links.filter((link) => {
    if (filter === 'active') return link.status === 'PENDING';
    if (filter === 'paid') return link.status === 'PAID';
    if (filter === 'expired') return link.status === 'EXPIRED' || link.status === 'CANCELLED';
    return true;
  });

  const getLinkUrl = (id: string) => `${window.location.origin}/pay/${id}`;

  const handleCopy = async (id: string) => {
    await navigator.clipboard.writeText(getLinkUrl(id));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShare = async (link: PaymentLink) => {
    const url = getLinkUrl(link.id);
    const text = t('myLinks.shareText', { amount: link.amount, token: link.token });

    if (navigator.share) {
      try {
        await navigator.share({ title: 'MVGA', text, url });
      } catch {
        // User cancelled
      }
    }
  };

  const handleShareWhatsApp = (link: PaymentLink) => {
    const url = getLinkUrl(link.id);
    const text = t('myLinks.shareText', { amount: link.amount, token: link.token });
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank');
  };

  const handleShareTelegram = (link: PaymentLink) => {
    const url = getLinkUrl(link.id);
    const text = t('myLinks.shareText', { amount: link.amount, token: link.token });
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      '_blank'
    );
  };

  const handleCancel = async (id: string) => {
    if (!confirm(t('myLinks.cancelConfirm'))) return;
    setCancellingId(id);
    try {
      const res = await fetch(`${API_URL}/payments/request/${id}/cancel`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (res.ok) {
        setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, status: 'CANCELLED' } : l)));
        track(AnalyticsEvents.PAYMENT_LINK_CANCELLED);
      }
    } catch {
      // Failed to cancel
    } finally {
      setCancellingId(null);
    }
  };

  const statusConfig: Record<string, { label: string; className: string }> = {
    PENDING: {
      label: t('myLinks.statusActive'),
      className: 'text-gold-500 bg-gold-500/10',
    },
    PAID: {
      label: t('myLinks.statusPaid'),
      className: 'text-green-400 bg-green-400/10',
    },
    EXPIRED: {
      label: t('myLinks.statusExpired'),
      className: 'text-red-400 bg-red-400/10',
    },
    CANCELLED: {
      label: t('myLinks.statusCancelled'),
      className: 'text-gray-400 bg-gray-400/10',
    },
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: t('myLinks.filterAll') },
    { key: 'active', label: t('myLinks.filterActive') },
    { key: 'paid', label: t('myLinks.filterPaid') },
    { key: 'expired', label: t('myLinks.filterExpired') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('myLinks.title')}</h1>
        <Link to="/charge" className="text-gold-500 text-sm font-mono">
          + {t('myLinks.createNew')}
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex-1 py-2 text-xs font-medium border transition ${
              filter === tab.key
                ? 'border-gold-500 bg-gold-500/10 text-gold-500'
                : 'border-white/10 text-white/50 hover:border-white/20'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse h-20" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center py-12 text-center">
          <p className="text-white/30 text-sm mb-4">{t('myLinks.empty')}</p>
          <Link to="/charge" className="btn-primary text-sm">
            {t('myLinks.createFirst')}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((link) => {
            const isExpanded = expandedId === link.id;
            const config = statusConfig[link.status] || statusConfig.PENDING;

            return (
              <div key={link.id} className="card">
                {/* Summary row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : link.id)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">
                        {link.amount} {link.token}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 font-mono uppercase ${config.className}`}
                      >
                        {config.label}
                      </span>
                    </div>
                    {link.memo && (
                      <p className="text-xs text-white/40 truncate mt-0.5">{link.memo}</p>
                    )}
                    <p className="text-[10px] text-white/20 font-mono mt-1">
                      {new Date(link.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-white/30 text-sm ml-2">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
                    {/* QR Code */}
                    {link.status === 'PENDING' && (
                      <div className="flex justify-center">
                        <div className="bg-white p-3">
                          <QRCodeSVG value={getLinkUrl(link.id)} size={140} level="H" />
                        </div>
                      </div>
                    )}

                    {/* URL */}
                    <div className="bg-white/5 px-3 py-2 font-mono text-xs break-all text-white/60">
                      {getLinkUrl(link.id)}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopy(link.id)}
                        className="flex-1 btn-secondary text-xs"
                      >
                        {copiedId === link.id ? t('common.copied') : t('myLinks.copy')}
                      </button>
                      {typeof navigator.share === 'function' && (
                        <button
                          onClick={() => handleShare(link)}
                          className="flex-1 bg-white/10 text-white py-2 text-xs font-medium hover:bg-white/20 transition"
                        >
                          {t('myLinks.share')}
                        </button>
                      )}
                    </div>

                    {/* WhatsApp + Telegram */}
                    {link.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleShareWhatsApp(link)}
                          className="flex-1 bg-green-600/20 text-green-400 py-2 text-xs font-medium hover:bg-green-600/30 transition"
                        >
                          WhatsApp
                        </button>
                        <button
                          onClick={() => handleShareTelegram(link)}
                          className="flex-1 bg-blue-500/20 text-blue-400 py-2 text-xs font-medium hover:bg-blue-500/30 transition"
                        >
                          Telegram
                        </button>
                      </div>
                    )}

                    {/* Cancel */}
                    {link.status === 'PENDING' && (
                      <button
                        onClick={() => handleCancel(link.id)}
                        disabled={cancellingId === link.id}
                        className="w-full text-red-400/60 text-xs py-2 hover:text-red-400 transition"
                      >
                        {cancellingId === link.id ? t('common.processing') : t('myLinks.cancel')}
                      </button>
                    )}

                    {/* Payment TX */}
                    {link.paymentTx && (
                      <a
                        href={`https://solscan.io/tx/${link.paymentTx}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center text-gold-500 text-xs font-mono hover:underline"
                      >
                        {t('common.viewOnSolscan')} &rarr;
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
