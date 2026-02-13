import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { track, AnalyticsEvents } from '../lib/analytics';
import { API_URL } from '../config';

interface Product {
  id: string;
  name: string;
  description: string | null;
  priceUsd: number;
  imageBase64: string | null;
}

interface StoreData {
  name: string;
  slug: string;
  description: string | null;
  category: string;
  logoBase64: string | null;
  acceptedTokens: string[];
  products: Product[];
}

export default function StorefrontPage() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [store, setStore] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [token, setToken] = useState('USDC');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!slug) return;
    // Public endpoint — no auth cookie needed
    fetch(`${API_URL}/merchant/s/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((data: StoreData) => {
        setStore(data);
        if (data.acceptedTokens.length > 0) setToken(data.acceptedTokens[0]);
        track(AnalyticsEvents.MERCHANT_STOREFRONT_VIEWED, { slug });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const addToCart = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const removeFromCart = (id: string) =>
    setCart((c) => {
      const next = { ...c };
      if (next[id] > 1) next[id]--;
      else delete next[id];
      return next;
    });

  const cartItems = Object.entries(cart).filter(([, qty]) => qty > 0);
  const cartTotal = cartItems.reduce((sum, [id, qty]) => {
    const product = store?.products.find((p) => p.id === id);
    return sum + (product ? product.priceUsd * qty : 0);
  }, 0);

  const handleCheckout = async () => {
    if (cartTotal <= 0 || !slug) return;
    setChecking(true);
    try {
      const res = await fetch(`${API_URL}/merchant/s/${slug}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          items: cartItems.map(([productId, quantity]) => ({ productId, quantity })),
        }),
      });
      if (!res.ok) throw new Error('Checkout failed');
      const data = await res.json();
      // Redirect to existing PayPage
      navigate(`/pay/${data.paymentRequestId}`);
    } catch {
      // Failed
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500">
        <p className="text-4xl mb-3">🔍</p>
        <p>{t('merchant.storefront.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-6 pb-32">
      {/* Store Header */}
      <div className="flex items-center gap-3">
        {store.logoBase64 ? (
          <img src={store.logoBase64} alt="" className="w-14 h-14 rounded-xl object-cover" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-2xl">
            🏪
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold">{store.name}</h1>
          {store.description && <p className="text-sm text-gray-500">{store.description}</p>}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-2 gap-3">
        {store.products.map((product) => (
          <div
            key={product.id}
            className="rounded-xl border overflow-hidden bg-white dark:bg-gray-800 dark:border-gray-700"
          >
            {product.imageBase64 ? (
              <img
                src={product.imageBase64}
                alt={product.name}
                className="w-full h-32 object-cover"
              />
            ) : (
              <div className="w-full h-32 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-4xl">
                📦
              </div>
            )}
            <div className="p-3">
              <p className="font-medium text-sm truncate">{product.name}</p>
              {product.description && (
                <p className="text-xs text-gray-500 truncate">{product.description}</p>
              )}
              <div className="flex items-center justify-between mt-2">
                <span className="font-bold text-blue-600">${product.priceUsd.toFixed(2)}</span>
                <div className="flex items-center gap-1">
                  {cart[product.id] ? (
                    <>
                      <button
                        onClick={() => removeFromCart(product.id)}
                        className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 text-xs font-bold"
                      >
                        -
                      </button>
                      <span className="text-sm font-semibold w-4 text-center">
                        {cart[product.id]}
                      </span>
                    </>
                  ) : null}
                  <button
                    onClick={() => addToCart(product.id)}
                    className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Cart */}
      {cartTotal > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-40">
          <div className="max-w-lg mx-auto bg-blue-600 text-white rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold">
                {t('merchant.storefront.cart')} ({cartItems.reduce((s, [, q]) => s + q, 0)})
              </span>
              <span className="font-bold text-lg">${cartTotal.toFixed(2)}</span>
            </div>
            {store.acceptedTokens.length > 1 && (
              <select
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full mb-3 border rounded-lg px-3 py-2 bg-blue-700 border-blue-500 text-white"
              >
                {store.acceptedTokens.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={handleCheckout}
              disabled={checking}
              className="w-full py-3 rounded-lg bg-white text-blue-600 font-bold hover:bg-blue-50 disabled:opacity-50"
            >
              {checking ? t('common.processing') : t('merchant.storefront.checkout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
