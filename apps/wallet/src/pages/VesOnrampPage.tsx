import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../hooks/useToast';
import { track, AnalyticsEvents } from '../lib/analytics';

// ── Types ──────────────────────────────────────────────────────

interface VesOffer {
  id: string;
  lpWalletAddress: string;
  availableUsdc: number;
  vesRate: number;
  feePercent: number;
  effectiveRate: number;
  minOrderUsdc: number;
  maxOrderUsdc: number;
  bankCode: string;
  bankName: string;
  phoneNumber: string;
  ciNumber: string;
  status: string;
  totalOrders: number;
  completedOrders: number;
  lpRating: number;
  lpCompletedTrades: number;
  createdAt: string;
}

interface VesOrder {
  id: string;
  offerId: string;
  buyerWalletAddress: string;
  lpWalletAddress: string;
  amountUsdc: number;
  amountVes: number;
  vesRate: number;
  feePercent: number;
  status: string;
  escrowTx: string | null;
  releaseTx: string | null;
  disputeReason: string | null;
  pagoMovil?: {
    bankCode: string;
    bankName: string;
    phoneNumber: string;
    ciNumber: string;
  };
  createdAt: string;
  paidAt: string | null;
  completedAt: string | null;
  expiresAt: string;
}

type Tab = 'buy' | 'orders' | 'lp';

// ── Helpers ────────────────────────────────────────────────────

function statusColor(status: string) {
  switch (status) {
    case 'COMPLETED':
      return 'text-green-400';
    case 'DISPUTED':
    case 'EXPIRED':
    case 'CANCELLED':
    case 'REFUNDED':
      return 'text-red-400';
    case 'PAYMENT_SENT':
      return 'text-blue-400';
    default:
      return 'text-gold-500';
  }
}

function timeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return '0:00';
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

// ── Component ──────────────────────────────────────────────────

