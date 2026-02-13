import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { apiFetch } from '../lib/apiClient';

interface Store {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  logoBase64: string | null;
  acceptedTokens: string[];
  isActive: boolean;
  totalOrders: number;
  totalRevenue: number;
  url: string;
}

interface Dashboard {
  todaySales: number;
  todayRevenue: number;
  weekRevenue: number;
  totalOrders: number;
  recentOrders: {
    id: string;
    orderNumber: number;
    totalAmount: number;
    token: string;
    status: string;
    createdAt: string;
  }[];
}

export default function MerchantDashboardPage() {
  const { t } = useTranslation();
  const { connected } = useSelfCustodyWallet();
  const [store, setStore] = useState<Store | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!connected) return;
    (async () => {
      try {
        const s = await apiFetch<Store | null>('/merchant/store');
        setStore(s);
        if (s) {
          const d = await apiFetch<Dashboard>('/merchant/dashboard');
          setDashboard(d);
        }
      } catch {
        // No store or failed to load
      } finally {
        setLoading(false);
      }
    })();
  }, [connected]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500">
        <p>{t('common.connectWallet')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4">
        <div className="text-5xl">🏪</div>
        <h2 className="text-xl font-bold">{t('merchant.dashboard.noStore')}</h2>
        <p className="text-gray-500">{t('merchant.dashboard.noStoreDesc')}</p>
        <Link
          to="/merchant/setup"
          className="px-6 py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700"
        >
          {t('merchant.dashboard.createStore')}
        </Link>
      </div>
    );
  }

  const quickActions = [
    { label: t('merchant.dashboard.newSale'), path: '/merchant/checkout', icon: '💰' },
    { label: t('merchant.dashboard.qrCode'), path: '/merchant/qr', icon: '📱' },
    { label: t('merchant.dashboard.shareStore'), path: '/merchant/qr', icon: '🔗' },
    { label: t('merchant.dashboard.products'), path: '/merchant/products', icon: '📦' },
    { label: t('merchant.dashboard.orders'), path: '/merchant/orders', icon: '📋' },
    { label: t('merchant.dashboard.invoices'), path: '/merchant/invoices', icon: '🧾' },
  ];

  const statusColor: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    PAID: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    COMPLETED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {store.logoBase64 ? (
            <img src={store.logoBase64} alt="" className="w-10 h-10 rounded-lg object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-lg">
              🏪
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold">{store.name}</h1>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${store.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-200 text-gray-600'}`}
            >
              {store.isActive ? t('merchant.dashboard.active') : t('merchant.dashboard.inactive')}
            </span>
          </div>
        </div>
        <Link to="/merchant/setup" className="text-sm text-blue-600">
          {t('merchant.dashboard.storeSettings')}
        </Link>
      </div>

      {/* Stats */}
      {dashboard && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: t('merchant.dashboard.todaySales'), value: dashboard.todaySales },
            {
              label: t('merchant.dashboard.todayRevenue'),
              value: `$${dashboard.todayRevenue.toFixed(2)}`,
            },
            {
              label: t('merchant.dashboard.weekRevenue'),
              value: `$${dashboard.weekRevenue.toFixed(2)}`,
            },
            { label: t('merchant.dashboard.totalOrders'), value: dashboard.totalOrders },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border p-3 bg-white dark:bg-gray-800 dark:border-gray-700"
            >
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="text-xl font-bold mt-1">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-3">
          {t('merchant.dashboard.quickActions')}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.path + action.label}
              to={action.path}
              className="flex flex-col items-center gap-1 rounded-xl border p-3 bg-white dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            >
              <span className="text-2xl">{action.icon}</span>
              <span className="text-xs text-center font-medium">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Orders */}
      {dashboard && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500">
              {t('merchant.dashboard.recentOrders')}
            </h2>
            <Link to="/merchant/orders" className="text-xs text-blue-600">
              {t('wallet.viewAll')}
            </Link>
          </div>
          {dashboard.recentOrders.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              {t('merchant.dashboard.noRecentOrders')}
            </p>
          ) : (
            <div className="space-y-2">
              {dashboard.recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {t('merchant.orders.orderNumber', { number: order.orderNumber })}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">
                      ${(order.totalAmount / 1_000_000).toFixed(2)} {order.token}
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
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
