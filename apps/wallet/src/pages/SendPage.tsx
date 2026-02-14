import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import QRScannerModal from '../components/QRScannerModal';
import UserSearchInput, { type ResolvedUser } from '../components/UserSearchInput';
import { useWalletStore } from '../stores/walletStore';
import { parseSolanaPayUrl } from '../utils/solana-pay';
import { showToast } from '../hooks/useToast';
import { track, AnalyticsEvents } from '../lib/analytics';
import { apiFetch } from '../lib/apiClient';
import ReceiptModal from '../components/ReceiptModal';
import type { ReceiptData } from '../lib/receiptGenerator';

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
  const recentRecipients = useWalletStore((s) => s.recentRecipients);
  const addRecentRecipient = useWalletStore((s) => s.addRecentRecipient);
  const markFirstSend = useWalletStore((s) => s.markFirstSend);
  const recordSpending = useWalletStore((s) => s.recordSpending);
  const addressBook = useWalletStore((s) => s.addressBook);
  const addAddress = useWalletStore((s) => s.addAddress);

  const [searchParams] = useSearchParams();
  const [recipientInput, setRecipientInput] = useState('');
  const [recipient, setRecipient] = useState(''); // resolved wallet address
  const [resolvedUser, setResolvedUser] = useState<ResolvedUser | null>(null);
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('SOL');
  const [note, setNote] = useState('');
  const sentViaUsername = useRef(false);
  const requestId = searchParams.get('requestId');

  // Pre-fill recipient from ?to= query param (e.g., from Contacts page or request inbox)
  useEffect(() => {
    const to = searchParams.get('to');
    if (to) {
      setRecipientInput(to);
      setRecipient(to);
    }
    const amt = searchParams.get('amount');
    if (amt) setAmount(amt);
    const tok = searchParams.get('token');
    if (tok) setToken(tok);
  }, [searchParams]);

  // Handle UserSearchInput resolution
  const handleResolve = useCallback((user: ResolvedUser | null) => {
    setResolvedUser(user);
    setRecipient(user?.walletAddress || '');
  }, []);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showAddressBook, setShowAddressBook] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [saveContactName, setSaveContactName] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const lastSentRecipient = useRef('');
  const lastSentAmount = useRef(0);
  const lastSentToken = useRef('SOL');

  const [checkingBalance, setCheckingBalance] = useState(false);

  // Resolve contact name for current recipient
  const contactMatch = recipient ? addressBook.find((c) => c.address === recipient) : undefined;

  const handleQRScan = useCallback(
    (data: string) => {
      // Try Solana Pay URL first
      const parsed = parseSolanaPayUrl(data);
      if (parsed) {
        setRecipientInput(parsed.address);
        setRecipient(parsed.address);
        if (parsed.amount) setAmount(String(parsed.amount));
        if (parsed.token && parsed.token in TOKEN_MINTS) setToken(parsed.token);
        showToast('success', t('send.qrScanned'));
        return;
      }
      // Try plain base58 address
      try {
        new PublicKey(data);
        setRecipientInput(data);
        setRecipient(data);
        showToast('success', t('send.qrScanned'));
      } catch {
        showToast('error', t('send.invalidQR'));
      }
    },
    [t]
  );

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
              recipientAtaInfo
                ? t('send.insufficientSolForFee')
                : t('send.insufficientSolForFeeAndAta')
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
    if (sendingRef.current) return;
    sendingRef.current = true;
    setShowPreview(false);
    if (!connected || !publicKey) {
      setError(t('send.connectFirst'));
      sendingRef.current = false;
      return;
    }

    if (!recipient || !amount) {
      setError(t('send.fillAllFields'));
      sendingRef.current = false;
      return;
    }

    let recipientPubkey: PublicKey;
    try {
      recipientPubkey = new PublicKey(recipient);
    } catch {
      setError(t('send.invalidAddress'));
      sendingRef.current = false;
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError(t('send.invalidAmount'));
      sendingRef.current = false;
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

      // Track recent recipient + onboarding
      const recipientLabel =
        resolvedUser?.displayName || resolvedUser?.username || contactMatch?.label;
      addRecentRecipient(recipient, recipientLabel || undefined);
      markFirstSend();
      recordSpending(amountNum, token);
      lastSentRecipient.current = recipient;
      lastSentAmount.current = amountNum;
      lastSentToken.current = token;
      sentViaUsername.current = !!resolvedUser?.username;
      track(AnalyticsEvents.SEND_COMPLETED, { token, amount: amountNum });
      if (resolvedUser?.username) {
        track(AnalyticsEvents.SEND_TO_USERNAME, {
          username: resolvedUser.username,
          token,
          amount: amountNum,
        });
      }

      // Verify request payment if this send came from a request inbox
      if (requestId && txSignature) {
        apiFetch(`/payments/request/${requestId}/verify`, {
          method: 'POST',
          body: JSON.stringify({ signature: txSignature }),
        }).catch(() => {}); // Non-blocking
      }

      setRecipientInput('');
      setRecipient('');
      setResolvedUser(null);
      setAmount('');
      setNote('');
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
        <p className="text-gray-400">{t('send.connectPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-gray-400 hover:text-white" aria-label={t('common.back')}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold">{t('send.title')}</h1>
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
            <option value="SOL">{t('send.solLabel')}</option>
            <option value="USDC">{t('send.usdcLabel')}</option>
            <option value="MVGA">{t('send.mvgaLabel')}</option>
          </select>
        </div>

        {/* Recipient — @username, #citizen, or Solana address */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">{t('send.recipientAddress')}</label>
              {searchParams.get('to') && recipientInput === searchParams.get('to') && (
                <span className="text-[10px] px-1.5 py-0.5 bg-gold-500/20 text-gold-400 rounded">
                  {t('send.fromContacts')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="text-xs text-gold-500 hover:text-gold-400"
              >
                {t('send.scanQR')}
              </button>
              <button
                type="button"
                onClick={() => setShowAddressBook(true)}
                className="text-xs text-gold-500 hover:text-gold-400"
              >
                {t('addressBook.title')}
              </button>
            </div>
          </div>
          <UserSearchInput
            value={recipientInput}
            onChange={setRecipientInput}
            onResolve={handleResolve}
          />
          {/* Contact name display (for raw address matches) */}
          {contactMatch && !resolvedUser && (
            <p className="text-xs text-gold-400 mt-1">
              {t('send.sendingTo', { name: contactMatch.label })}
            </p>
          )}
        </div>

        {/* Recent Recipients */}
        {recentRecipients.length > 0 && !recipientInput && (
          <div>
            <label className="block text-xs text-gray-500 mb-2">{t('send.recentRecipients')}</label>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {recentRecipients.map((r) => {
                const bookEntry = addressBook.find((c) => c.address === r.address);
                const displayLabel = bookEntry?.label || r.label;
                return (
                  <button
                    key={r.address}
                    onClick={() => {
                      setRecipientInput(r.address);
                      setRecipient(r.address);
                    }}
                    className="flex-shrink-0 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs text-gray-300 hover:bg-white/10 hover:border-white/20 transition"
                  >
                    {displayLabel || `${r.address.slice(0, 4)}...${r.address.slice(-4)}`}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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

        {/* Note (optional) */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">{t('send.note')}</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('send.notePlaceholder')}
            maxLength={100}
            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-gold-500"
          />
        </div>

        {/* Request context banner */}
        {requestId && (
          <div className="bg-gold-500/10 border border-gold-500/20 px-4 py-2 text-gold-400 text-xs rounded">
            {t('send.payingRequest')}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Success Message */}
        {txSignature && (
          <div className="bg-green-500/10 border border-green-500/30 px-4 py-3 text-green-400 text-sm space-y-2">
            <p>{t('send.success')}</p>
            <div className="flex gap-3">
              <a
                href={`https://solscan.io/tx/${txSignature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {t('common.viewOnSolscan')}
              </a>
              <button onClick={() => setShowReceipt(true)} className="text-gold-400 underline">
                {t('receipt.viewReceipt')}
              </button>
            </div>
            {/* Save to contacts prompt */}
            {lastSentRecipient.current &&
              !addressBook.find((c) => c.address === lastSentRecipient.current) && (
                <div className="flex gap-2 items-center mt-2 pt-2 border-t border-green-500/20">
                  <input
                    type="text"
                    value={saveContactName}
                    onChange={(e) => setSaveContactName(e.target.value)}
                    placeholder={t('contacts.namePlaceholder')}
                    className="flex-1 bg-white/10 px-2 py-1.5 text-white text-xs"
                  />
                  <button
                    onClick={() => {
                      if (saveContactName.trim()) {
                        addAddress({
                          label: saveContactName.trim(),
                          address: lastSentRecipient.current,
                        });
                        setSaveContactName('');
                        showToast('success', t('send.contactSaved'));
                      }
                    }}
                    disabled={!saveContactName.trim()}
                    className="text-xs px-3 py-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 transition disabled:opacity-40"
                  >
                    {t('send.saveContact')}
                  </button>
                </div>
              )}
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

        {/* Batch Send Link */}
        <Link
          to="/batch-send"
          className="block text-center text-xs text-gray-500 hover:text-gray-300 transition"
        >
          {t('send.batchSend')} →
        </Link>
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
        onSelect={(addr) => {
          setRecipientInput(addr);
          setRecipient(addr);
        }}
      />

      <QRScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQRScan}
      />

      {txSignature && publicKey && (
        <ReceiptModal
          open={showReceipt}
          onClose={() => setShowReceipt(false)}
          data={{
            signature: txSignature,
            timestamp: Math.floor(Date.now() / 1000),
            type: 'TRANSFER',
            amount: lastSentAmount.current,
            token: lastSentToken.current,
            isOutgoing: true,
            counterparty: lastSentRecipient.current,
            status: 'CONFIRMED',
          }}
          walletAddress={publicKey.toBase58()}
        />
      )}
    </div>
  );
}
