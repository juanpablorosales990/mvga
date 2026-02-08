import { useState } from 'react';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { buildSolanaPayUrl, SUPPORTED_TOKENS } from '../utils/solana-pay';
import { API_URL } from '../config';

const TOKEN_OPTIONS = Object.keys(SUPPORTED_TOKENS);

export default function ChargePage() {
  const { t } = useTranslation();
  const { connected, publicKey } = useSelfCustodyWallet();
  const [token, setToken] = useState('USDC');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [copied, setCopied] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [paymentLinkCopied, setPaymentLinkCopied] = useState(false);

  const address = publicKey?.toBase58() || '';
  const hasAmount = amount && parseFloat(amount) > 0;

  const solanaPayUrl = hasAmount
    ? buildSolanaPayUrl(address, { token, amount, memo: memo || undefined })
    : '';

  const handleCopy = async () => {
    if (!solanaPayUrl) return;
    try {
      await navigator.clipboard.writeText(solanaPayUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  const handleShare = async () => {
    if (!solanaPayUrl || !navigator.share) return;
    try {
      await navigator.share({
        title: 'MVGA Wallet',
        text: t('charge.shareText', { amount, token }),
        url: solanaPayUrl,
      });
    } catch {
      // User cancelled share
    }
  };

  const handleCreatePaymentLink = async () => {
    if (!hasAmount) return;
    setCreatingLink(true);
    try {
      const res = await fetch(`${API_URL}/api/payments/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          token,
          amount: parseFloat(amount),
          memo: memo || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to create payment link');
      const data = await res.json();
      const fullUrl = `${window.location.origin}/pay/${data.id}`;
      await navigator.clipboard.writeText(fullUrl);
      setPaymentLinkCopied(true);
      setTimeout(() => setPaymentLinkCopied(false), 3000);
    } catch {
      // Failed to create link
    } finally {
      setCreatingLink(false);
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('charge.connectPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('charge.title')}</h1>
      <p className="text-white/40 text-sm">{t('charge.subtitle')}</p>

      {/* Token selector */}
      <div>
        <label className="text-sm text-white/40 mb-1 block">{t('charge.token')}</label>
        <select
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full bg-white/10 px-3 py-2 text-white"
        >
          {TOKEN_OPTIONS.map((t) => (
            <option key={t} value={t} className="bg-gray-900">
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Amount */}
      <div>
        <label className="text-sm text-white/40 mb-1 block">{t('charge.amount')}</label>
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full bg-white/10 px-3 py-2 text-white text-lg"
          min="0"
          step="any"
        />
      </div>

      {/* Memo */}
      <div>
        <label className="text-sm text-white/40 mb-1 block">{t('charge.memo')}</label>
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder={t('charge.memoPlaceholder')}
          className="w-full bg-white/10 px-3 py-2 text-white"
          maxLength={200}
        />
      </div>

      {/* QR Code */}
      {hasAmount ? (
        <div className="card flex flex-col items-center py-8">
          <div className="bg-white p-4 mb-4">
            <QRCodeSVG value={solanaPayUrl} size={200} level="H" />
          </div>
          <p className="text-white/30 text-xs font-mono text-center break-all px-4 mb-4">
            {solanaPayUrl}
          </p>

          {/* Actions */}
          <div className="flex gap-3 w-full px-4">
            <button onClick={handleCopy} className="flex-1 btn-secondary text-sm">
              {copied ? t('charge.copied') : t('charge.copyLink')}
            </button>
            {typeof navigator.share === 'function' && (
              <button
                onClick={handleShare}
                className="flex-1 bg-white/10 text-white py-3 font-medium text-sm hover:bg-white/20 transition"
              >
                {t('charge.share')}
              </button>
            )}
          </div>

          {/* Create persistent payment link */}
          <button
            onClick={handleCreatePaymentLink}
            disabled={creatingLink}
            className="mt-3 w-full mx-4 btn-primary text-sm"
          >
            {paymentLinkCopied
              ? t('charge.paymentLinkCreated')
              : creatingLink
                ? t('common.processing')
                : t('charge.createPaymentLink')}
          </button>
        </div>
      ) : (
        <div className="card flex items-center justify-center py-12 text-white/20 text-sm">
          {t('charge.noAmount')}
        </div>
      )}
    </div>
  );
}
