import { useWallet } from '@solana/wallet-adapter-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function ReceivePage() {
  const { t } = useTranslation();
  const { connected, publicKey } = useWallet();
  const [copied, setCopied] = useState(false);

  const address = publicKey?.toBase58() || '';

  const handleCopy = async () => {
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('receive.connectPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('receive.title')}</h1>

      <div className="card flex flex-col items-center py-8">
        {/* QR Code */}
        <div className="bg-white p-4 rounded-2xl mb-6">
          <QRCodeSVG value={address} size={200} level="H" />
        </div>

        {/* Address Display */}
        <p className="text-gray-400 text-sm mb-2">{t('receive.yourAddress')}</p>
        <p className="text-sm text-center break-all px-4 mb-4 font-mono">{address}</p>

        {/* Copy Button */}
        <button onClick={handleCopy} className="btn-secondary flex items-center gap-2">
          {copied ? (
            <>
              <svg
                className="w-5 h-5 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {t('receive.copied')}
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              {t('receive.copyAddress')}
            </>
          )}
        </button>
      </div>

      {/* Instructions */}
      <div className="card space-y-3">
        <h3 className="font-semibold">{t('receive.howTo')}</h3>
        <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
          <li>{t('receive.step1')}</li>
          <li>{t('receive.step2')}</li>
          <li>{t('receive.step3')}</li>
        </ol>
      </div>
    </div>
  );
}
