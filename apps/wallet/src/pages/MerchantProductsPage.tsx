import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../hooks/useToast';
import { track, AnalyticsEvents } from '../lib/analytics';
import { compressImage, validateImageFile } from '../lib/imageCompression';

interface Product {
  id: string;
  name: string;
  description: string | null;
  priceUsd: number;
  imageBase64: string | null;
  isActive: boolean;
  sortOrder: number;
}

export default function MerchantProductsPage() {
  const { t } = useTranslation();
  const { connected } = useSelfCustodyWallet();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formImage, setFormImage] = useState<string | null>(null);
  const [formSortOrder, setFormSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const data = await apiFetch<Product[]>('/merchant/products');
      setProducts(data);
    } catch {
      // Failed to load
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connected) loadProducts();
  }, [connected, loadProducts]);

  const resetForm = () => {
    setFormName('');
    setFormDesc('');
    setFormPrice('');
    setFormImage(null);
    setFormSortOrder('0');
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (p: Product) => {
    setFormName(p.name);
    setFormDesc(p.description || '');
    setFormPrice(p.priceUsd.toString());
    setFormImage(p.imageBase64);
    setFormSortOrder(p.sortOrder.toString());
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !validateImageFile(file)) return;
    try {
      const compressed = await compressImage(file, 180);
      setFormImage(compressed);
    } catch {
      showToast('error', t('merchant.products.failed'));
    }
  };

  const handleSave = async () => {
    if (!formName.trim() || !formPrice) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: formName.trim(),
        description: formDesc.trim() || undefined,
        priceUsd: parseFloat(formPrice),
        imageBase64: formImage || undefined,
        sortOrder: parseInt(formSortOrder) || 0,
      };

      if (editingId) {
        await apiFetch(`/merchant/products/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        showToast('success', t('merchant.products.updated'));
      } else {
        await apiFetch('/merchant/products', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        track(AnalyticsEvents.MERCHANT_PRODUCT_ADDED);
        showToast('success', t('merchant.products.created'));
      }
      resetForm();
      loadProducts();
    } catch {
      showToast('error', t('merchant.products.failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('merchant.products.deleteConfirm'))) return;
    try {
      await apiFetch(`/merchant/products/${id}`, { method: 'DELETE' });
      showToast('success', t('merchant.products.deleted'));
      loadProducts();
    } catch {
      showToast('error', t('merchant.products.failed'));
    }
  };

  const handleToggle = async (p: Product) => {
    try {
      await apiFetch(`/merchant/products/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      loadProducts();
    } catch {
      showToast('error', t('merchant.products.failed'));
    }
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
        <h1 className="text-xl font-bold">{t('merchant.products.title')}</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            {t('merchant.products.add')}
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="border rounded-xl p-4 space-y-3 bg-white dark:bg-gray-800 dark:border-gray-700">
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder={t('merchant.products.namePlaceholder')}
            maxLength={100}
            className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-900 dark:border-gray-700"
          />
          <input
            type="text"
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            placeholder={t('merchant.products.description')}
            maxLength={500}
            className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-900 dark:border-gray-700"
          />
          <div className="flex gap-3">
            <input
              type="number"
              value={formPrice}
              onChange={(e) => setFormPrice(e.target.value)}
              placeholder={t('merchant.products.price')}
              min="0.01"
              step="0.01"
              className="flex-1 border rounded-lg px-3 py-2 bg-white dark:bg-gray-900 dark:border-gray-700"
            />
            <input
              type="number"
              value={formSortOrder}
              onChange={(e) => setFormSortOrder(e.target.value)}
              placeholder={t('merchant.products.sortOrder')}
              className="w-20 border rounded-lg px-3 py-2 bg-white dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
          <div className="flex items-center gap-3">
            {formImage && (
              <img src={formImage} alt="" className="w-12 h-12 rounded-lg object-cover" />
            )}
            <label className="cursor-pointer text-sm text-blue-600 hover:underline">
              {t('merchant.products.uploadImage')}
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !formName.trim() || !formPrice}
              className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50"
            >
              {saving ? t('merchant.products.saving') : t('merchant.products.save')}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 rounded-lg border dark:border-gray-700 text-sm"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Product List */}
      {loading ? (
        <p className="text-center text-gray-500 py-8">{t('common.loading')}</p>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">📦</p>
          <p className="font-medium">{t('merchant.products.empty')}</p>
          <p className="text-sm">{t('merchant.products.emptyDesc')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 p-3 rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700 ${!p.isActive ? 'opacity-50' : ''}`}
            >
              {p.imageBase64 ? (
                <img src={p.imageBase64} alt="" className="w-12 h-12 rounded-lg object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xl">
                  📦
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.name}</p>
                <p className="text-sm text-blue-600 font-semibold">${p.priceUsd.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleToggle(p)}
                  className={`w-10 h-6 rounded-full transition-colors ${p.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full transition-transform mx-1 ${p.isActive ? 'translate-x-4' : ''}`}
                  />
                </button>
                <button onClick={() => handleEdit(p)} className="text-xs text-blue-600 px-2 py-1">
                  {t('merchant.products.edit')}
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-xs text-red-500 px-2 py-1"
                >
                  {t('merchant.products.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
