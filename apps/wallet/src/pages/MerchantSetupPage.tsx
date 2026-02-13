import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../hooks/useToast';
import { track, AnalyticsEvents } from '../lib/analytics';
import { compressImage, validateImageFile } from '../lib/imageCompression';

const CATEGORIES = ['FOOD', 'RETAIL', 'SERVICES', 'DIGITAL', 'FREELANCE', 'OTHER'] as const;
const TOKENS = ['USDC', 'USDT', 'MVGA'] as const;

export default function MerchantSetupPage() {
  const { t } = useTranslation();
  const { connected } = useSelfCustodyWallet();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('FOOD');
  const [acceptedTokens, setAcceptedTokens] = useState<string[]>(['USDC']);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug || slug === toSlug(name)) {
      setSlug(toSlug(val));
    }
  };

  const toggleToken = (token: string) => {
    setAcceptedTokens((prev) =>
      prev.includes(token) ? prev.filter((t) => t !== token) : [...prev, token]
    );
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!validateImageFile(file)) return;
    try {
      const compressed = await compressImage(file, 150);
      setLogoBase64(compressed);
    } catch {
      showToast('error', t('merchant.setup.failed'));
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !slug.trim() || acceptedTokens.length === 0) return;
    setCreating(true);
    try {
      await apiFetch('/merchant/store', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || undefined,
          category,
          acceptedTokens,
          logoBase64: logoBase64 || undefined,
        }),
      });
      track(AnalyticsEvents.MERCHANT_STORE_CREATED, { category });
      showToast('success', t('merchant.setup.success'));
      navigate('/merchant');
    } catch {
      showToast('error', t('merchant.setup.failed'));
    } finally {
      setCreating(false);
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
    <div className="max-w-lg mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('merchant.setup.title')}</h1>
        <p className="text-gray-500 text-sm mt-1">{t('merchant.setup.subtitle')}</p>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium mb-1">{t('merchant.setup.name')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder={t('merchant.setup.namePlaceholder')}
          maxLength={60}
          className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700"
        />
      </div>

      {/* Slug */}
      <div>
        <label className="block text-sm font-medium mb-1">{t('merchant.setup.slug')}</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(toSlug(e.target.value))}
          placeholder={t('merchant.setup.slugPlaceholder')}
          maxLength={40}
          className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700"
        />
        {slug && (
          <p className="text-xs text-gray-400 mt-1">{t('merchant.setup.slugPreview', { slug })}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1">{t('merchant.setup.description')}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('merchant.setup.descriptionPlaceholder')}
          maxLength={500}
          rows={3}
          className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700 resize-none"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium mb-1">{t('merchant.setup.category')}</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {t(`merchant.categories.${cat}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Accepted Tokens */}
      <div>
        <label className="block text-sm font-medium mb-1">
          {t('merchant.setup.acceptedTokens')}
        </label>
        <div className="flex gap-3">
          {TOKENS.map((token) => (
            <button
              key={token}
              onClick={() => toggleToken(token)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                acceptedTokens.includes(token)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700'
              }`}
            >
              {token}
            </button>
          ))}
        </div>
      </div>

      {/* Logo */}
      <div>
        <label className="block text-sm font-medium mb-1">{t('merchant.setup.logo')}</label>
        <div className="flex items-center gap-4">
          {logoBase64 && (
            <img src={logoBase64} alt="Logo" className="w-16 h-16 rounded-lg object-cover" />
          )}
          <label className="cursor-pointer px-4 py-2 rounded-lg border text-sm bg-white dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
            {t('merchant.setup.uploadLogo')}
            <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleCreate}
        disabled={creating || !name.trim() || !slug.trim() || acceptedTokens.length === 0}
        className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {creating ? t('merchant.setup.creating') : t('merchant.setup.create')}
      </button>
    </div>
  );
}

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}
