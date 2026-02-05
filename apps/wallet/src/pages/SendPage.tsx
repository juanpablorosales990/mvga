import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { useTranslation } from 'react-i18next';
import FiatValue from '../components/FiatValue';
import TransactionPreviewModal from '../components/TransactionPreviewModal';
import AddressBookModal from '../components/AddressBookModal';

const TOKEN_MINTS: Record<string, { mint: string; decimals: number }> = {
  USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  USDT: { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  MVGA: { mint: 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh', decimals: 9 },
};

export default function SendPage() {
  const { t } = useTranslation();
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('SOL');
  const [sending, setSending] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showAddressBook, setShowAddressBook] = useState(false);

  const [checkingBalance, setCheckingBalance] = useState(false);

  const openPreview = async () => {
    if (!recipient || !amount) {
      setError('Please fill in all fields');
      return;
    }
    try {
      new PublicKey(recipient);
    } catch {
      setError('Invalid recipient address');
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Invalid amount');
      return;
    }

    if (!publicKey) {
      setError('Wallet not connected');
      return;
    }

    // Check balance before opening preview
    setCheckingBalance(true);
    setError(null);
    try {
      if (token === 'SOL') {
        const balance = await connection.getBalance(publicKey);
        const required = Math.floor(amountNum * LAMPORTS_PER_SOL) + 5000; // include tx fee
        if (balance < required) {
          setError(
            `Insufficient SOL balance. You have ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`
          );
          return;
        }
      } else {
        const tokenConfig = TOKEN_MINTS[token];
        if (tokenConfig) {
          const mintPubkey = new PublicKey(tokenConfig.mint);
          const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);
          try {
            const tokenBalance = await connection.getTokenAccountBalance(ata);
            const available = parseFloat(tokenBalance.value.uiAmountString || '0');
            if (available < amountNum) {
              setError(`Insufficient ${token} balance. You have ${available} ${token}`);
              return;
            }
          } catch {
            setError(`No ${token} balance found in your wallet`);
            return;
          }
        }
      }
    } catch {
      // If balance check fails, let the user try anyway
    } finally {
      setCheckingBalance(false);
    }

    setError(null);
    setShowPreview(true);
  };

  const handleSend = async () => {
    setShowPreview(false);
    if (!connected || !publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    if (!recipient || !amount) {
      setError('Please fill in all fields');
      return;
    }

    let recipientPubkey: PublicKey;
    try {
      recipientPubkey = new PublicKey(recipient);
    } catch {
      setError('Invalid recipient address');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Invalid amount');
      return;
    }

    setSending(true);
    setError(null);
    setTxSignature(null);

    try {
      if (token === 'SOL') {
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: recipientPubkey,
            lamports: Math.floor(amountNum * LAMPORTS_PER_SOL),
          })
        );
        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, 'confirmed');
        setTxSignature(signature);
      } else {
        // SPL token transfer
        const tokenConfig = TOKEN_MINTS[token];
        if (!tokenConfig) {
          setError('Unsupported token');
          return;
        }

        const mintPubkey = new PublicKey(tokenConfig.mint);
        const senderATA = await getAssociatedTokenAddress(mintPubkey, publicKey);
        const recipientATA = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

        const transaction = new Transaction();

        // Check if recipient's ATA exists, create if not
        try {
          await connection.getAccountInfo(recipientATA);
        } catch {
          // ATA doesn't exist, we need to create it
        }

        const recipientATAInfo = await connection.getAccountInfo(recipientATA);
        if (!recipientATAInfo) {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              publicKey, // payer
              recipientATA, // ATA address
              recipientPubkey, // owner
              mintPubkey // mint
            )
          );
        }

        const amountInSmallestUnit = BigInt(
          Math.floor(amountNum * Math.pow(10, tokenConfig.decimals))
        );

        transaction.add(
          createTransferInstruction(senderATA, recipientATA, publicKey, amountInSmallestUnit)
        );

        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, 'confirmed');
        setTxSignature(signature);
      }

      setRecipient('');
      setAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setSending(false);
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('send.connectPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('send.title')}</h1>

      <div className="card space-y-4">
        {/* Token Selector */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">{t('send.token')}</label>
          <select
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary-500"
          >
            <option value="SOL">SOL - Solana</option>
            <option value="USDC">USDC - USD Coin</option>
            <option value="MVGA">MVGA - Make Venezuela Great Again</option>
          </select>
        </div>

        {/* Recipient */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-400">{t('send.recipientAddress')}</label>
            <button
              type="button"
              onClick={() => setShowAddressBook(true)}
              className="text-xs text-primary-500 hover:text-primary-400"
            >
              {t('addressBook.title')}
            </button>
          </div>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder={t('send.enterAddress')}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary-500"
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">{t('send.amount')}</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="any"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-16 focus:outline-none focus:border-primary-500"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">{token}</span>
          </div>
          {amount && parseFloat(amount) > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              ≈{' '}
              <FiatValue
                amount={parseFloat(amount)}
                token={token}
                className="text-xs text-gray-500"
              />
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Success Message */}
        {txSignature && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm">
            <p>{t('send.success')}</p>
            <a
              href={`https://solscan.io/tx/${txSignature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View on Solscan
            </a>
          </div>
        )}

        {/* Send Button */}
        <button
          onClick={openPreview}
          disabled={sending || checkingBalance || !recipient || !amount}
          className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending
            ? t('send.sending')
            : checkingBalance
              ? t('common.loading')
              : t('send.sendButton')}
        </button>
      </div>

      <TransactionPreviewModal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={handleSend}
        loading={sending}
        tx={{
          type: 'send',
          recipient,
          amount: parseFloat(amount) || 0,
          token,
          fee: 0.000005,
        }}
      />

      <AddressBookModal
        open={showAddressBook}
        onClose={() => setShowAddressBook(false)}
        onSelect={(addr) => setRecipient(addr)}
      />
    </div>
  );
}
