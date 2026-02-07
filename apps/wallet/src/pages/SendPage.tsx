import { useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { useTranslation } from 'react-i18next';
import FiatValue from '../components/FiatValue';
import TransactionPreviewModal from '../components/TransactionPreviewModal';
import AddressBookModal from '../components/AddressBookModal';
import { useWalletStore } from '../stores/walletStore';

const TOKEN_MINTS: Record<string, { mint: string; decimals: number }> = {
  USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  USDT: { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  MVGA: { mint: 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh', decimals: 9 },
};

export default function SendPage() {
  const { t } = useTranslation();
  const { connected, publicKey, sendTransaction } = useSelfCustodyWallet();
  const { connection } = useConnection();
  const invalidateBalances = useWalletStore((s) => s.invalidateBalances);

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
      setError(t('send.fillAllFields'));
      return;
    }
    try {
      new PublicKey(recipient);
    } catch {
      setError(t('send.invalidAddress'));
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError(t('send.invalidAmount'));
      return;
    }

    if (!publicKey) {
      setError(t('send.walletNotConnected'));
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
          setError(t('send.insufficientSol', { balance: (balance / LAMPORTS_PER_SOL).toFixed(4) }));
          return;
        }
      } else {
        const tokenConfig = TOKEN_MINTS[token];
        if (tokenConfig) {
          const mintPubkey = new PublicKey(tokenConfig.mint);
          const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);
          try {
            const tokenBalance = await connection.getTokenAccountBalance(ata);
            // Use raw BigInt comparison to avoid floating-point precision loss
            const availableRaw = BigInt(tokenBalance.value.amount);
            const [whole, fraction = ''] = amount.split('.');
            const paddedFraction = fraction
              .padEnd(tokenConfig.decimals, '0')
              .slice(0, tokenConfig.decimals);
            const requestedRaw = BigInt(whole + paddedFraction);
            if (requestedRaw > availableRaw) {
              const available = parseFloat(tokenBalance.value.uiAmountString || '0');
              setError(t('send.insufficientToken', { token, available }));
              return;
            }
          } catch {
            setError(t('send.noTokenBalance', { token }));
            return;
          }

          // Check SOL balance for tx fee + potential ATA creation (~0.002 SOL rent)
          const recipientPubkey = new PublicKey(recipient);
          const recipientAta = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);
          const recipientAtaInfo = await connection.getAccountInfo(recipientAta);
          const solBalance = await connection.getBalance(publicKey);
          const requiredSol = recipientAtaInfo ? 5000 : 2_039_280 + 5000; // rent-exempt minimum + tx fee
          if (solBalance < requiredSol) {
            setError(
              t('send.insufficientSolForFee', {
                defaultValue:
                  'Not enough SOL for transaction fee' +
                  (recipientAtaInfo ? '' : ' + token account creation (~0.002 SOL)'),
              })
            );
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
      setError(t('send.connectFirst'));
      return;
    }

    if (!recipient || !amount) {
      setError(t('send.fillAllFields'));
      return;
    }

    let recipientPubkey: PublicKey;
    try {
      recipientPubkey = new PublicKey(recipient);
    } catch {
      setError(t('send.invalidAddress'));
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError(t('send.invalidAmount'));
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
        const solConfirm = await connection.confirmTransaction(signature, 'confirmed');
        if (solConfirm.value.err) {
          throw new Error('Transaction failed on-chain');
        }
        setTxSignature(signature);
      } else {
        // SPL token transfer
        const tokenConfig = TOKEN_MINTS[token];
        if (!tokenConfig) {
          setError(t('send.unsupportedToken'));
          return;
        }

        const mintPubkey = new PublicKey(tokenConfig.mint);
        const senderATA = await getAssociatedTokenAddress(mintPubkey, publicKey);
        const recipientATA = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

        const transaction = new Transaction();

        // Check if recipient's ATA exists, create if not
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

        // Parse amount string directly to avoid floating-point precision loss
        const [whole, fraction = ''] = amount.split('.');
        const paddedFraction = fraction
          .padEnd(tokenConfig.decimals, '0')
          .slice(0, tokenConfig.decimals);
        const amountInSmallestUnit = BigInt(whole + paddedFraction);

        transaction.add(
          createTransferInstruction(senderATA, recipientATA, publicKey, amountInSmallestUnit)
        );

        const signature = await sendTransaction(transaction, connection);
        const splConfirm = await connection.confirmTransaction(signature, 'confirmed');
        if (splConfirm.value.err) {
          throw new Error('Transaction failed on-chain');
        }
        setTxSignature(signature);
      }

      setRecipient('');
      setAmount('');
      invalidateBalances();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('send.txFailed'));
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
            className="w-full bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold-500"
          >
            <option value="SOL">{t('send.solLabel')}</option>
            <option value="USDC">{t('send.usdcLabel')}</option>
            <option value="MVGA">{t('send.mvgaLabel')}</option>
          </select>
        </div>

        {/* Recipient */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-400">{t('send.recipientAddress')}</label>
            <button
              type="button"
              onClick={() => setShowAddressBook(true)}
              className="text-xs text-gold-500 hover:text-gold-400"
            >
              {t('addressBook.title')}
            </button>
          </div>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder={t('send.enterAddress')}
            className="w-full bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold-500"
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
              className="w-full bg-white/5 border border-white/10 px-4 py-3 pr-16 focus:outline-none focus:border-gold-500"
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
          <div className="bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Success Message */}
        {txSignature && (
          <div className="bg-green-500/10 border border-green-500/30 px-4 py-3 text-green-400 text-sm">
            <p>{t('send.success')}</p>
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
