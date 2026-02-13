import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../hooks/useToast';
import { track, AnalyticsEvents } from '../lib/analytics';
import { QRCodeSVG } from 'qrcode.react';

export default function MerchantQRPage() {
  const { t } = useTranslation();
  const { connected } = useSelfCustodyWallet();
  const [slug, setSlug] = useState<string | null>(null);
  const [storeName, setStoreName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!connected) return;
    apiFetch<{ slug: string; name: string } | null>('/merchant/store')
      .then((store) => {
        if (store) {
          setSlug(store.slug);
          setStoreName(store.name);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [connected]);

  if (!connected || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
        <p>{loading ? t('common.loading') : t('common.connectWallet')}</p>
      </div>
    );
  }

  if (!slug) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
        <p>{t('merchant.dashboard.noStore')}</p>
      </div>
    );
  }

  const storeUrl = `${window.location.origin}/s/${slug}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      showToast('success', t('merchant.qr.copied'));
      track(AnalyticsEvents.MERCHANT_QR_SHARED, { method: 'copy' });
    } catch {
      // clipboard not available
    }
  };

  const handleShare = (platform: 'whatsapp' | 'telegram') => {
    const text = `${storeName} — ${storeUrl}`;
    const url =
      platform === 'whatsapp'
        ? `https://wa.me/?text=${encodeURIComponent(text)}`
        : `https://t.me/share/url?url=${encodeURIComponent(storeUrl)}&text=${encodeURIComponent(storeName)}`;
    window.open(url, '_blank');
    track(AnalyticsEvents.MERCHANT_QR_SHARED, { method: platform });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-lg mx-auto p-4 flex flex-col items-center space-y-6">
      <h1 className="text-xl font-bold">{t('merchant.qr.title')}</h1>
      <p className="text-gray-500 text-sm text-center">{t('merchant.qr.subtitle')}</p>

      {/* QR Code */}
      <div className="bg-white p-8 rounded-2xl shadow-lg print:shadow-none">
        <QRCodeSVG value={storeUrl} size={256} level="M" />
        <p className="text-center mt-4 text-sm font-medium text-gray-700">{storeName}</p>
        <p className="text-center text-xs text-gray-400">{t('merchant.qr.scanToOrder')}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 print:hidden">
        <button
          onClick={handlePrint}
          className="flex-1 py-2 px-4 rounded-lg border bg-white dark:bg-gray-800 dark:border-gray-700 text-sm font-medium hover:bg-gray-50"
        >
          🖨️ {t('merchant.qr.print')}
        </button>
        <button
          onClick={handleCopy}
          className="flex-1 py-2 px-4 rounded-lg border bg-white dark:bg-gray-800 dark:border-gray-700 text-sm font-medium hover:bg-gray-50"
        >
          🔗 {t('merchant.qr.copyLink')}
        </button>
      </div>
      <div className="flex gap-3 print:hidden">
        <button
          onClick={() => handleShare('whatsapp')}
          className="flex-1 py-2 px-4 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600"
        >
          {t('merchant.qr.shareWhatsApp')}
        </button>
        <button
          onClick={() => handleShare('telegram')}
          className="flex-1 py-2 px-4 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600"
        >
          {t('merchant.qr.shareTelegram')}
        </button>
      </div>
    </div>
  );
}
