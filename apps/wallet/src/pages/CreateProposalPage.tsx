import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { API_URL } from '../config';

export default function CreateProposalPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { connected, publicKey } = useWallet();
  const { authToken } = useAuth();

  const [form, setForm] = useState({
    businessName: '',
    businessLocation: '',
    description: '',
    requestedAmount: '',
    videoUrl: '',
    votingDays: '7',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!publicKey) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/grants/proposals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          applicantAddress: publicKey.toBase58(),
          businessName: form.businessName,
          businessLocation: form.businessLocation,
          description: form.description,
          requestedAmount: parseFloat(form.requestedAmount),
          videoUrl: form.videoUrl || undefined,
          votingDays: parseInt(form.votingDays) || 7,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create proposal');
      }

      const proposal = await res.json();
      navigate(`/grants/${proposal.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('createProposal.connectPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/grants')} className="text-gray-400 text-sm">
        ← {t('grants.backToGrants')}
      </button>

      <h1 className="text-2xl font-bold">{t('createProposal.title')}</h1>
      <p className="text-sm text-gray-400">{t('createProposal.subtitle')}</p>

      <div className="card space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            {t('createProposal.businessName')}
          </label>
          <input
            type="text"
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            placeholder="Mi Tienda"
            className="w-full bg-white/10 rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">{t('createProposal.location')}</label>
          <input
            type="text"
            value={form.businessLocation}
            onChange={(e) => setForm({ ...form, businessLocation: e.target.value })}
            placeholder="Caracas, Venezuela"
            className="w-full bg-white/10 rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">
            {t('createProposal.description')}
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe your business, how the funds will be used, and your plan for growth..."
            rows={5}
            className="w-full bg-white/10 rounded-lg px-3 py-2 resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">{form.description.length}/5000</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {t('createProposal.amountUsd')}
            </label>
            <input
              type="number"
              value={form.requestedAmount}
              onChange={(e) => setForm({ ...form, requestedAmount: e.target.value })}
              placeholder="500"
              className="w-full bg-white/10 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {t('createProposal.votingDays')}
            </label>
            <input
              type="number"
              value={form.votingDays}
              onChange={(e) => setForm({ ...form, votingDays: e.target.value })}
              className="w-full bg-white/10 rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">{t('createProposal.videoUrl')}</label>
          <input
            type="url"
            value={form.videoUrl}
            onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full bg-white/10 rounded-lg px-3 py-2"
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={
            loading ||
            !form.businessName ||
            !form.businessLocation ||
            form.description.length < 50 ||
            !form.requestedAmount
          }
          className="w-full btn-primary disabled:opacity-50"
        >
          {loading ? t('createProposal.creating') : t('createProposal.submit')}
        </button>
      </div>
    </div>
  );
}
