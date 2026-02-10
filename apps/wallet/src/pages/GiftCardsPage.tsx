import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useConnection } from '@solana/wallet-adapter-react';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../hooks/useToast';
import { track, AnalyticsEvents } from '../lib/analytics';
import { PublicKey, Transaction } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddress } from '@solana/spl-token';

interface Product {
  id: string;
  name: string;
  category: string;
  denominations: number[];
  currency: string;
  country: string;
}

interface GiftCardRecord {
  id: string;
  productName: string;
  amountUsd: number;
  code: string | null;
  pin: string | null;
  status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
  createdAt: string;
}

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDC_DECIMALS = 6;
const CATEGORIES = ['all', 'shopping', 'entertainment', 'gaming', 'food'] as const;

function amountToRaw(amount: number): bigint {
  const factor = 10 ** USDC_DECIMALS;
  return BigInt(Math.round(amount * factor));
}

export default function GiftCardsPage() {
  const { t } = useTranslation();
  const { connected, publicKey, sendTransaction } = useSelfCustodyWallet();
  const { connection } = useConnection();

  const [status, setStatus] = useState<{
    enabled: boolean;
    treasuryWallet?: string;
    categories?: string[];
  } | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [deliveredCode, setDeliveredCode] = useState<string | null>(null);
  const [tab, setTab] = useState<'browse' | 'history'>('browse');
  const [history, setHistory] = useState<GiftCardRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load status + products
  useEffect(() => {
    let mounted = true;
    (async () => {
      setStatusLoading(true);
      try {
        const [s, p] = await Promise.all([
          apiFetch<{ enabled: boolean; treasuryWallet?: string; categories?: string[] }>(
            '/giftcard/status'
          ),
          apiFetch<Product[]>('/giftcard/products'),
        ]);
        if (mounted) {
          setStatus(s);
          setProducts(p);
        }
      } catch {
        if (mounted) setStatus({ enabled: false });
      } finally {
        if (mounted) setStatusLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredProducts =
    category === 'all' ? products : products.filter((p) => p.category === category);

  const handlePurchase = async () => {
    if (!selectedProduct || !selectedAmount) return;
    if (!status?.enabled || !status.treasuryWallet) {
      showToast('error', t('giftcard.unavailable'));
      return;
    }
    if (!publicKey) {
      showToast('error', t('send.walletNotConnected'));
      return;
    }

    setSending(true);
    try {
      // 1) Pay treasury on-chain in USDC
      const treasuryOwner = new PublicKey(status.treasuryWallet);
      const fromAta = await getAssociatedTokenAddress(USDC_MINT, publicKey);
      const toAta = await getAssociatedTokenAddress(USDC_MINT, treasuryOwner);

      const rawAmount = amountToRaw(selectedAmount);
      const tx = new Transaction();
      tx.add(createTransferInstruction(fromAta, toAta, publicKey, rawAmount));

      const paymentSignature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(paymentSignature, 'confirmed');

      // 2) Purchase gift card
      const result = await apiFetch<{
        id: string;
        status: string;
        productName: string;
        code: string | null;
        pin: string | null;
      }>('/giftcard/purchase', {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedProduct.id,
          amount: selectedAmount,
          paymentSignature,
        }),
      });

      if (result.code) {
        setDeliveredCode(result.code);
      }

      showToast('success', t('giftcard.success', { product: selectedProduct.name }));
      track(AnalyticsEvents.GIFTCARD_PURCHASED, {
        product: selectedProduct.name,
        amount: selectedAmount,
      });
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('giftcard.failed'));
    } finally {
      setSending(false);
    }
  };

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await apiFetch<GiftCardRecord[]>('/giftcard/history');
      setHistory(data);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    showToast('success', t('giftcard.codeCopied'));
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('giftcard.connectPrompt')}</p>
      </div>
    );
  }

  if (statusLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold uppercase tracking-tight">{t('giftcard.title')}</h1>
      <p className="text-white/40 text-xs">{t('giftcard.subtitle')}</p>

      {!status?.enabled && (
        <div className="card border border-red-500/20 bg-red-500/5 text-red-300 text-sm">
          {t('giftcard.unavailable')}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('browse')}
          className={`flex-1 py-2 text-sm font-medium border transition ${
            tab === 'browse'
              ? 'border-gold-500 bg-gold-500/10 text-gold-500'
              : 'border-white/10 text-white/50'
          }`}
        >
          {t('giftcard.browseTab')}
        </button>
        <button
          onClick={() => {
            setTab('history');
            loadHistory();
          }}
          className={`flex-1 py-2 text-sm font-medium border transition ${
            tab === 'history'
              ? 'border-gold-500 bg-gold-500/10 text-gold-500'
              : 'border-white/10 text-white/50'
          }`}
        >
          {t('giftcard.historyTab')}
        </button>
      </div>

      {tab === 'browse' ? (
        <>
          {/* Delivered code modal */}
          {deliveredCode && (
            <div className="card border border-green-500/30 bg-green-500/5 space-y-3">
              <p className="text-green-400 text-sm font-medium">{t('giftcard.codeReady')}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white/10 px-3 py-2 text-white font-mono text-sm break-all">
                  {deliveredCode}
                </code>
                <button
                  onClick={() => copyCode(deliveredCode)}
                  className="px-3 py-2 bg-gold-500/20 text-gold-500 text-sm font-medium"
                >
                  {t('giftcard.copy')}
                </button>
              </div>
              <button
                onClick={() => {
                  setDeliveredCode(null);
                  setSelectedProduct(null);
                  setSelectedAmount(null);
                }}
                className="text-white/40 text-xs underline"
              >
                {t('giftcard.done')}
              </button>
            </div>
          )}

          {/* Category filters */}
          {!deliveredCode && (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 text-xs font-medium border whitespace-nowrap transition ${
                      category === cat
                        ? 'border-gold-500 bg-gold-500/10 text-gold-500'
                        : 'border-white/10 text-white/50 hover:border-white/30'
                    }`}
                  >
                    {t(`giftcard.cat_${cat}`)}
                  </button>
                ))}
              </div>

              {/* Product grid */}
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(selectedProduct?.id === product.id ? null : product);
                      setSelectedAmount(null);
                    }}
                    className={`card text-left space-y-2 transition ${
                      selectedProduct?.id === product.id
                        ? 'border-gold-500 bg-gold-500/5'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="w-10 h-10 bg-white/10 rounded flex items-center justify-center text-lg">
                      {product.category === 'shopping'
                        ? '🛒'
                        : product.category === 'entertainment'
                          ? '🎬'
                          : product.category === 'gaming'
                            ? '🎮'
                            : '🍔'}
                    </div>
                    <p className="text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-white/40">
                      ${Math.min(...product.denominations)} – ${Math.max(...product.denominations)}
                    </p>
                  </button>
                ))}
              </div>

              {/* Selected product → amount selector */}
              {selectedProduct && (
                <div className="card space-y-3">
                  <p className="text-xs text-white/40">{t('giftcard.selectAmount')}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {selectedProduct.denominations.map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setSelectedAmount(amt)}
                        className={`py-2 text-sm font-medium border transition ${
                          selectedAmount === amt
                            ? 'border-gold-500 bg-gold-500/10 text-gold-500'
                            : 'border-white/10 text-white/50 hover:border-white/30'
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handlePurchase}
                    disabled={!selectedAmount || sending}
                    className="btn-primary w-full"
                  >
                    {sending
                      ? t('common.processing')
                      : t('giftcard.buy', {
                          product: selectedProduct.name,
                          amount: selectedAmount ?? '...',
                        })}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        /* History tab */
        <div className="space-y-2">
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-white/30 py-12 text-sm">{t('giftcard.noHistory')}</p>
          ) : (
            history.map((item) => (
              <div key={item.id} className="card space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.productName}</p>
                    <p className="text-xs text-white/40">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">${item.amountUsd}</p>
                    <p
                      className={`text-xs ${
                        item.status === 'DELIVERED'
                          ? 'text-green-400'
                          : item.status === 'FAILED' || item.status === 'CANCELLED'
                            ? 'text-red-400'
                            : 'text-gold-500'
                      }`}
                    >
                      {t(`giftcard.status_${item.status}`)}
                    </p>
                  </div>
                </div>
                {item.code && (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white/10 px-2 py-1 text-white/70 font-mono text-xs break-all">
                      {item.code}
                    </code>
                    <button
                      onClick={() => copyCode(item.code!)}
                      className="text-gold-500 text-xs font-medium"
                    >
                      {t('giftcard.copy')}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Info */}
      <div className="bg-white/5 border border-white/10 px-4 py-3">
        <p className="text-white/30 text-xs font-mono">{t('giftcard.poweredBy')}</p>
      </div>
    </div>
  );
}
