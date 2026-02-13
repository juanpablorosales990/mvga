import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../hooks/useToast';
import { track, AnalyticsEvents } from '../lib/analytics';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string | null;
  customerEmail: string | null;
  totalAmount: number;
  token: string;
  status: string;
  paymentUrl: string | null;
  createdAt: string;
}

export default function MerchantInvoicesPage() {
  const { t } = useTranslation();
  const { connected } = useSelfCustodyWallet();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: '', quantity: 1, unitPrice: 0 },
  ]);
  const [token, setToken] = useState('USDC');
  const [memo, setMemo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const loadInvoices = useCallback(async () => {
    try {
      const data = await apiFetch<Invoice[]>('/merchant/invoices');
      setInvoices(data);
    } catch {
      // Failed
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connected) loadInvoices();
  }, [connected, loadInvoices]);

  const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  const addItem = () =>
    setItems((prev) => [...prev, { description: '', quantity: 1, unitPrice: 0 }]);
  const updateItem = (idx: number, field: keyof InvoiceItem, value: string | number) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const resetForm = () => {
    setCustomerName('');
    setCustomerEmail('');
    setItems([{ description: '', quantity: 1, unitPrice: 0 }]);
    setToken('USDC');
    setMemo('');
    setDueDate('');
    setShowForm(false);
  };

  const handleSave = async (send: boolean) => {
    if (items.some((i) => !i.description.trim() || i.unitPrice <= 0)) return;
    setSaving(true);
    try {
      const body = {
        customerName: customerName.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        items: items.map((i) => ({
          description: i.description.trim(),
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        token,
        memo: memo.trim() || undefined,
        dueDate: dueDate || undefined,
      };

      const invoice = await apiFetch<{ id: string; invoiceNumber: string }>('/merchant/invoices', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      track(AnalyticsEvents.MERCHANT_INVOICE_CREATED);

      if (send) {
        const result = await apiFetch<{ paymentUrl: string }>(
          `/merchant/invoices/${invoice.id}/send`,
          {
            method: 'PATCH',
          }
        );
        track(AnalyticsEvents.MERCHANT_INVOICE_SENT);
        if (result.paymentUrl) {
          await navigator.clipboard.writeText(result.paymentUrl).catch(() => {});
        }
        showToast('success', t('merchant.invoices.sent'));
      } else {
        showToast('success', t('merchant.invoices.created'));
      }

      resetForm();
      loadInvoices();
    } catch {
      showToast('error', send ? t('merchant.invoices.sendFailed') : t('merchant.invoices.failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm(t('merchant.invoices.cancelConfirm'))) return;
    try {
      await apiFetch(`/merchant/invoices/${id}/cancel`, { method: 'PATCH' });
      showToast('success', t('merchant.invoices.cancelled'));
      loadInvoices();
    } catch {
      showToast('error', t('merchant.invoices.failed'));
    }
  };

  const handleSend = async (id: string) => {
    try {
      const result = await apiFetch<{ paymentUrl: string }>(`/merchant/invoices/${id}/send`, {
        method: 'PATCH',
      });
      track(AnalyticsEvents.MERCHANT_INVOICE_SENT);
      if (result.paymentUrl) {
        await navigator.clipboard.writeText(result.paymentUrl).catch(() => {});
      }
      showToast('success', t('merchant.invoices.sent'));
      loadInvoices();
    } catch {
      showToast('error', t('merchant.invoices.sendFailed'));
    }
  };

  const statusColor: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    SENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    PAID: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    OVERDUE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    CANCELLED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('merchant.invoices.title')}</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            {t('merchant.invoices.create')}
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="border rounded-xl p-4 space-y-3 bg-white dark:bg-gray-800 dark:border-gray-700">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder={t('merchant.invoices.customerName')}
            className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-900 dark:border-gray-700"
          />
          <input
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder={t('merchant.invoices.customerEmail')}
            className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-900 dark:border-gray-700"
          />

          <p className="text-sm font-medium">{t('merchant.invoices.items')}</p>
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                type="text"
                value={item.description}
                onChange={(e) => updateItem(idx, 'description', e.target.value)}
                placeholder={t('merchant.invoices.itemDescription')}
                className="flex-1 border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-900 dark:border-gray-700"
              />
              <input
                type="number"
                value={item.quantity}
                onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                min="1"
                className="w-14 border rounded-lg px-2 py-1.5 text-sm text-center bg-white dark:bg-gray-900 dark:border-gray-700"
              />
              <input
                type="number"
                value={item.unitPrice || ''}
                onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                placeholder="$"
                min="0.01"
                step="0.01"
                className="w-20 border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-900 dark:border-gray-700"
              />
              {items.length > 1 && (
                <button onClick={() => removeItem(idx)} className="text-red-500 text-sm">
                  ✕
                </button>
              )}
            </div>
          ))}
          <button onClick={addItem} className="text-sm text-blue-600 hover:underline">
            + {t('merchant.invoices.addItem')}
          </button>

          <div className="flex gap-3">
            <select
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 bg-white dark:bg-gray-900 dark:border-gray-700"
            >
              <option value="USDC">USDC</option>
              <option value="USDT">USDT</option>
              <option value="MVGA">MVGA</option>
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 bg-white dark:bg-gray-900 dark:border-gray-700"
            />
          </div>

          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder={t('merchant.invoices.memo')}
            className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-900 dark:border-gray-700"
          />

          <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <span className="font-medium">{t('merchant.invoices.total')}</span>
            <span className="font-bold text-lg">
              ${total.toFixed(2)} {token}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex-1 py-2 rounded-lg border dark:border-gray-700 font-medium text-sm disabled:opacity-50"
            >
              {saving ? t('merchant.invoices.saving') : t('merchant.invoices.saveDraft')}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-medium text-sm disabled:opacity-50"
            >
              {saving ? t('merchant.invoices.sending') : t('merchant.invoices.sendNow')}
            </button>
          </div>
          <button onClick={resetForm} className="w-full text-sm text-gray-500 hover:text-gray-700">
            {t('common.cancel')}
          </button>
        </div>
      )}

      {/* Invoice List */}
      {loading ? (
        <p className="text-center text-gray-500 py-8">{t('common.loading')}</p>
      ) : invoices.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">🧾</p>
          <p className="font-medium">{t('merchant.invoices.empty')}</p>
          <p className="text-sm">{t('merchant.invoices.emptyDesc')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="p-3 rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{inv.invoiceNumber}</p>
                  {inv.customerName && <p className="text-xs text-gray-500">{inv.customerName}</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">
                    ${inv.totalAmount.toFixed(2)} {inv.token}
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${statusColor[inv.status] || statusColor.DRAFT}`}
                  >
                    {t(
                      `merchant.invoices.status${inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}`
                    )}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-gray-400 flex-1">
                  {new Date(inv.createdAt).toLocaleDateString()}
                </p>
                {inv.status === 'DRAFT' && (
                  <>
                    <button
                      onClick={() => handleSend(inv.id)}
                      className="text-xs text-blue-600 font-medium"
                    >
                      {t('merchant.invoices.send')}
                    </button>
                    <button onClick={() => handleCancel(inv.id)} className="text-xs text-red-500">
                      {t('merchant.invoices.cancel')}
                    </button>
                  </>
                )}
                {inv.status === 'SENT' && (
                  <button onClick={() => handleCancel(inv.id)} className="text-xs text-red-500">
                    {t('merchant.invoices.cancel')}
                  </button>
                )}
                {inv.paymentUrl && (
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(inv.paymentUrl!);
                      showToast('success', t('merchant.invoices.copyLink'));
                    }}
                    className="text-xs text-blue-600"
                  >
                    {t('merchant.invoices.copyLink')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
