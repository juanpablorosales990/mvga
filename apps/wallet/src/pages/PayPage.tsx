import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { buildSolanaPayUrl } from '../utils/solana-pay';
import { apiFetch } from '../lib/apiClient';
import { API_URL } from '../config';

const PayPalButtons = lazy(() =>
  import('@paypal/react-paypal-js').then((m) => ({ default: m.PayPalButtons }))
);
const PayPalScriptProvider = lazy(() =>
  import('@paypal/react-paypal-js').then((m) => ({ default: m.PayPalScriptProvider }))
);

interface PaymentRequest {
  id: string;
  recipientAddress: string;
  token: string;
  amount: number;
  memo: string | null;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  paymentTx: string | null;
  expiresAt: string;
  createdAt: string;
}

type PayTab = 'solana' | 'paypal';

export default function PayPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [payTab, setPayTab] = useState<PayTab>('solana');
  const [paypalEnabled, setPaypalEnabled] = useState(false);
  const [paypalProcessing, setPaypalProcessing] = useState(false);

  const fetchRequest = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API_URL}/payments/request/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRequest(data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  // Check if PayPal is enabled
  useEffect(() => {
    apiFetch<{ enabled: boolean }>('/paypal/status')
      .then((d) => setPaypalEnabled(d.enabled))
      .catch((err) => console.warn('PayPal status check failed:', err));
  }, []);

  const paypalSupportedToken = request?.token === 'USDC' || request?.token === 'USDT';

  // Only poll when payment is still pending
  useEffect(() => {
    if (!request || request.status !== 'PENDING') return;
    const interval = setInterval(fetchRequest, 10_000);
    return () => clearInterval(interval);
  }, [request, fetchRequest]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('pay.notFound')}</p>
      </div>
    );
  }

  const solanaPayUrl = buildSolanaPayUrl(request.recipientAddress, {
    token: request.token,
    amount: String(request.amount),
    memo: request.memo || undefined,
  });

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-6)}`;

  const statusColor =
    request.status === 'PAID'
      ? 'text-green-400 bg-green-400/10'
      : request.status === 'EXPIRED'
        ? 'text-red-400 bg-red-400/10'
        : 'text-gold-500 bg-gold-500/10';

  const statusLabel =
    request.status === 'PAID'
      ? t('pay.paid')
      : request.status === 'EXPIRED'
        ? t('pay.expired')
        : request.status === 'CANCELLED'
          ? t('pay.cancelled')
          : t('pay.pending');

  const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('pay.title')}</h1>

      {/* Status badge */}
      <div className={`inline-block px-3 py-1 text-xs font-mono uppercase ${statusColor}`}>
        {statusLabel}
      </div>

      {/* Payment details */}
      <div className="card space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-white/40">{t('pay.amount')}</span>
          <span className="font-bold text-lg">
            {request.amount} {request.token}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/40">{t('pay.from')}</span>
          <span className="font-mono text-xs">{shortenAddress(request.recipientAddress)}</span>
        </div>
        {request.memo && (
          <div className="flex justify-between text-sm">
            <span className="text-white/40">{t('pay.memo')}</span>
            <span className="text-white/70">{request.memo}</span>
          </div>
        )}
      </div>

      {/* Payment methods — only show for pending payments */}
      {request.status === 'PENDING' && (
        <>
          {/* Tab selector — only show if PayPal is available */}
          {paypalEnabled && paypalClientId && paypalSupportedToken && (
            <div className="flex gap-2">
              <button
                onClick={() => setPayTab('solana')}
                className={`flex-1 py-2 text-sm font-medium border transition ${
                  payTab === 'solana'
                    ? 'border-gold-500 bg-gold-500/10 text-gold-500'
                    : 'border-white/10 text-white/50'
                }`}
              >
                {t('pay.solanaPay')}
              </button>
              <button
                onClick={() => setPayTab('paypal')}
                className={`flex-1 py-2 text-sm font-medium border transition ${
                  payTab === 'paypal'
                    ? 'border-gold-500 bg-gold-500/10 text-gold-500'
                    : 'border-white/10 text-white/50'
                }`}
              >
                {t('pay.paypalPay')}
              </button>
            </div>
          )}

          {payTab === 'solana' ? (
            <div className="card flex flex-col items-center py-8">
              <div className="bg-white p-4 mb-4">
                <QRCodeSVG value={solanaPayUrl} size={220} level="H" />
              </div>
              <p className="text-white/30 text-xs text-center">{t('pay.scanQr')}</p>
            </div>
          ) : (
            <div className="card py-6 px-4">
              {paypalProcessing ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center py-8">
                      <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  }
                >
                  <PayPalScriptProvider
                    options={{
                      clientId: paypalClientId,
                      currency: 'USD',
                    }}
                  >
                    <PayPalButtons
                      style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' }}
                      createOrder={async () => {
                        const data = await apiFetch<{ orderId: string }>('/paypal/order/payment', {
                          method: 'POST',
                          body: JSON.stringify({
                            paymentRequestId: request.id,
                            amountUsd: request.amount,
                            description:
                              request.memo || `Payment: ${request.amount} ${request.token}`,
                          }),
                        });
                        return data.orderId;
                      }}
                      onApprove={async (data) => {
                        setPaypalProcessing(true);
                        try {
                          await apiFetch('/paypal/capture/payment', {
                            method: 'POST',
                            body: JSON.stringify({
                              orderId: data.orderID,
                              paymentRequestId: request.id,
                            }),
                          });
                          fetchRequest();
                        } finally {
                          setPaypalProcessing(false);
                        }
                      }}
                      onError={() => setPaypalProcessing(false)}
                    />
                  </PayPalScriptProvider>
                </Suspense>
              )}
              <p className="text-white/30 text-xs text-center mt-3">{t('pay.paypalNote')}</p>
            </div>
          )}
        </>
      )}

      {/* Payment TX link */}
      {request.paymentTx && (
        <a
          href={`https://solscan.io/tx/${request.paymentTx}`}
          target="_blank"
          rel="noopener noreferrer"
          className="card flex items-center justify-between hover:bg-white/5 transition"
        >
          <span className="text-sm font-medium">{t('common.viewOnSolscan')}</span>
          <span className="text-gold-500 text-sm font-mono">&rarr;</span>
        </a>
      )}
    </div>
  );
}
