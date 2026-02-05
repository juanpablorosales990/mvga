import { useTranslation } from 'react-i18next';
import FiatValue from './FiatValue';

export interface TransactionPreview {
  type: 'send' | 'stake' | 'unstake' | 'escrow';
  recipient?: string;
  amount: number;
  token: string;
  fee?: number;
}

interface TransactionPreviewModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  tx: TransactionPreview;
  loading?: boolean;
}

export default function TransactionPreviewModal({
  open,
  onClose,
  onConfirm,
  tx,
  loading,
}: TransactionPreviewModalProps) {
  const { t } = useTranslation();

  if (!open) return null;

  const typeLabels: Record<string, string> = {
    send: t('txPreview.typeSend'),
    stake: t('txPreview.typeStake'),
    unstake: t('txPreview.typeUnstake'),
    escrow: t('txPreview.typeEscrow'),
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-xl font-bold text-center">{t('txPreview.title')}</h2>

        {/* Warning */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 text-yellow-400 text-sm">
          {t('txPreview.warning')}
        </div>

        {/* Details */}
        <div className="bg-white/5 rounded-xl p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">{t('txPreview.type')}</span>
            <span className="font-medium">{typeLabels[tx.type] || tx.type}</span>
          </div>

          {tx.recipient && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">{t('txPreview.recipient')}</span>
              <span className="font-mono text-xs">
                {tx.recipient.slice(0, 6)}...{tx.recipient.slice(-4)}
              </span>
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-gray-400">{t('txPreview.amount')}</span>
            <div className="text-right">
              <span className="font-medium">
                {tx.amount.toLocaleString('en-US', { maximumFractionDigits: 6 })} {tx.token}
              </span>
              <br />
              <FiatValue amount={tx.amount} token={tx.token} className="text-xs text-gray-500" />
            </div>
          </div>

          {tx.fee !== undefined && tx.fee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">{t('txPreview.fee')}</span>
              <span className="font-medium">~{tx.fee} SOL</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 rounded-xl font-medium bg-white/10 text-gray-300 hover:bg-white/20 transition disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 btn-primary disabled:opacity-50"
          >
            {loading ? t('common.processing') : t('txPreview.confirmSign')}
          </button>
        </div>
      </div>
    </div>
  );
}
