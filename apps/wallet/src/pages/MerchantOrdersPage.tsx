import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { apiFetch } from '../lib/apiClient';

interface Order {
  id: string;
  orderNumber: number;
  items: { name: string; qty: number; price: number }[] | null;
  totalAmount: number;
  token: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

const FILTERS = ['', 'PENDING', 'PAID', 'COMPLETED'] as const;

export default function MerchantOrdersPage() {
  const { t } = useTranslation();
  const { connected } = useSelfCustodyWallet();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!connected) return;
    setLoading(true);
    const params = filter ? `?status=${filter}` : '';
    apiFetch<Order[]>(`/merchant/orders${params}`)
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [connected, filter]);

  const filterLabels: Record<string, string> = {
    '': t('merchant.orders.filterAll'),
    PENDING: t('merchant.orders.filterPending'),
    PAID: t('merchant.orders.filterPaid'),
    COMPLETED: t('merchant.orders.filterCompleted'),
  };

  const statusColor: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    PAID: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    COMPLETED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    REFUNDED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500">
        <p>{t('common.connectWallet')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">{t('merchant.orders.title')}</h1>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {/* Orders */}
      {loading ? (
        <p className="text-center text-gray-500 py-8">{t('common.loading')}</p>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">{t('merchant.orders.empty')}</p>
          <p className="text-sm">{t('merchant.orders.emptyDesc')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const amount = order.totalAmount / 1_000_000;
            const itemCount = order.items?.reduce((sum, i) => sum + i.qty, 0) ?? 0;
            return (
              <div
                key={order.id}
                className="p-3 rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">
                      {t('merchant.orders.orderNumber', { number: order.orderNumber })}
                    </p>
                    {itemCount > 0 && (
                      <p className="text-xs text-gray-500">
                        {t('merchant.orders.items', { count: itemCount })}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">
                      ${amount.toFixed(2)} {order.token}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${statusColor[order.status] || statusColor.PENDING}`}
                    >
                      {t(
                        `merchant.orders.status${order.status.charAt(0) + order.status.slice(1).toLowerCase()}`
                      )}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(order.createdAt).toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
