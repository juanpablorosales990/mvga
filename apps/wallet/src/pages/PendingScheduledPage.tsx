import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useConnection } from '@solana/wallet-adapter-react';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../hooks/useToast';
import { useWalletStore } from '../stores/walletStore';

interface PendingExecution {
  id: string;
  type: 'PAYMENT' | 'DCA';
  status: string;
  scheduledFor: string;
  expiresAt: string;
  payment?: {
    recipientAddress: string;
    recipientLabel?: string;
    token: string;
    amount: string;
    memo?: string;
  };
  dca?: {
    inputToken: string;
    outputToken: string;
    inputAmount: string;
  };
}

const TOKEN_MINTS: Record<string, { mint: string; decimals: number }> = {
  USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  USDT: { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  MVGA: { mint: 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh', decimals: 9 },
};

const TOKEN_DECIMALS: Record<string, number> = { SOL: 9, USDC: 6, USDT: 6, MVGA: 9 };

function formatSmallestUnit(raw: string, token: string): string {
  const decimals = TOKEN_DECIMALS[token] ?? 6;
  const str = raw.padStart(decimals + 1, '0');
  const whole = str.slice(0, str.length - decimals) || '0';
  const fraction = str.slice(str.length - decimals).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

function getTimeRemaining(expiresAt: string): { hours: number; minutes: number } | null {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
  };
}

export default function PendingScheduledPage() {
  const { t } = useTranslation();
  const { connected, publicKey, sendTransaction } = useSelfCustodyWallet();
  const { connection } = useConnection();
  /* apiFetch uses the httpOnly auth cookie automatically */
  const setPendingExecutionCount = useWalletStore((s) => s.setPendingExecutionCount);

  const [executions, setExecutions] = useState<PendingExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchExecutions = useCallback(async () => {
    try {
      const data = await apiFetch<PendingExecution[]>('/scheduler/executions');
      setExecutions(data);
      setPendingExecutionCount(data.length);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [setPendingExecutionCount]);

  useEffect(() => {
    if (connected) fetchExecutions();
  }, [connected, fetchExecutions]);

  const handleApprovePayment = async (exec: PendingExecution) => {
    if (!publicKey || !exec.payment) return;
    setProcessing(exec.id);

    try {
      const { recipientAddress, token, amount: rawAmount } = exec.payment;
      const recipientPubkey = new PublicKey(recipientAddress);

      const transaction = new Transaction();

      if (token === 'SOL') {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: recipientPubkey,
            lamports: BigInt(rawAmount),
          })
        );
      } else {
        const tokenConfig = TOKEN_MINTS[token];
        if (!tokenConfig) throw new Error('Unsupported token');

        const mintPubkey = new PublicKey(tokenConfig.mint);
        const senderATA = await getAssociatedTokenAddress(mintPubkey, publicKey);
        const recipientATA = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

        const recipientATAInfo = await connection.getAccountInfo(recipientATA);
        if (!recipientATAInfo) {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              publicKey,
              recipientATA,
              recipientPubkey,
              mintPubkey
            )
          );
        }

        transaction.add(
          createTransferInstruction(senderATA, recipientATA, publicKey, BigInt(rawAmount))
        );
      }

      const signature = await sendTransaction(transaction, connection);
      const confirmed = await connection.confirmTransaction(signature, 'confirmed');
      if (confirmed.value.err) throw new Error('Transaction failed on-chain');

      await apiFetch(`/scheduler/executions/${exec.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ signature }),
      });

      showToast('success', t('scheduled.execution.approveSuccess'));
      fetchExecutions();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('scheduled.execution.txFailed'));
    } finally {
      setProcessing(null);
    }
  };

  const handleApproveDCA = async (exec: PendingExecution) => {
    if (!publicKey) return;
    setProcessing(exec.id);

    try {
      // Get unsigned swap tx from API
      const { swapTransaction } = await apiFetch<{ swapTransaction: string }>(
        `/scheduler/executions/${exec.id}/dca-tx`
      );

      // Deserialize, sign, send
      const txBuffer = Buffer.from(swapTransaction, 'base64');
      const transaction = Transaction.from(txBuffer);

      const signature = await sendTransaction(transaction, connection);
      const confirmed = await connection.confirmTransaction(signature, 'confirmed');
      if (confirmed.value.err) throw new Error('Transaction failed on-chain');

      await apiFetch(`/scheduler/executions/${exec.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ signature }),
      });

      showToast('success', t('scheduled.execution.approveSuccess'));
      fetchExecutions();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('scheduled.execution.txFailed'));
    } finally {
      setProcessing(null);
    }
  };

  const handleSkip = async (id: string) => {
    setProcessing(id);
    try {
      await apiFetch(`/scheduler/executions/${id}/skip`, { method: 'POST' });
      showToast('success', t('scheduled.execution.skipSuccess'));
      fetchExecutions();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setProcessing(null);
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('scheduled.connectPrompt')}</p>
      </div>
    );
  }

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
        <div>
          <h1 className="text-2xl font-bold">{t('scheduled.pending')}</h1>
          <p className="text-sm text-gray-400">{t('scheduled.title')}</p>
        </div>
      </div>

      {/* Quick nav */}
      <div className="flex gap-3">
        <Link
          to="/scheduled/payments"
          className="flex-1 card py-3 text-center text-sm hover:bg-white/10 transition"
        >
          {t('scheduled.payments')}
        </Link>
        <Link
          to="/scheduled/dca"
          className="flex-1 card py-3 text-center text-sm hover:bg-white/10 transition"
        >
          {t('scheduled.dcaLabel')}
        </Link>
      </div>

      {/* Pending executions */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : executions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">{t('scheduled.noPending')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {executions.map((exec) => {
            const remaining = getTimeRemaining(exec.expiresAt);
            const isExpired = !remaining;

            return (
              <div key={exec.id} className="card space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      exec.type === 'PAYMENT'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-teal-500/20 text-teal-400'
                    }`}
                  >
                    {exec.type === 'PAYMENT' ? t('scheduled.payments') : 'DCA'}
                  </span>
                  {isExpired ? (
                    <span className="text-[10px] text-red-400">{t('scheduled.expired')}</span>
                  ) : (
                    <span className="text-[10px] text-gray-500">
                      {t('scheduled.expiresIn', remaining)}
                    </span>
                  )}
                </div>

                {/* Details */}
                {exec.type === 'PAYMENT' && exec.payment && (
                  <div>
                    <p className="font-semibold">
                      {formatSmallestUnit(exec.payment.amount, exec.payment.token)}{' '}
                      {exec.payment.token}
                    </p>
                    <p className="text-xs text-gray-400">
                      {t('scheduled.execution.paymentTo', {
                        recipient:
                          exec.payment.recipientLabel ||
                          `${exec.payment.recipientAddress.slice(0, 8)}...`,
                      })}
                    </p>
                    {exec.payment.memo && (
                      <p className="text-xs text-gray-500 mt-1">{exec.payment.memo}</p>
                    )}
                  </div>
                )}

                {exec.type === 'DCA' && exec.dca && (
                  <div>
                    <p className="font-semibold">
                      {formatSmallestUnit(exec.dca.inputAmount, exec.dca.inputToken)}{' '}
                      {exec.dca.inputToken} &rarr; {exec.dca.outputToken}
                    </p>
                    <p className="text-xs text-gray-400">
                      {t('scheduled.execution.dcaSwap', {
                        output: exec.dca.outputToken,
                        input: exec.dca.inputToken,
                      })}
                    </p>
                  </div>
                )}

                {/* Actions */}
                {!isExpired && (
                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        exec.type === 'PAYMENT'
                          ? handleApprovePayment(exec)
                          : handleApproveDCA(exec)
                      }
                      disabled={processing === exec.id}
                      className="flex-1 btn-primary text-sm py-2 disabled:opacity-50"
                    >
                      {processing === exec.id
                        ? t('scheduled.execution.loading')
                        : t('scheduled.approve')}
                    </button>
                    <button
                      onClick={() => handleSkip(exec.id)}
                      disabled={processing === exec.id}
                      className="px-4 py-2 text-sm bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 transition disabled:opacity-50"
                    >
                      {t('scheduled.skip')}
                    </button>
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
