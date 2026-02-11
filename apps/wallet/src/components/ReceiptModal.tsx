import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { shareReceipt, type ReceiptData } from '../lib/receiptGenerator';
import { generateReceipt } from '../lib/receiptGenerator';
import { track, AnalyticsEvents } from '../lib/analytics';
import { showToast } from '../hooks/useToast';

interface Props {
  open: boolean;
  onClose: () => void;
  data: ReceiptData;
  walletAddress: string;
}

export default function ReceiptModal({ open, onClose, data, walletAddress }: Props) {
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    generateReceipt(data, walletAddress, t).then((blob) => {
      if (cancelled) return;
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setPreviewUrl(url);
    });

    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      setPreviewUrl(null);
    };
  }, [open, data, walletAddress, t]);

  if (!open) return null;

  const handleShare = async () => {
    setSharing(true);
    try {
      const result = await shareReceipt(data, walletAddress, t);
      if (result === 'shared') {
        track(AnalyticsEvents.RECEIPT_SHARED, { token: data.token, amount: data.amount });
        showToast('success', t('receipt.shared'));
      } else {
        track(AnalyticsEvents.RECEIPT_DOWNLOADED, { token: data.token, amount: data.amount });
        showToast('success', t('receipt.downloaded'));
      }
      onClose();
    } catch {
      // User cancelled share dialog — not an error
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[#1a1a1a] border border-white/10 w-full max-w-sm max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-bold">{t('receipt.title')}</h3>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="text-white/40 hover:text-white/60 transition text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
          {previewUrl ? (
            <img src={previewUrl} alt="Transaction receipt" className="w-full rounded shadow-lg" />
          ) : (
            <div className="w-full aspect-[2/3] bg-white/5 animate-pulse" />
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-white/10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium bg-white/10 hover:bg-white/20 transition"
          >
            {t('common.close')}
          </button>
          <button
            onClick={handleShare}
            disabled={sharing || !previewUrl}
            className="flex-1 py-2.5 text-sm font-bold bg-gold-500 text-black hover:bg-gold-400 transition disabled:opacity-50"
          >
            {sharing ? t('common.processing') : t('receipt.share')}
          </button>
        </div>
      </div>
    </div>
  );
}
