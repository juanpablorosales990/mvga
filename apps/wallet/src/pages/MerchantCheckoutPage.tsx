import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../hooks/useToast';
import { track, AnalyticsEvents } from '../lib/analytics';
import { QRCodeSVG } from 'qrcode.react';

interface CheckoutResult {
  paymentRequestId: string;
  paymentUrl: string;
  amount: number;
  token: string;
  orderNumber: number;
}

interface Product {
  id: string;
  name: string;
  priceUsd: number;
  imageBase64: string | null;
  isActive: boolean;
}

export default function MerchantCheckoutPage() {
  const { t } = useTranslation();
  const { connected } = useSelfCustodyWallet();
  const [mode, setMode] = useState<'quick' | 'catalog'>('quick');
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('USDC');
  const [creating, setCreating] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutResult | null>(null);
  const [paid, setPaid] = useState(false);

  // Catalog
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});

  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (connected && mode === 'catalog') {
      apiFetch<Product[]>('/merchant/products')
        .then((p) => setProducts(p.filter((x) => x.isActive)))
        .catch(() => {});
    }
  }, [connected, mode]);

  // Poll for payment status
  useEffect(() => {
    if (!checkout) return;
    pollRef.current = setInterval(async () => {
      try {
        const orders = await apiFetch<{ status: string }[]>('/merchant/orders?status=PAID');
        const found = orders.some(
          (o) => (o as { orderNumber?: number }).orderNumber === checkout.orderNumber
        );
        if (found) {
          setPaid(true);
          track(AnalyticsEvents.MERCHANT_ORDER_PAID, {
            amount: checkout.amount,
            token: checkout.token,
          });
          clearInterval(pollRef.current);
        }
      } catch {
        // ignore
      }
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [checkout]);

  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const product = products.find((p) => p.id === id);
    return sum + (product ? product.priceUsd * qty : 0);
  }, 0);

  const handleCreate = async () => {
    const finalAmount = mode === 'quick' ? parseFloat(amount) : cartTotal;
    if (!finalAmount || finalAmount <= 0) return;
    setCreating(true);
    try {
      const body: Record<string, unknown> = { token };
      if (mode === 'quick') {
        body.amount = finalAmount;
      } else {
        body.items = Object.entries(cart)
          .filter(([, qty]) => qty > 0)
          .map(([productId, quantity]) => ({ productId, quantity }));
      }
      const result = await apiFetch<CheckoutResult>('/merchant/checkout', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setCheckout(result);
      track(AnalyticsEvents.MERCHANT_CHECKOUT_CREATED, { amount: finalAmount, token, mode });
      showToast('success', t('merchant.checkout.success'));
    } catch {
      showToast('error', t('merchant.checkout.failed'));
    } finally {
      setCreating(false);
    }
  };

  const handleNewSale = () => {
    setCheckout(null);
    setPaid(false);
    setAmount('');
    setCart({});
  };

  const addToCart = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const removeFromCart = (id: string) =>
    setCart((c) => {
      const next = { ...c };
      if (next[id] > 1) next[id]--;
      else delete next[id];
      return next;
    });

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500">
        <p>{t('common.connectWallet')}</p>
      </div>
    );
  }

  // Payment received
  if (paid && checkout) {
    return (
      <div className="max-w-lg mx-auto p-4 flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <div className="text-6xl animate-bounce">✅</div>
        <h2 className="text-2xl font-bold text-green-600">
          {t('merchant.checkout.paymentReceived')}
        </h2>
        <p className="text-lg font-semibold">
          ${checkout.amount.toFixed(2)} {checkout.token}
        </p>
        <button
          onClick={handleNewSale}
          className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
        >
          {t('merchant.checkout.newSale')}
        </button>
      </div>
    );
  }

  // Show QR after checkout creation
  if (checkout) {
    const payUrl = `${window.location.origin}/pay/${checkout.paymentRequestId}`;
    return (
      <div className="max-w-lg mx-auto p-4 flex flex-col items-center space-y-6">
        <h2 className="text-xl font-bold">{t('merchant.checkout.showCustomer')}</h2>
        <div className="bg-white p-6 rounded-2xl shadow-lg">
          <QRCodeSVG value={payUrl} size={240} level="M" />
        </div>
        <p className="text-sm text-gray-500">{t('merchant.checkout.scanToPay')}</p>
        <p className="text-2xl font-bold">
          ${checkout.amount.toFixed(2)} {checkout.token}
        </p>
        <p className="text-sm text-gray-500 animate-pulse">
          {t('merchant.checkout.waitingPayment')}
        </p>
        <button onClick={handleNewSale} className="text-sm text-blue-600 underline">
          {t('common.cancel')}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">{t('merchant.checkout.title')}</h1>

      {/* Mode tabs */}
      <div className="flex gap-2">
        {(['quick', 'catalog'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            {m === 'quick'
              ? t('merchant.checkout.quickAmount')
              : t('merchant.checkout.fromCatalog')}
          </button>
        ))}
      </div>

      {/* Quick Amount */}
      {mode === 'quick' && (
        <div className="space-y-3">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t('merchant.checkout.amount')}
            min="0.01"
            step="0.01"
            className="w-full border rounded-lg px-3 py-3 text-lg text-center bg-white dark:bg-gray-800 dark:border-gray-700"
          />
          <select
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
            <option value="MVGA">MVGA</option>
          </select>
        </div>
      )}

      {/* Catalog Mode */}
      {mode === 'catalog' && (
        <div className="space-y-2">
          {products.length === 0 ? (
            <p className="text-center text-gray-500 py-6">{t('merchant.products.empty')}</p>
          ) : (
            products.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 p-3 rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700"
              >
                {p.imageBase64 ? (
                  <img src={p.imageBase64} alt="" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    📦
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-blue-600">${p.priceUsd.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {cart[p.id] ? (
                    <>
                      <button
                        onClick={() => removeFromCart(p.id)}
                        className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 text-sm font-bold"
                      >
                        -
                      </button>
                      <span className="text-sm font-semibold w-4 text-center">{cart[p.id]}</span>
                    </>
                  ) : null}
                  <button
                    onClick={() => addToCart(p.id)}
                    className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            ))
          )}
          {cartTotal > 0 && (
            <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <span className="font-medium">{t('merchant.checkout.total')}</span>
              <span className="font-bold text-lg">${cartTotal.toFixed(2)}</span>
            </div>
          )}
          <select
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
            <option value="MVGA">MVGA</option>
          </select>
        </div>
      )}

      {/* Create Button */}
      <button
        onClick={handleCreate}
        disabled={
          creating || (mode === 'quick' ? !amount || parseFloat(amount) <= 0 : cartTotal <= 0)
        }
        className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
      >
        {creating ? t('merchant.checkout.creating') : t('merchant.checkout.create')}
      </button>
    </div>
  );
}
