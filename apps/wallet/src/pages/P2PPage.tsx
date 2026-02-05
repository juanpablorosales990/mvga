import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import FiatValue from '../components/FiatValue';

interface P2POffer {
  id: string;
  sellerAddress: string;
  type: 'BUY' | 'SELL';
  cryptoAmount: number;
  cryptoCurrency: 'USDC' | 'MVGA';
  paymentMethod: 'ZELLE' | 'VENMO' | 'PAYPAL' | 'BANK_TRANSFER';
  rate: number;
  minAmount: number;
  maxAmount: number;
  status: string;
  availableAmount: number;
}

interface Reputation {
  rating: number;
  totalTrades: number;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const PAYMENT_METHODS = ['ZELLE', 'VENMO', 'PAYPAL', 'BANK_TRANSFER'] as const;
const CRYPTO_OPTIONS = ['USDC', 'MVGA'] as const;

export default function P2PPage() {
  const { t } = useTranslation();
  const { connected, publicKey } = useWallet();
  const { authToken } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'buy' | 'sell' | 'my'>('buy');
  const [myTrades, setMyTrades] = useState<
    {
      id: string;
      status: string;
      cryptoAmount: number;
      cryptoCurrency: string;
      createdAt: string;
    }[]
  >([]);
  const [offers, setOffers] = useState<P2POffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create offer form state
  const [newOffer, setNewOffer] = useState<{
    type: 'BUY' | 'SELL';
    cryptoAmount: string;
    cryptoCurrency: 'USDC' | 'MVGA';
    paymentMethod: 'ZELLE' | 'VENMO' | 'PAYPAL' | 'BANK_TRANSFER';
    rate: string;
    minAmount: string;
    maxAmount: string;
  }>({
    type: 'SELL',
    cryptoAmount: '',
    cryptoCurrency: 'USDC',
    paymentMethod: 'ZELLE',
    rate: '1.0',
    minAmount: '10',
    maxAmount: '500',
  });

  // Trade modal state
  const [selectedOffer, setSelectedOffer] = useState<P2POffer | null>(null);
  const [tradeAmount, setTradeAmount] = useState('');
  const [reputations, setReputations] = useState<Record<string, Reputation>>({});

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const type = activeTab === 'buy' ? 'SELL' : activeTab === 'sell' ? 'BUY' : undefined;
      const url = type ? `${API_URL}/p2p/offers?type=${type}` : `${API_URL}/p2p/offers`;
      const response = await fetch(url);
      const data = await response.json();
      setOffers(data);
    } catch {
      // Fetch failed — user sees empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, [activeTab]);

  // Fetch my trades
  useEffect(() => {
    if (!publicKey) return;
    fetch(`${API_URL}/p2p/users/${publicKey.toBase58()}/trades`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setMyTrades)
      .catch(() => {});
  }, [publicKey]);

  // Fetch reputations for all unique seller addresses
  useEffect(() => {
    const addresses = [...new Set(offers.map((o) => o.sellerAddress))];
    addresses.forEach(async (addr) => {
      if (reputations[addr]) return;
      try {
        const res = await fetch(`${API_URL}/p2p/users/${addr}/reputation`);
        if (res.ok) {
          const data = await res.json();
          setReputations((prev) => ({
            ...prev,
            [addr]: { rating: data.rating, totalTrades: data.totalTrades },
          }));
        }
      } catch {
        /* ignore */
      }
    });
  }, [offers]);

  const handleCreateOffer = async () => {
    if (!publicKey) return;

    try {
      const response = await fetch(`${API_URL}/p2p/offers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          sellerAddress: publicKey.toString(),
          type: newOffer.type,
          cryptoAmount: parseFloat(newOffer.cryptoAmount),
          cryptoCurrency: newOffer.cryptoCurrency,
          paymentMethod: newOffer.paymentMethod,
          rate: parseFloat(newOffer.rate),
          minAmount: parseFloat(newOffer.minAmount),
          maxAmount: parseFloat(newOffer.maxAmount),
        }),
      });

      if (response.ok) {
        setShowCreateModal(false);
        fetchOffers();
        setNewOffer({
          type: 'SELL',
          cryptoAmount: '',
          cryptoCurrency: 'USDC',
          paymentMethod: 'ZELLE',
          rate: '1.0',
          minAmount: '10',
          maxAmount: '500',
        });
      }
    } catch {
      // Create offer failed — modal stays open for retry
    }
  };

  const handleAcceptOffer = async () => {
    if (!publicKey || !selectedOffer || !tradeAmount) return;

    try {
      const response = await fetch(`${API_URL}/p2p/offers/${selectedOffer.id}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          buyerAddress: publicKey.toString(),
          amount: parseFloat(tradeAmount),
        }),
      });

