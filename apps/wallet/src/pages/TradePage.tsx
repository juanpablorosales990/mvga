import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useConnection } from '@solana/wallet-adapter-react';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
} from '@solana/spl-token';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import TransactionPreviewModal from '../components/TransactionPreviewModal';
import ConfirmModal from '../components/ConfirmModal';
import { API_URL } from '../config';

const TOKEN_DECIMALS: Record<string, number> = { USDC: 6, MVGA: 9 };

interface Trade {
  id: string;
  offerId: string;
  buyerAddress: string;
  sellerAddress: string;
  amount: number;
  cryptoAmount: number;
  cryptoCurrency: string;
  paymentMethod: string;
  status: string;
  escrowTx: string | null;
  createdAt: string;
  paidAt: string | null;
  completedAt: string | null;
}

const STATUS_STEPS = ['PENDING', 'ESCROW_LOCKED', 'PAID', 'COMPLETED'];

export default function TradePage() {
  const { t } = useTranslation();

  const STATUS_LABELS: Record<string, string> = {
    PENDING: t('trade.pending'),
    ESCROW_LOCKED: t('trade.escrowLocked'),
    PAID: t('trade.paymentSent'),
    COMPLETED: t('trade.completed'),
    CANCELLED: t('trade.cancelled'),
    DISPUTED: t('trade.disputed'),
    REFUNDED: t('trade.refunded'),
  };

  const PAYMENT_LABELS: Record<string, string> = {
    ZELLE: t('p2p.zelle'),
    VENMO: t('p2p.venmo'),
    PAYPAL: t('p2p.paypal'),
    BANK_TRANSFER: t('p2p.bankTransfer'),
  };
  const { tradeId } = useParams<{ tradeId: string }>();
  const navigate = useNavigate();
  const { connected, publicKey, sendTransaction } = useSelfCustodyWallet();
  const { connection } = useConnection();
  const { authToken } = useAuth();

  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showEscrowPreview, setShowEscrowPreview] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [escrowLocking, setEscrowLocking] = useState(false);

  const walletAddress = publicKey?.toBase58() || '';

  const fetchTrade = useCallback(
    async (signal?: AbortSignal) => {
      if (!tradeId) return;
      try {
        const res = await fetch(`${API_URL}/p2p/trades/${tradeId}`, { signal });
        if (res.ok) {
          setTrade(await res.json());
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') setError(t('trade.loadFailed'));
      } finally {
        setLoading(false);
      }
    },
    [tradeId]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchTrade(controller.signal);
    const interval = setInterval(() => fetchTrade(controller.signal), 10000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchTrade]);

  const isSeller = trade?.sellerAddress === walletAddress;
  const isBuyer = trade?.buyerAddress === walletAddress;

  const handleLockEscrow = async () => {
    if (!trade || !publicKey || !sendTransaction || escrowLocking) return;
    setEscrowLocking(true);
    setActionLoading(true);
    setError(null);

    try {
      // 1. Get escrow info from API
      const lockRes = await fetch(`${API_URL}/p2p/trades/${trade.id}/lock-escrow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      });
      if (!lockRes.ok)
        throw new Error((await lockRes.json()).message || 'Failed to get escrow info');
      const { escrowWallet, mintAddress, amount, decimals } = await lockRes.json();

      // 2. Build SPL transfer: seller → escrow
      const mintPubkey = new PublicKey(mintAddress);
      const escrowPubkey = new PublicKey(escrowWallet);
      const rawAmount = BigInt(Math.round(amount * 10 ** decimals));

      const senderAta = await getAssociatedTokenAddress(mintPubkey, publicKey);
      const escrowAta = await getAssociatedTokenAddress(mintPubkey, escrowPubkey);

      const tx = new Transaction();

      // Create escrow ATA if needed
      try {
        await getAccount(connection, escrowAta);
      } catch {
        tx.add(
          createAssociatedTokenAccountInstruction(publicKey, escrowAta, escrowPubkey, mintPubkey)
        );
      }

      tx.add(createTransferInstruction(senderAta, escrowAta, publicKey, rawAmount));

      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      // 3. Confirm with API
      const confirmRes = await fetch(`${API_URL}/p2p/trades/${trade.id}/confirm-escrow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ signature }),
      });
      if (!confirmRes.ok) throw new Error('Failed to confirm escrow');

      setSuccess(t('trade.escrowSuccess'));
      fetchTrade();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('trade.failed'));
    } finally {
      setActionLoading(false);
      setEscrowLocking(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!trade) return;
    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/p2p/trades/${trade.id}/paid`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ status: 'PAID', notes: '' }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Failed to mark as paid');
      setSuccess(t('trade.paymentMarked'));
      fetchTrade();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('trade.failed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!trade) return;
    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/p2p/trades/${trade.id}/confirm`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ status: 'CONFIRMED', notes: '' }),
      });
      if (!res.ok) throw new Error((await res.json()).message || t('trade.failed'));
      setSuccess(t('trade.tradeCompletedMsg'));
      fetchTrade();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('trade.failed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!trade) return;
    setShowCancelModal(false);
    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/p2p/trades/${trade.id}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ status: 'CANCELLED', notes: '' }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Failed to cancel');
      setSuccess(t('trade.tradeCancelled'));
      fetchTrade();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDispute = async (reason?: string) => {
    if (!trade || !reason) return;
    setShowDisputeModal(false);
    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/p2p/trades/${trade.id}/dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ status: 'DISPUTED', notes: reason }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Failed to dispute');
      setSuccess(t('trade.disputeFiled'));
      fetchTrade();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('trade.connectPrompt')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="card animate-pulse h-40" />
        <div className="card animate-pulse h-24" />
      </div>
    );
  }

  if (!trade) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p>{t('trade.tradeNotFound')}</p>
        <button onClick={() => navigate('/p2p')} className="text-gold-500 mt-2">
          {t('trade.backToP2P')}
        </button>
      </div>
    );
  }

  const currentStep = STATUS_STEPS.indexOf(trade.status);
  const isTerminal = ['COMPLETED', 'CANCELLED', 'DISPUTED', 'REFUNDED'].includes(trade.status);

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate('/p2p')}
        className="text-gray-400 text-sm flex items-center gap-1"
      >
        ← {t('trade.backToP2P')}
      </button>

      <h1 className="text-2xl font-bold">Trade #{trade.id.slice(0, 8)}</h1>

      {/* Step Indicator */}
      {!isTerminal && (
        <div className="flex items-center gap-1">
          {STATUS_STEPS.map((step, i) => (
            <div key={step} className="flex-1 flex items-center">
              <div
                className={`h-2 flex-1 rounded-full ${
                  i <= currentStep ? 'bg-gold-500' : 'bg-white/10'
                }`}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span
          className={`text-sm px-3 py-1 rounded-full font-medium ${
            trade.status === 'COMPLETED'
              ? 'bg-green-500/20 text-green-400'
              : trade.status === 'CANCELLED' || trade.status === 'DISPUTED'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-gold-500/20 text-gold-400'
          }`}
        >
          {STATUS_LABELS[trade.status] || trade.status}
        </span>
        <span className="text-xs text-gray-500">
          {isSeller
            ? t('trade.youAreSelling')
            : isBuyer
              ? t('trade.youAreBuying')
              : t('trade.observer')}
        </span>
      </div>

      {/* Trade Details */}
      <div className="card space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">{t('trade.crypto')}</span>
          <span className="font-medium">
            {trade.cryptoAmount.toLocaleString()} {trade.cryptoCurrency}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">{t('trade.fiatAmount')}</span>
          <span className="font-medium">${trade.amount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">{t('p2p.payment')}</span>
          <span className="font-medium">
            {PAYMENT_LABELS[trade.paymentMethod] || trade.paymentMethod}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">{t('trade.seller')}</span>
          <span className="font-mono text-xs">
            {trade.sellerAddress.slice(0, 6)}...{trade.sellerAddress.slice(-4)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">{t('trade.buyer')}</span>
          <span className="font-mono text-xs">
            {trade.buyerAddress.slice(0, 6)}...{trade.buyerAddress.slice(-4)}
          </span>
        </div>
        {trade.escrowTx && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">{t('trade.escrowTx')}</span>
            <a
              href={`https://solscan.io/tx/${trade.escrowTx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-400 underline text-xs font-mono"
            >
              {trade.escrowTx.slice(0, 12)}...
            </a>
          </div>
        )}
      </div>

      {/* Action Panel */}
      {!isTerminal && (
        <div className="card space-y-3">
          {/* Seller @ PENDING: Lock Escrow */}
          {trade.status === 'PENDING' && isSeller && (
            <>
              <p className="text-sm text-gray-400">
                {t('trade.lockEscrowPrompt', {
                  amount: trade.cryptoAmount,
                  currency: trade.cryptoCurrency,
                })}
              </p>
              <button
                onClick={() => setShowEscrowPreview(true)}
                disabled={actionLoading}
                className="w-full btn-primary disabled:opacity-50"
              >
                {actionLoading ? t('trade.lockingEscrow') : t('trade.lockEscrow')}
              </button>
            </>
          )}

          {/* Buyer @ PENDING: Waiting for seller */}
          {trade.status === 'PENDING' && isBuyer && (
            <p className="text-sm text-gray-400 text-center py-2">
              {t('trade.waitingSellerEscrow')}
            </p>
          )}

          {/* Buyer @ ESCROW_LOCKED: Mark payment sent */}
          {trade.status === 'ESCROW_LOCKED' && isBuyer && (
            <>
              <p className="text-sm text-gray-400">
                {t('trade.sendPaymentPrompt', {
                  amount: trade.amount,
                  method: PAYMENT_LABELS[trade.paymentMethod] || trade.paymentMethod,
                })}
              </p>
              <button
                onClick={handleMarkPaid}
                disabled={actionLoading}
                className="w-full btn-primary disabled:opacity-50"
              >
                {actionLoading ? t('trade.marking') : t('trade.markPaid')}
              </button>
            </>
          )}

          {/* Seller @ ESCROW_LOCKED: Waiting for buyer */}
          {trade.status === 'ESCROW_LOCKED' && isSeller && (
            <p className="text-sm text-gray-400 text-center py-2">
              {t('trade.waitingBuyerEscrow')}
            </p>
          )}

          {/* Seller @ PAID: Confirm payment received */}
          {trade.status === 'PAID' && isSeller && (
            <>
              <p className="text-sm text-gray-400">{t('trade.confirmPaymentPrompt')}</p>
              <button
                onClick={handleConfirmPayment}
                disabled={actionLoading}
                className="w-full bg-green-500 text-black py-3 font-semibold disabled:opacity-50"
              >
                {actionLoading ? t('trade.confirming') : t('trade.confirmPayment')}
              </button>
            </>
          )}

          {/* Buyer @ PAID: Waiting for confirmation */}
          {trade.status === 'PAID' && isBuyer && (
            <p className="text-sm text-gray-400 text-center py-2">
              {t('trade.waitingSellerConfirm')}
            </p>
          )}

          {/* Cancel / Dispute buttons */}
          <div className="flex gap-2 pt-2">
            {(trade.status === 'PENDING' || trade.status === 'ESCROW_LOCKED') && (
              <button
                onClick={() => setShowCancelModal(true)}
                disabled={actionLoading}
                className="flex-1 py-2 text-sm font-medium bg-white/10 text-gray-300 hover:bg-white/20"
              >
                {t('common.cancel')}
              </button>
            )}
            {(trade.status === 'ESCROW_LOCKED' || trade.status === 'PAID') && (
              <button
                onClick={() => setShowDisputeModal(true)}
                disabled={actionLoading}
                className="flex-1 py-2 text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20"
              >
                {t('trade.dispute')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Completed State */}
      {trade.status === 'COMPLETED' && (
        <div className="card bg-green-500/10 border border-green-500/20 text-center py-6">
          <p className="text-green-400 font-semibold text-lg mb-1">{t('trade.tradeCompleted')}</p>
          <p className="text-sm text-gray-400">
            {t('trade.releasedToBuyer', {
              amount: trade.cryptoAmount,
              currency: trade.cryptoCurrency,
            })}
          </p>
        </div>
      )}

      {/* Error / Success */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 px-4 py-3 text-green-400 text-sm">
          {success}
        </div>
      )}

      <TransactionPreviewModal
        open={showEscrowPreview}
        onClose={() => setShowEscrowPreview(false)}
        onConfirm={() => {
          setShowEscrowPreview(false);
          handleLockEscrow();
        }}
        loading={actionLoading}
        tx={{
          type: 'escrow',
          amount: trade.cryptoAmount,
          token: trade.cryptoCurrency,
        }}
      />

      <ConfirmModal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancel}
        title={t('common.cancel')}
        message={t('trade.cancelConfirm')}
        variant="danger"
        confirmLabel={t('trade.cancelled')}
      />

      <ConfirmModal
        open={showDisputeModal}
        onClose={() => setShowDisputeModal(false)}
        onConfirm={(reason) => handleDispute(reason)}
        title={t('trade.dispute')}
        message={t('trade.describeIssue')}
        variant="danger"
        requireInput
        inputPlaceholder={t('trade.describeIssue')}
        confirmLabel={t('trade.dispute')}
      />
    </div>
  );
}
