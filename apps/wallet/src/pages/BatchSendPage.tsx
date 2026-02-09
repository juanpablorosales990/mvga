import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useConnection } from '@solana/wallet-adapter-react';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { useTranslation } from 'react-i18next';
import { useWalletStore } from '../stores/walletStore';
import { showToast } from '../hooks/useToast';

const TOKEN_MINTS: Record<string, { mint: string; decimals: number }> = {
  USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  USDT: { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  MVGA: { mint: 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh', decimals: 9 },
};

const MAX_RECIPIENTS = 15;

interface RecipientRow {
  id: string;
  address: string;
  amount: string;
}

function newRow(): RecipientRow {
  return { id: crypto.randomUUID(), address: '', amount: '' };
}

export default function BatchSendPage() {
  const { t } = useTranslation();
  const { connected, publicKey, sendTransaction } = useSelfCustodyWallet();
  const { connection } = useConnection();
  const invalidateBalances = useWalletStore((s) => s.invalidateBalances);
  const addRecentRecipient = useWalletStore((s) => s.addRecentRecipient);
  const addressBook = useWalletStore((s) => s.addressBook);

  const [token, setToken] = useState('SOL');
  const [rows, setRows] = useState<RecipientRow[]>([newRow()]);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [showContactPicker, setShowContactPicker] = useState<string | null>(null);

  const updateRow = (id: string, field: 'address' | 'amount', value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const removeRow = (id: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const addRow = () => {
    if (rows.length < MAX_RECIPIENTS) {
      setRows((prev) => [...prev, newRow()]);
    }
  };

  const totalAmount = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  const handleSend = async () => {
    if (sendingRef.current || !connected || !publicKey) return;

    // Validate
    const validRows = rows.filter((r) => r.address && r.amount);
    if (validRows.length === 0) {
      setError(t('batchSend.noRecipients'));
      return;
    }

    for (const row of validRows) {
      try {
        new PublicKey(row.address);
      } catch {
        setError(`${t('send.invalidAddress')}: ${row.address.slice(0, 12)}...`);
        return;
      }
      const amt = parseFloat(row.amount);
      if (isNaN(amt) || amt <= 0) {
        setError(t('send.invalidAmount'));
        return;
      }
    }

    sendingRef.current = true;
    setSending(true);
    setError(null);
    setTxSignature(null);

    try {
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      const instructions = [];

      if (token === 'SOL') {
        for (const row of validRows) {
          const recipientPubkey = new PublicKey(row.address);
          const lamports = Math.floor(parseFloat(row.amount) * LAMPORTS_PER_SOL);
          instructions.push(
            SystemProgram.transfer({
              fromPubkey: publicKey,
              toPubkey: recipientPubkey,
              lamports,
            })
          );
        }
      } else {
        const tokenConfig = TOKEN_MINTS[token];
        if (!tokenConfig) {
          setError(t('send.unsupportedToken'));
          return;
        }
        const mintPubkey = new PublicKey(tokenConfig.mint);
        const senderATA = await getAssociatedTokenAddress(mintPubkey, publicKey);

        for (const row of validRows) {
          const recipientPubkey = new PublicKey(row.address);
          const recipientATA = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

          const ataInfo = await connection.getAccountInfo(recipientATA);
          if (!ataInfo) {
            instructions.push(
              createAssociatedTokenAccountInstruction(
                publicKey,
                recipientATA,
                recipientPubkey,
                mintPubkey
              )
            );
          }

          const [whole, fraction = ''] = row.amount.split('.');
          const paddedFraction = fraction
            .padEnd(tokenConfig.decimals, '0')
            .slice(0, tokenConfig.decimals);
          const amountInSmallestUnit = BigInt(whole + paddedFraction);

          instructions.push(
            createTransferInstruction(senderATA, recipientATA, publicKey, amountInSmallestUnit)
          );
        }
      }

      // Build versioned transaction
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const versionedTx = new VersionedTransaction(messageV0);

      const signature = await sendTransaction(versionedTx as unknown as Transaction, connection);
      const confirmed = await connection.confirmTransaction(signature, 'confirmed');
      if (confirmed.value.err) {
        throw new Error('Transaction failed on-chain');
      }

      setTxSignature(signature);
      showToast('success', t('batchSend.success', { count: validRows.length }));

      // Track recent recipients
      for (const row of validRows) {
        const contact = addressBook.find((c) => c.address === row.address);
        addRecentRecipient(row.address, contact?.label);
      }

      setRows([newRow()]);
      invalidateBalances();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('send.txFailed'));
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('batchSend.connectPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/send" className="text-gray-400 hover:text-white">
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
          <h1 className="text-2xl font-bold">{t('batchSend.title')}</h1>
          <p className="text-sm text-gray-400">{t('batchSend.subtitle')}</p>
        </div>
      </div>

      <div className="card space-y-4">
        {/* Token Selector */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">{t('send.token')}</label>
          <select
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold-500"
          >
            <option value="SOL">SOL</option>
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
            <option value="MVGA">MVGA</option>
          </select>
        </div>

        {/* Recipient Rows */}
        {rows.map((row, idx) => (
          <div
            key={row.id}
            className="space-y-2 p-3 bg-white/[0.02] border border-white/5 rounded-lg"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {t('batchSend.recipient', { number: idx + 1 })}
              </span>
              <div className="flex items-center gap-2">
                {/* Pick from contacts */}
                <button
                  type="button"
                  onClick={() => setShowContactPicker(row.id)}
                  className="text-[10px] text-gold-500 hover:text-gold-400"
                >
                  {t('batchSend.importFromContacts')}
                </button>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="text-[10px] text-red-400 hover:text-red-300"
                  >
                    {t('batchSend.removeRecipient')}
                  </button>
                )}
              </div>
            </div>
            <input
              type="text"
              value={row.address}
              onChange={(e) => updateRow(row.id, 'address', e.target.value)}
              placeholder={t('send.enterAddress')}
              className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
            />
            <input
              type="number"
              value={row.amount}
              onChange={(e) => updateRow(row.id, 'amount', e.target.value)}
              placeholder="0.00"
              step="any"
              className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
            />

            {/* Contact picker dropdown */}
            {showContactPicker === row.id && addressBook.length > 0 && (
              <div className="bg-[#1a1a2e] border border-white/10 rounded-lg max-h-32 overflow-y-auto">
                {addressBook.map((c) => (
                  <button
                    key={c.address}
                    onClick={() => {
                      updateRow(row.id, 'address', c.address);
                      setShowContactPicker(null);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition"
                  >
                    <span className="text-gray-300">{c.label}</span>
                    <span className="text-gray-600 ml-2 text-xs">{c.address.slice(0, 8)}...</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Add Recipient */}
        {rows.length < MAX_RECIPIENTS ? (
          <button
            onClick={addRow}
            className="w-full py-2 border border-dashed border-white/20 text-gray-400 text-sm hover:bg-white/5 transition"
          >
            + {t('batchSend.addRecipient')}
          </button>
        ) : (
          <p className="text-xs text-gray-500 text-center">{t('batchSend.maxRecipients')}</p>
        )}

        {/* Total */}
        {totalAmount > 0 && (
          <div className="flex items-center justify-between py-2 border-t border-white/10">
            <span className="text-sm text-gray-400">{t('batchSend.totalAmount')}</span>
            <span className="text-sm font-semibold">
              {totalAmount.toLocaleString('en-US', { maximumFractionDigits: 6 })} {token}
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Success */}
        {txSignature && (
          <div className="bg-green-500/10 border border-green-500/30 px-4 py-3 text-green-400 text-sm">
            <p>{t('batchSend.success', { count: rows.length })}</p>
            <a
              href={`https://solscan.io/tx/${txSignature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {t('common.viewOnSolscan')}
            </a>
          </div>
        )}

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={sending || totalAmount === 0}
          className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending
            ? t('batchSend.sending', { count: rows.filter((r) => r.address && r.amount).length })
            : t('batchSend.preview')}
        </button>
      </div>
    </div>
  );
}