export default function VesOnrampPage() {
  const { t } = useTranslation();
  const { connected, publicKey } = useSelfCustodyWallet();
  const walletAddress = publicKey?.toBase58() || '';

  const [tab, setTab] = useState<Tab>('buy');
  const [offers, setOffers] = useState<VesOffer[]>([]);
  const [orders, setOrders] = useState<VesOrder[]>([]);
  const [loading, setLoading] = useState(false);

  // Buy flow state
  const [selectedOffer, setSelectedOffer] = useState<VesOffer | null>(null);
  const [vesAmount, setVesAmount] = useState('');
  const [ordering, setOrdering] = useState(false);

  // Active order tracking
  const [activeOrder, setActiveOrder] = useState<VesOrder | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);

  // LP form state
  const [lpForm, setLpForm] = useState({
    vesRate: '',
    feePercent: '1.5',
    availableUsdc: '',
    minOrderUsdc: '5',
    maxOrderUsdc: '200',
    bankCode: '',
    bankName: '',
    phoneNumber: '',
    ciNumber: '',
  });
  const [creatingOffer, setCreatingOffer] = useState(false);

  // ── Data loading ─────────────────────────────────────────────

  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<VesOffer[]>('/ves-onramp/offers');
      setOffers(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<VesOrder[]>('/ves-onramp/orders');
      setOrders(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connected) loadOffers();
  }, [connected, loadOffers]);

  useEffect(() => {
    if (tab === 'orders' && connected) loadOrders();
  }, [tab, connected, loadOrders]);

  // Refresh active order every 15s
  useEffect(() => {
    if (
      !activeOrder ||
      ['COMPLETED', 'CANCELLED', 'REFUNDED', 'EXPIRED'].includes(activeOrder.status)
    )
      return;
    const interval = setInterval(async () => {
      try {
        const updated = await apiFetch<VesOrder>(`/ves-onramp/orders/${activeOrder.id}`);
        setActiveOrder(updated);
        if (updated.status === 'COMPLETED') {
          showToast('success', t('vesOnramp.orderCompleted'));
        }
      } catch {
        // silent
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [activeOrder, t]);

  // ── Actions ──────────────────────────────────────────────────

  const handleCreateOrder = async () => {
    if (!selectedOffer || !vesAmount) return;
    setOrdering(true);
    try {
      const order = await apiFetch<VesOrder>('/ves-onramp/orders', {
        method: 'POST',
        body: JSON.stringify({
          offerId: selectedOffer.id,
          amountVes: parseFloat(vesAmount),
        }),
      });
      track(AnalyticsEvents.VES_ONRAMP_STARTED, { amountVes: parseFloat(vesAmount) });
      setActiveOrder(order);
      setSelectedOffer(null);
      setVesAmount('');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('vesOnramp.orderFailed'));
    } finally {
      setOrdering(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!activeOrder) return;
    setMarkingPaid(true);
    try {
      await apiFetch(`/ves-onramp/orders/${activeOrder.id}/paid`, { method: 'PATCH' });
      setActiveOrder({ ...activeOrder, status: 'PAYMENT_SENT', paidAt: new Date().toISOString() });
      showToast('success', t('vesOnramp.paymentSent'));
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('vesOnramp.markPaidFailed'));
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleCreateLpOffer = async () => {
    setCreatingOffer(true);
    try {
      await apiFetch('/ves-onramp/offers', {
        method: 'POST',
        body: JSON.stringify({
          vesRate: parseFloat(lpForm.vesRate),
          feePercent: parseFloat(lpForm.feePercent),
          availableUsdc: parseFloat(lpForm.availableUsdc),
          minOrderUsdc: parseFloat(lpForm.minOrderUsdc),
          maxOrderUsdc: parseFloat(lpForm.maxOrderUsdc),
          bankCode: lpForm.bankCode,
          bankName: lpForm.bankName,
          phoneNumber: lpForm.phoneNumber,
          ciNumber: lpForm.ciNumber,
        }),
      });
      showToast('success', t('vesOnramp.offerCreated'));
      setLpForm({
        vesRate: '',
        feePercent: '1.5',
        availableUsdc: '',
        minOrderUsdc: '5',
        maxOrderUsdc: '200',
        bankCode: '',
        bankName: '',
        phoneNumber: '',
        ciNumber: '',
      });
      loadOffers();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('vesOnramp.offerFailed'));
    } finally {
      setCreatingOffer(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => showToast('success', t('common.copied')),
      () => {}
    );
  };

  // ── Computed ─────────────────────────────────────────────────

  const usdcFromVes =
    selectedOffer && vesAmount ? parseFloat(vesAmount) / selectedOffer.effectiveRate : 0;

  // ── Render ───────────────────────────────────────────────────

  if (!connected) {
    return (
      <div className="text-center py-16 text-white/40">
        <p>{t('common.connectWallet')}</p>
      </div>
    );
  }

  // Active order flow (takes over the page)
  if (
    activeOrder &&
    !['COMPLETED', 'CANCELLED', 'REFUNDED', 'EXPIRED'].includes(activeOrder.status)
  ) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold uppercase tracking-tight">
          {t('vesOnramp.orderInProgress')}
        </h1>

        {/* Progress steps */}
        <div className="flex gap-1">
          {['PENDING', 'ESCROW_LOCKED', 'PAYMENT_SENT', 'COMPLETED'].map((step, i) => {
            const statuses = ['PENDING', 'ESCROW_LOCKED', 'PAYMENT_SENT', 'COMPLETED'];
            const currentIdx = statuses.indexOf(activeOrder.status);
            const isActive = i <= currentIdx;
            return (
              <div
                key={step}
                className={`flex-1 h-1 ${isActive ? 'bg-gold-500' : 'bg-white/10'}`}
              />
            );
          })}
        </div>

        {/* Order details card */}
        <div className="card space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-white/40">{t('vesOnramp.sending')}</span>
            <span className="text-white font-bold">
              Bs. {activeOrder.amountVes.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/40">{t('vesOnramp.receiving')}</span>
            <span className="text-gold-500 font-bold">
              ${activeOrder.amountUsdc.toFixed(2)} USDC
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/40">{t('vesOnramp.rate')}</span>
            <span className="text-white/60 font-mono">1 USDC = {activeOrder.vesRate} VES</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/40">{t('vesOnramp.expires')}</span>
            <span className="text-white/60 font-mono">{timeLeft(activeOrder.expiresAt)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/40">{t('vesOnramp.status')}</span>
            <span className={`font-medium ${statusColor(activeOrder.status)}`}>
              {t(`vesOnramp.status_${activeOrder.status}`)}
            </span>
          </div>
        </div>

        {/* Pago Movil details — shown when escrow is locked */}
        {activeOrder.status === 'ESCROW_LOCKED' && activeOrder.pagoMovil && (
          <div className="card space-y-3">
            <p className="text-sm font-medium">{t('vesOnramp.sendVesVia')}</p>
            <div className="space-y-2">
              {[
                { label: t('vesOnramp.bank'), value: activeOrder.pagoMovil.bankName },
                { label: t('vesOnramp.phone'), value: activeOrder.pagoMovil.phoneNumber },
                { label: t('vesOnramp.ci'), value: activeOrder.pagoMovil.ciNumber },
                {
                  label: t('vesOnramp.amount'),
                  value: `Bs. ${activeOrder.amountVes.toLocaleString()}`,
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between bg-white/5 px-3 py-2">
                  <div>
                    <p className="text-[10px] text-white/30 uppercase">{label}</p>
                    <p className="text-sm font-mono">{value}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(value)}
                    className="text-xs text-gold-500 font-mono"
                  >
                    {t('common.copy')}
                  </button>
                </div>
              ))}
            </div>

            <button onClick={handleMarkPaid} disabled={markingPaid} className="btn-primary w-full">
              {markingPaid ? t('common.processing') : t('vesOnramp.markPaid')}
            </button>
          </div>
        )}

        {/* Waiting for LP confirmation */}
        {activeOrder.status === 'PAYMENT_SENT' && (
          <div className="card text-center space-y-3">
            <div className="w-10 h-10 border-2 border-gold-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-white/60">{t('vesOnramp.waitingLp')}</p>
            <p className="text-xs text-white/30">{t('vesOnramp.waitingLpDesc')}</p>
          </div>
        )}

        {/* Back button */}
        <button onClick={() => setActiveOrder(null)} className="text-xs text-white/30 underline">
          {t('vesOnramp.backToOffers')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold uppercase tracking-tight">{t('vesOnramp.title')}</h1>
      <p className="text-white/40 text-xs">{t('vesOnramp.subtitle')}</p>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['buy', 'orders', 'lp'] as Tab[]).map((t2) => (
          <button
            key={t2}
            onClick={() => setTab(t2)}
            className={`flex-1 py-2 text-sm font-medium border transition ${
              tab === t2
                ? 'border-gold-500 bg-gold-500/10 text-gold-500'
                : 'border-white/10 text-white/50'
            }`}
          >
            {t(`vesOnramp.tab_${t2}`)}
          </button>
        ))}
      </div>

      {/* ── BUY TAB ─────────────────────────────────────────── */}
      {tab === 'buy' && (
        <>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : offers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/30 text-sm">{t('vesOnramp.noOffers')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className={`card cursor-pointer transition hover:bg-white/5 ${
                    selectedOffer?.id === offer.id ? 'border-gold-500' : ''
                  }`}
                  onClick={() => {
                    setSelectedOffer(selectedOffer?.id === offer.id ? null : offer);
                    setVesAmount('');
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">
                        1 USDC = {offer.effectiveRate.toFixed(2)} VES
                      </p>
                      <p className="text-xs text-white/40">
                        {offer.bankName} &middot; {t('vesOnramp.fee')}: {offer.feePercent}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gold-500 font-mono">
                        ${offer.availableUsdc.toFixed(0)}
                      </p>
                      <p className="text-[10px] text-white/30">
                        {offer.completedOrders}/{offer.totalOrders} {t('vesOnramp.trades')}
                      </p>
                    </div>
                  </div>

                  {/* Expanded: amount input */}
                  {selectedOffer?.id === offer.id && (
                    <div
                      className="mt-3 pt-3 border-t border-white/10 space-y-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div>
                        <label className="text-[10px] text-white/30 uppercase block mb-1">
                          {t('vesOnramp.vesAmount')}
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={vesAmount}
                          onChange={(e) => setVesAmount(e.target.value)}
                          placeholder={`${(offer.minOrderUsdc * offer.effectiveRate).toFixed(0)} - ${(offer.maxOrderUsdc * offer.effectiveRate).toFixed(0)} VES`}
                          className="w-full bg-black/50 border border-white/10 px-3 py-2 text-white text-sm"
                        />
                      </div>

                      {vesAmount && usdcFromVes > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-white/40">{t('vesOnramp.youReceive')}</span>
                          <span className="text-gold-500 font-bold">
                            ${usdcFromVes.toFixed(2)} USDC
                          </span>
                        </div>
                      )}

                      <button
                        onClick={handleCreateOrder}
                        disabled={
                          !vesAmount ||
                          usdcFromVes < offer.minOrderUsdc ||
                          usdcFromVes > offer.maxOrderUsdc ||
                          ordering
                        }
                        className="btn-primary w-full text-sm disabled:opacity-50"
                      >
                        {ordering ? t('common.processing') : t('vesOnramp.buyUsdc')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── ORDERS TAB ──────────────────────────────────────── */}
      {tab === 'orders' && (
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <p className="text-center text-white/30 py-12 text-sm">{t('vesOnramp.noOrders')}</p>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="card flex items-center justify-between cursor-pointer hover:bg-white/5"
                onClick={() => {
                  if (!['COMPLETED', 'CANCELLED', 'REFUNDED', 'EXPIRED'].includes(order.status)) {
                    setActiveOrder(order);
                  }
                }}
              >
                <div>
                  <p className="text-sm font-medium">
                    Bs. {order.amountVes.toLocaleString()} &rarr; ${order.amountUsdc.toFixed(2)}
                  </p>
                  <p className="text-xs text-white/40">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-medium ${statusColor(order.status)}`}>
                    {t(`vesOnramp.status_${order.status}`)}
                  </p>
                  {order.buyerWalletAddress === walletAddress && (
                    <p className="text-[10px] text-white/20">{t('vesOnramp.buyer')}</p>
                  )}
                  {order.lpWalletAddress === walletAddress && (
                    <p className="text-[10px] text-white/20">{t('vesOnramp.lp')}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── LP TAB ──────────────────────────────────────────── */}
      {tab === 'lp' && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <p className="text-sm font-medium">{t('vesOnramp.lpTitle')}</p>
            <p className="text-xs text-white/40">{t('vesOnramp.lpDesc')}</p>

            {/* Rate & Fee */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-white/30 uppercase block mb-1">
                  {t('vesOnramp.vesRate')}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={lpForm.vesRate}
                  onChange={(e) => setLpForm({ ...lpForm, vesRate: e.target.value })}
                  placeholder="42.5"
                  className="w-full bg-black/50 border border-white/10 px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/30 uppercase block mb-1">
                  {t('vesOnramp.feePercent')}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={lpForm.feePercent}
                  onChange={(e) => setLpForm({ ...lpForm, feePercent: e.target.value })}
                  placeholder="1.5"
                  className="w-full bg-black/50 border border-white/10 px-3 py-2 text-white text-sm"
                />
              </div>
            </div>

            {/* USDC amounts */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-white/30 uppercase block mb-1">
                  {t('vesOnramp.availableUsdc')}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={lpForm.availableUsdc}
                  onChange={(e) => setLpForm({ ...lpForm, availableUsdc: e.target.value })}
                  placeholder="500"
                  className="w-full bg-black/50 border border-white/10 px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/30 uppercase block mb-1">
                  {t('vesOnramp.minUsdc')}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={lpForm.minOrderUsdc}
                  onChange={(e) => setLpForm({ ...lpForm, minOrderUsdc: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/30 uppercase block mb-1">
                  {t('vesOnramp.maxUsdc')}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={lpForm.maxOrderUsdc}
                  onChange={(e) => setLpForm({ ...lpForm, maxOrderUsdc: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 px-3 py-2 text-white text-sm"
                />
              </div>
            </div>

            {/* Pago Movil details */}
            <p className="text-xs text-white/40 pt-2 border-t border-white/10">
              {t('vesOnramp.pagoMovilDetails')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-white/30 uppercase block mb-1">
                  {t('vesOnramp.bankCode')}
                </label>
                <input
                  type="text"
                  value={lpForm.bankCode}
                  onChange={(e) => setLpForm({ ...lpForm, bankCode: e.target.value })}
                  placeholder="0105"
                  maxLength={4}
                  className="w-full bg-black/50 border border-white/10 px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/30 uppercase block mb-1">
                  {t('vesOnramp.bankName')}
                </label>
                <input
                  type="text"
                  value={lpForm.bankName}
                  onChange={(e) => setLpForm({ ...lpForm, bankName: e.target.value })}
                  placeholder="Banco Mercantil"
                  className="w-full bg-black/50 border border-white/10 px-3 py-2 text-white text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-white/30 uppercase block mb-1">
                  {t('vesOnramp.phone')}
                </label>
                <input
                  type="tel"
                  value={lpForm.phoneNumber}
                  onChange={(e) => setLpForm({ ...lpForm, phoneNumber: e.target.value })}
                  placeholder="04163334455"
                  className="w-full bg-black/50 border border-white/10 px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/30 uppercase block mb-1">
                  {t('vesOnramp.ci')}
                </label>
                <input
                  type="text"
                  value={lpForm.ciNumber}
                  onChange={(e) => setLpForm({ ...lpForm, ciNumber: e.target.value })}
                  placeholder="V12345678"
                  className="w-full bg-black/50 border border-white/10 px-3 py-2 text-white text-sm"
                />
              </div>
            </div>

            <button
              onClick={handleCreateLpOffer}
              disabled={
                creatingOffer ||
                !lpForm.vesRate ||
                !lpForm.availableUsdc ||
                !lpForm.bankCode ||
                !lpForm.bankName ||
                !lpForm.phoneNumber ||
                !lpForm.ciNumber
              }
              className="btn-primary w-full text-sm disabled:opacity-50"
            >
              {creatingOffer ? t('common.processing') : t('vesOnramp.createOffer')}
            </button>
          </div>
        </div>
      )}

      {/* Info footer */}
      <div className="bg-white/5 border border-white/10 px-4 py-3">
        <p className="text-white/30 text-xs font-mono">{t('vesOnramp.footer')}</p>
      </div>
    </div>
  );
}