      if (response.ok) {
        const trade = await response.json();
        setSelectedOffer(null);
        setTradeAmount('');
        navigate(`/p2p/trade/${trade.id}`);
      }
    } catch {
      // Accept failed — modal stays open for retry
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      ZELLE: 'Zelle',
      VENMO: 'Venmo',
      PAYPAL: 'PayPal',
      BANK_TRANSFER: 'Bank Transfer',
    };
    return labels[method] || method;
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mb-4">
          <span className="text-3xl">🤝</span>
        </div>
        <h2 className="text-xl font-bold mb-2">{t('p2p.title')}</h2>
        <p className="text-gray-400 mb-4">{t('p2p.connectPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('p2p.title')}</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary-500 text-black px-4 py-2 rounded-lg font-medium text-sm"
        >
          {t('p2p.createOffer')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-white/5 rounded-xl p-1">
        {(['buy', 'sell', 'my'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg font-medium text-sm transition ${
              activeTab === tab ? 'bg-primary-500 text-black' : 'text-gray-400'
            }`}
          >
            {tab === 'buy'
              ? t('p2p.buyCrypto')
              : tab === 'sell'
                ? t('p2p.sellCrypto')
                : t('p2p.myOffers')}
          </button>
        ))}
      </div>

      {/* My Trades */}
      {activeTab === 'my' && myTrades.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-400">{t('p2p.myTrades')}</h3>
          {myTrades.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(`/p2p/trade/${t.id}`)}
              className="card w-full text-left flex items-center justify-between hover:bg-white/10 transition"
            >
              <div>
                <p className="text-sm font-medium">
                  {t.cryptoAmount} {t.cryptoCurrency}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(t.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  t.status === 'COMPLETED'
                    ? 'bg-green-500/20 text-green-400'
                    : t.status === 'CANCELLED' || t.status === 'DISPUTED'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-primary-500/20 text-primary-400'
                }`}
              >
                {t.status}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Offers List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse h-24" />
          ))}
        </div>
      ) : offers.length === 0 ? (
        <div className="card text-center py-8 text-gray-400">
          <p>{t('p2p.noOffers')}</p>
          <p className="text-sm mt-1">{t('p2p.beFirst')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => (
            <div key={offer.id} className="card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-xs font-bold">
                    {offer.sellerAddress.slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{shortenAddress(offer.sellerAddress)}</p>
                    <p className="text-xs text-gray-500">
                      {reputations[offer.sellerAddress]
                        ? `${reputations[offer.sellerAddress].rating.toFixed(1)} (${reputations[offer.sellerAddress].totalTrades} trades)`
                        : 'New'}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    offer.type === 'SELL'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}
                >
                  {offer.type === 'SELL' ? t('p2p.selling') : t('p2p.buying')}{' '}
                  {offer.cryptoCurrency}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                <div>
                  <p className="text-gray-400">{t('p2p.available')}</p>
                  <p className="font-medium">
                    {offer.availableAmount.toFixed(2)} {offer.cryptoCurrency}
                  </p>
                  <FiatValue
                    amount={offer.availableAmount}
                    token={offer.cryptoCurrency}
                    className="text-xs text-gray-500"
                  />
                </div>
                <div>
                  <p className="text-gray-400">{t('p2p.payment')}</p>
                  <p className="font-medium">{getPaymentMethodLabel(offer.paymentMethod)}</p>
                </div>
                <div>
                  <p className="text-gray-400">{t('p2p.rate')}</p>
                  <p className="font-medium">{(offer.rate * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-gray-400">{t('p2p.limit')}</p>
                  <p className="font-medium">
                    ${offer.minAmount} - ${offer.maxAmount}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedOffer(offer)}
                className={`w-full py-2 rounded-lg font-medium text-sm transition ${
                  offer.sellerAddress === publicKey?.toString()
                    ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                    : 'bg-primary-500 text-black hover:bg-primary-600'
                }`}
                disabled={offer.sellerAddress === publicKey?.toString()}
              >
                {offer.sellerAddress === publicKey?.toString()
                  ? t('p2p.yourOffer')
                  : offer.type === 'SELL'
                    ? t('p2p.buyNow')
                    : t('p2p.sellNow')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Offer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50">
          <div className="bg-[#1a1a1a] rounded-t-3xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{t('p2p.createOfferTitle')}</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 text-2xl">
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setNewOffer({ ...newOffer, type: 'SELL' })}
                className={`py-3 rounded-xl font-medium ${
                  newOffer.type === 'SELL' ? 'bg-green-500 text-black' : 'bg-white/10'
                }`}
              >
                Sell Crypto
              </button>
              <button
                onClick={() => setNewOffer({ ...newOffer, type: 'BUY' })}
                className={`py-3 rounded-xl font-medium ${
                  newOffer.type === 'BUY' ? 'bg-blue-500 text-white' : 'bg-white/10'
                }`}
              >
                Buy Crypto
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('p2p.crypto')}</label>
                <select
                  value={newOffer.cryptoCurrency}
                  onChange={(e) =>
                    setNewOffer({ ...newOffer, cryptoCurrency: e.target.value as any })
                  }
                  className="w-full bg-white/10 rounded-lg px-3 py-2"
                >
                  {CRYPTO_OPTIONS.map((c) => (
                    <option key={c} value={c} className="bg-gray-900">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Payment</label>
                <select
                  value={newOffer.paymentMethod}
                  onChange={(e) =>
                    setNewOffer({ ...newOffer, paymentMethod: e.target.value as any })
                  }
                  className="w-full bg-white/10 rounded-lg px-3 py-2"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m} className="bg-gray-900">
                      {getPaymentMethodLabel(m)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('p2p.amountUsd')}</label>
              <input
                type="number"
                value={newOffer.cryptoAmount}
                onChange={(e) => setNewOffer({ ...newOffer, cryptoAmount: e.target.value })}
                placeholder="100"
                className="w-full bg-white/10 rounded-lg px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Min ($)</label>
                <input
                  type="number"
                  value={newOffer.minAmount}
                  onChange={(e) => setNewOffer({ ...newOffer, minAmount: e.target.value })}
                  className="w-full bg-white/10 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Max ($)</label>
                <input
                  type="number"
                  value={newOffer.maxAmount}
                  onChange={(e) => setNewOffer({ ...newOffer, maxAmount: e.target.value })}
                  className="w-full bg-white/10 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <button
              onClick={handleCreateOffer}
              disabled={!newOffer.cryptoAmount}
              className="w-full btn-primary disabled:opacity-50"
            >
              Create Offer
            </button>
          </div>
        </div>
      )}

      {/* Trade Modal */}
      {selectedOffer && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50">
          <div className="bg-[#1a1a1a] rounded-t-3xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {selectedOffer.type === 'SELL' ? 'Buy' : 'Sell'} {selectedOffer.cryptoCurrency}
              </h2>
              <button onClick={() => setSelectedOffer(null)} className="text-gray-400 text-2xl">
                ×
              </button>
            </div>

            <div className="bg-white/5 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Trader</span>
                <span>{shortenAddress(selectedOffer.sellerAddress)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Payment</span>
                <span>{getPaymentMethodLabel(selectedOffer.paymentMethod)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Available</span>
                <span>
                  {selectedOffer.availableAmount} {selectedOffer.cryptoCurrency}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Limits</span>
                <span>
                  ${selectedOffer.minAmount} - ${selectedOffer.maxAmount}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Amount (USD)</label>
              <input
                type="number"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(e.target.value)}
                placeholder={`${selectedOffer.minAmount} - ${selectedOffer.maxAmount}`}
                className="w-full bg-white/10 rounded-lg px-3 py-3 text-lg"
              />
              {tradeAmount && (
                <p className="text-sm text-gray-400 mt-2">
                  You will {selectedOffer.type === 'SELL' ? 'receive' : 'send'}:{' '}
                  <span className="text-white font-medium">
                    {(parseFloat(tradeAmount) * selectedOffer.rate).toFixed(2)}{' '}
                    {selectedOffer.cryptoCurrency}
                  </span>
                </p>
              )}
            </div>

            <button
              onClick={handleAcceptOffer}
              disabled={
                !tradeAmount ||
                parseFloat(tradeAmount) < selectedOffer.minAmount ||
                parseFloat(tradeAmount) > selectedOffer.maxAmount
              }
              className="w-full btn-primary disabled:opacity-50"
            >
              {selectedOffer.type === 'SELL' ? 'Buy' : 'Sell'} {selectedOffer.cryptoCurrency}
            </button>

            <p className="text-xs text-gray-500 text-center">{t('p2p.escrowNote')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
