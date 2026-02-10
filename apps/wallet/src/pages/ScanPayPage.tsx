import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnection } from '@solana/wallet-adapter-react';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { buildSolanaPayUrl, parseSolanaPayUrl, SUPPORTED_TOKENS } from '../utils/solana-pay';
import { startScanner } from '../utils/qr-scanner';
import TransactionPreviewModal from '../components/TransactionPreviewModal';
import FiatValue from '../components/FiatValue';
import { useWalletStore } from '../stores/walletStore';
import { showToast } from '../hooks/useToast';
import { API_URL } from '../config';

const TOKEN_MINTS: Record<string, { mint: string; decimals: number }> = {
  USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  USDT: { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  MVGA: { mint: 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh', decimals: 9 },
};

type Tab = 'scan' | 'myqr';

interface ScannedData {
  address: string;
  amount?: number;
  token?: string;
  memo?: string;
}

export default function ScanPayPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { connected, publicKey, sendTransaction } = useSelfCustodyWallet();
  const { connection } = useConnection();
  const invalidateBalances = useWalletStore((s) => s.invalidateBalances);
  const addRecentRecipient = useWalletStore((s) => s.addRecentRecipient);
  const markFirstSend = useWalletStore((s) => s.markFirstSend);
  const addressBook = useWalletStore((s) => s.addressBook);
  const addAddress = useWalletStore((s) => s.addAddress);

  const [tab, setTab] = useState<Tab>('scan');

  // --- Scan tab state ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraError, setCameraError] = useState(false);
  const [scanned, setScanned] = useState<ScannedData | null>(null);
  const [manualAmount, setManualAmount] = useState('');
  const [manualToken, setManualToken] = useState('USDC');
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [saveContactName, setSaveContactName] = useState('');

  // --- My QR tab state ---
  const [showAmountFields, setShowAmountFields] = useState(false);
  const [requestToken, setRequestToken] = useState('');
  const [requestAmount, setRequestAmount] = useState('');
  const [copied, setCopied] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [paymentLinkCopied, setPaymentLinkCopied] = useState(false);

  const address = publicKey?.toBase58() || '';

  // Start scanner when scan tab is active
  useEffect(() => {
    if (tab !== 'scan' || scanned || txSignature) return;

    const videoEl = videoRef.current;
    const canvasEl = canvasRef.current;
    if (!videoEl || !canvasEl) return;

    setCameraError(false);
    let cleanup: (() => void) | undefined;

    const timer = setTimeout(() => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(true);
        return;
      }

      cleanup = startScanner(videoEl, canvasEl, (data) => {
        handleScanResult(data);
      });

      // Detect permission denial
      const permTimer = setTimeout(() => {
        if (videoEl.readyState < videoEl.HAVE_ENOUGH_DATA) {
          setCameraError(true);
        }
      }, 5000);

      const origCleanup = cleanup;
      cleanup = () => {
        clearTimeout(permTimer);
        origCleanup?.();
      };
    }, 100);

    return () => {
      clearTimeout(timer);
      cleanup?.();
    };
  }, [tab, scanned, txSignature]);

  const handleScanResult = useCallback(
    (data: string) => {
      // Check for MVGA payment link
      const payLinkMatch = data.match(/\/pay\/([a-zA-Z0-9-]+)/);
      if (payLinkMatch) {
        navigate(`/pay/${payLinkMatch[1]}`);
        return;
      }

      // Try Solana Pay URL
      const parsed = parseSolanaPayUrl(data);
      if (parsed) {
        setScanned({
          address: parsed.address,
          amount: parsed.amount,
          token: parsed.token,
          memo: parsed.memo,
        });
        if (parsed.amount) setManualAmount(String(parsed.amount));
        if (parsed.token) setManualToken(parsed.token);
        showToast('success', t('scan.scanned'));
        return;
      }

      // Try plain base58 address
      try {
        new PublicKey(data);
        setScanned({ address: data });
        showToast('success', t('scan.scanned'));
      } catch {
        showToast('error', t('scan.invalidQr'));
      }
    },
    [navigate, t]
  );

  const resetScan = () => {
    setScanned(null);
    setManualAmount('');
    setManualToken('USDC');
    setTxSignature(null);
    setShowPreview(false);
  };

  const effectiveAmount = scanned?.amount || parseFloat(manualAmount) || 0;
  const effectiveToken = scanned?.token || manualToken;

  const openPreview = () => {
    if (!scanned || effectiveAmount <= 0) {
      showToast('error', t('send.fillAllFields'));
      return;
    }
    setShowPreview(true);
  };

  const handlePay = async () => {
    if (sendingRef.current || !scanned || !publicKey) return;
    sendingRef.current = true;
    setShowPreview(false);
    setSending(true);

    try {
      const recipientPubkey = new PublicKey(scanned.address);
      const token = effectiveToken;
      const amount = effectiveAmount;

      if (token === 'SOL') {
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: recipientPubkey,
            lamports: Math.floor(amount * LAMPORTS_PER_SOL),
          })
        );
        const signature = await sendTransaction(transaction, connection);
        const confirm = await connection.confirmTransaction(signature, 'confirmed');
        if (confirm.value.err) throw new Error('Transaction failed on-chain');
        setTxSignature(signature);
      } else {
        const tokenConfig = TOKEN_MINTS[token];
        if (!tokenConfig) throw new Error('Unsupported token');

        const mintPubkey = new PublicKey(tokenConfig.mint);
        const senderATA = await getAssociatedTokenAddress(mintPubkey, publicKey);
        const recipientATA = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

        const transaction = new Transaction();

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

        const amountStr = String(amount);
        const [whole, fraction = ''] = amountStr.split('.');
        const paddedFraction = fraction
          .padEnd(tokenConfig.decimals, '0')
          .slice(0, tokenConfig.decimals);
        const amountInSmallestUnit = BigInt(whole + paddedFraction);

        transaction.add(
          createTransferInstruction(senderATA, recipientATA, publicKey, amountInSmallestUnit)
        );

        const signature = await sendTransaction(transaction, connection);
        const confirm = await connection.confirmTransaction(signature, 'confirmed');
        if (confirm.value.err) throw new Error('Transaction failed on-chain');
        setTxSignature(signature);
      }

      // Track recipient
      const contactMatch = addressBook.find((c) => c.address === scanned.address);
      addRecentRecipient(scanned.address, contactMatch?.label);
      markFirstSend();
      invalidateBalances();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('send.txFailed'));
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  };

  // --- My QR helpers ---
  const hasRequestAmount = requestAmount && parseFloat(requestAmount) > 0;
  const qrValue = hasRequestAmount
    ? buildSolanaPayUrl(address, { token: requestToken || 'SOL', amount: requestAmount })
    : address;

  const handleCopyAddress = async () => {
    const value = hasRequestAmount ? qrValue : address;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleShare = async () => {
    if (!navigator.share || !address) return;
    try {
      await navigator.share({
        title: 'MVGA Wallet',
        text: hasRequestAmount
          ? t('charge.shareText', { amount: requestAmount, token: requestToken || 'SOL' })
          : address,
        url: hasRequestAmount ? qrValue : undefined,
      });
    } catch {}
  };

  const handleCreatePaymentLink = async () => {
    if (!hasRequestAmount) return;
    setCreatingLink(true);
    try {
      const res = await fetch(`${API_URL}/payments/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          token: requestToken || 'SOL',
          amount: parseFloat(requestAmount),
        }),
      });
      if (!res.ok) throw new Error('Failed to create payment link');
      const data = await res.json();
      const fullUrl = `${window.location.origin}/pay/${data.id}`;
      await navigator.clipboard.writeText(fullUrl);
      setPaymentLinkCopied(true);
      setTimeout(() => setPaymentLinkCopied(false), 3000);
    } catch {
      showToast('error', t('common.somethingWrong'));
    } finally {
      setCreatingLink(false);
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('scan.connectPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('scan')}
          className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider border transition ${
            tab === 'scan'
              ? 'border-gold-500 bg-gold-500/10 text-gold-500'
              : 'border-white/10 text-white/40'
          }`}
        >
          {t('scan.tabScan')}
        </button>
        <button
          onClick={() => setTab('myqr')}
          className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider border transition ${
            tab === 'myqr'
              ? 'border-gold-500 bg-gold-500/10 text-gold-500'
              : 'border-white/10 text-white/40'
          }`}
        >
          {t('scan.tabMyQr')}
        </button>
      </div>

      {/* ========== SCAN TAB ========== */}
      {tab === 'scan' && (
        <>
          {/* Success state */}
          {txSignature && (
            <div className="card space-y-4 text-center py-8">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <svg
                  className="w-8 h-8 text-green-400"
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
              </div>
              <p className="text-lg font-bold text-green-400">{t('scan.paySuccess')}</p>
              <a
                href={`https://solscan.io/tx/${txSignature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gold-500 underline"
              >
                {t('common.viewOnSolscan')}
              </a>
              {/* Save to contacts */}
              {scanned && !addressBook.find((c) => c.address === scanned.address) && (
                <div className="flex gap-2 items-center w-full px-2">
                  <input
                    type="text"
                    value={saveContactName}
                    onChange={(e) => setSaveContactName(e.target.value)}
                    placeholder={t('contacts.namePlaceholder')}
                    className="flex-1 bg-white/10 px-2 py-1.5 text-white text-xs text-left"
                  />
                  <button
                    onClick={() => {
                      if (saveContactName.trim() && scanned) {
                        addAddress({ label: saveContactName.trim(), address: scanned.address });
                        setSaveContactName('');
                        showToast('success', t('send.contactSaved'));
                      }
                    }}
                    disabled={!saveContactName.trim()}
                    className="text-xs px-3 py-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 transition disabled:opacity-40 flex-shrink-0"
                  >
                    {t('send.saveContact')}
                  </button>
                </div>
              )}
              <button onClick={resetScan} className="btn-primary w-full">
                {t('scan.scanAnother')}
              </button>
            </div>
          )}

          {/* Scanned — confirmation card */}
          {scanned && !txSignature && (
            <div className="card space-y-4">
              <h3 className="font-bold">{t('scan.recipientDetected')}</h3>

              <div className="bg-white/5 p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">{t('send.recipientAddress')}</span>
                  <span className="font-mono text-xs">
                    {scanned.address.slice(0, 6)}...{scanned.address.slice(-4)}
                  </span>
                </div>
                {scanned.memo && (
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">{t('pay.memo')}</span>
                    <span className="text-white/70">{scanned.memo}</span>
                  </div>
                )}
              </div>

              {/* Amount — pre-filled or manual */}
              {!scanned.amount && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">{t('send.token')}</label>
                    <select
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      className="w-full bg-white/10 px-3 py-2 text-white text-sm"
                    >
                      <option value="SOL" className="bg-gray-900">
                        SOL
                      </option>
                      <option value="USDC" className="bg-gray-900">
                        USDC
                      </option>
                      <option value="USDT" className="bg-gray-900">
                        USDT
                      </option>
                      <option value="MVGA" className="bg-gray-900">
                        MVGA
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">
                      {t('scan.enterAmount')}
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white/10 px-3 py-2 text-white text-lg"
                      min="0"
                      step="any"
                    />
                    {manualAmount && parseFloat(manualAmount) > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {'≈ '}
                        <FiatValue
                          amount={parseFloat(manualAmount)}
                          token={manualToken}
                          className="text-xs text-gray-500"
                        />
                      </p>
                    )}
                  </div>
                </div>
              )}

              {scanned.amount && (
                <div className="text-center py-2">
                  <p className="text-3xl font-black">
                    {scanned.amount} <span className="text-lg text-white/60">{effectiveToken}</span>
                  </p>
                  <FiatValue
                    amount={scanned.amount}
                    token={effectiveToken}
                    className="text-sm text-gray-500"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={resetScan}
                  className="flex-1 py-3 bg-white/10 text-gray-300 font-medium text-sm hover:bg-white/20 transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={openPreview}
                  disabled={sending || effectiveAmount <= 0}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {sending ? t('scan.paying') : t('scan.confirmPay')}
                </button>
              </div>
            </div>
          )}

          {/* Camera viewport — only show when scanning */}
          {!scanned && !txSignature && (
            <div className="relative aspect-square bg-black overflow-hidden">
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Scan frame overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-56 h-56 border-2 border-white/30 rounded-2xl">
                  <div className="absolute -top-px -left-px w-8 h-8 border-t-2 border-l-2 border-gold-500 rounded-tl-2xl" />
                  <div className="absolute -top-px -right-px w-8 h-8 border-t-2 border-r-2 border-gold-500 rounded-tr-2xl" />
                  <div className="absolute -bottom-px -left-px w-8 h-8 border-b-2 border-l-2 border-gold-500 rounded-bl-2xl" />
                  <div className="absolute -bottom-px -right-px w-8 h-8 border-b-2 border-r-2 border-gold-500 rounded-br-2xl" />
                </div>
              </div>

              {/* Hint text */}
              <p className="absolute bottom-4 left-0 right-0 text-center text-gray-400 text-sm">
                {t('scan.scanning')}
              </p>

              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <p className="text-red-400 text-sm text-center px-8">
                    {t('scan.cameraPermission')}
                  </p>
                </div>
              )}
            </div>
          )}

          <TransactionPreviewModal
            open={showPreview}
            onClose={() => setShowPreview(false)}
            onConfirm={handlePay}
            loading={sending}
            tx={{
              type: 'send',
              recipient: scanned?.address,
              amount: effectiveAmount,
              token: effectiveToken,
              fee: 0.000005,
            }}
          />
        </>
      )}

      {/* ========== MY QR TAB ========== */}
      {tab === 'myqr' && (
        <>
          {/* Optional amount fields */}
          <div className="card">
            <button
              onClick={() => setShowAmountFields(!showAmountFields)}
              className="w-full flex items-center justify-between text-sm"
            >
              <span className="text-white/60">{t('scan.showAmount')}</span>
              <span className="text-gold-500">{showAmountFields ? '−' : '+'}</span>
            </button>
            {showAmountFields && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">
                    {t('receive.tokenSelect')}
                  </label>
                  <select
                    value={requestToken}
                    onChange={(e) => setRequestToken(e.target.value)}
                    className="w-full bg-white/10 px-3 py-2 text-white text-sm"
                  >
                    <option value="" className="bg-gray-900">
                      SOL
                    </option>
                    {Object.keys(SUPPORTED_TOKENS).map((tok) => (
                      <option key={tok} value={tok} className="bg-gray-900">
                        {tok}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">
                    {t('receive.amountInput')}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={requestAmount}
                    onChange={(e) => setRequestAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white/10 px-3 py-2 text-white text-sm"
                    min="0"
                    step="any"
                  />
                </div>
              </div>
            )}
          </div>

          {/* QR Code */}
          <div className="card flex flex-col items-center py-8">
            <div className="bg-white p-4 mb-6">
              <QRCodeSVG value={qrValue} size={200} level="H" />
            </div>

            <p className="text-gray-400 text-sm mb-2">{t('receive.yourAddress')}</p>
            <p className="text-sm text-center break-all px-4 mb-4 font-mono">{address}</p>

            {/* Actions */}
            <div className="flex gap-3 w-full px-4">
              <button onClick={handleCopyAddress} className="flex-1 btn-secondary text-sm">
                {copied ? t('scan.copied') : t('scan.copyAddress')}
              </button>
              {typeof navigator.share === 'function' && (
                <button
                  onClick={handleShare}
                  className="flex-1 bg-white/10 text-white py-3 font-medium text-sm hover:bg-white/20 transition"
                >
                  {t('scan.shareQr')}
                </button>
              )}
            </div>

            {/* Payment link */}
            {hasRequestAmount && (
              <button
                onClick={handleCreatePaymentLink}
                disabled={creatingLink}
                className="mt-3 w-full mx-4 btn-primary text-sm"
              >
                {paymentLinkCopied
                  ? t('scan.paymentLinkCreated')
                  : creatingLink
                    ? t('common.processing')
                    : t('scan.paymentLink')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
