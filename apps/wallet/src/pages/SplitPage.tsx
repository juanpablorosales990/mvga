import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import UserSearchInput, { type ResolvedUser } from '../components/UserSearchInput';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../hooks/useToast';
import { track, AnalyticsEvents } from '../lib/analytics';

interface Participant {
  id: string;
  recipientInput: string;
  resolvedUser: ResolvedUser | null;
  amount: string;
}

export default function SplitPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [totalAmount, setTotalAmount] = useState('');
  const [description, setDescription] = useState('');
  const [token, setToken] = useState('USDC');
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [participants, setParticipants] = useState<Participant[]>([
    { id: crypto.randomUUID(), recipientInput: '', resolvedUser: null, amount: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const addParticipant = () => {
    if (participants.length >= 20) return;
    setParticipants([
      ...participants,
      { id: crypto.randomUUID(), recipientInput: '', resolvedUser: null, amount: '' },
    ]);
  };

  const removeParticipant = (id: string) => {
    if (participants.length === 1) return;
    setParticipants(participants.filter((p) => p.id !== id));
  };

  const updateParticipant = (id: string, field: keyof Participant, value: unknown) => {
    setParticipants(participants.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handleResolve = useCallback((id: string, user: ResolvedUser | null) => {
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, resolvedUser: user } : p)));
  }, []);

  const recalcEqualShares = () => {
    const total = parseFloat(totalAmount);
    if (isNaN(total) || total <= 0 || splitMode !== 'equal') return;
    const share = (total / participants.length).toFixed(2);
    setParticipants((prev) => prev.map((p) => ({ ...p, amount: share })));
  };

  const handleSubmit = async () => {
    const total = parseFloat(totalAmount);
    if (isNaN(total) || total <= 0) {
      setError(t('split.invalidTotal'));
      return;
    }
    if (!description.trim()) {
      setError(t('split.descriptionRequired'));
      return;
    }
    if (participants.some((p) => !p.recipientInput.trim())) {
      setError(t('split.allParticipantsRequired'));
      return;
    }

    const shares = participants.map((p) => parseFloat(p.amount));
    if (shares.some((s) => isNaN(s) || s <= 0)) {
      setError(t('split.invalidShares'));
      return;
    }
    const sum = shares.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - total) > 0.01) {
      setError(t('split.sharesMismatch', { sum: sum.toFixed(2), total: total.toFixed(2) }));
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const split = await apiFetch<{ id: string }>('/payments/split', {
        method: 'POST',
        body: JSON.stringify({
          token,
          totalAmount: total,
          description: description.trim(),
          participants: participants.map((p) => ({
            recipientIdentifier: p.recipientInput.trim(),
            amount: parseFloat(p.amount),
          })),
        }),
      });
      track(AnalyticsEvents.SPLIT_CREATED, { token, total, participantCount: participants.length });
      showToast('success', t('split.success'));
      navigate(`/split/${split.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('split.failed');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/more" className="text-gray-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{t('split.title')}</h1>
          <p className="text-sm text-gray-400">{t('split.subtitle')}</p>
        </div>
      </div>

      <div className="card space-y-4">
        {/* Token */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">{t('send.token')}</label>
          <select
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold-500"
          >
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
            <option value="MVGA">MVGA</option>
          </select>
        </div>

        {/* Total Amount */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">{t('split.totalAmount')}</label>
          <input
            type="number"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            onBlur={recalcEqualShares}
            placeholder="0.00"
            step="any"
            className="w-full bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">{t('split.description')}</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('split.descriptionPlaceholder')}
            maxLength={200}
            className="w-full bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold-500"
          />
        </div>

        {/* Split Mode Toggle */}
        <div className="flex gap-1 bg-white/5 p-1 rounded">
          <button
            onClick={() => {
              setSplitMode('equal');
              setTimeout(recalcEqualShares, 0);
            }}
            className={`flex-1 py-2 text-sm font-medium rounded transition ${
              splitMode === 'equal' ? 'bg-gold-500 text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t('split.equalSplit')}
          </button>
          <button
            onClick={() => setSplitMode('custom')}
            className={`flex-1 py-2 text-sm font-medium rounded transition ${
              splitMode === 'custom' ? 'bg-gold-500 text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t('split.customSplit')}
          </button>
        </div>

        {/* Participants */}
        <div className="space-y-3">
          <label className="block text-sm text-gray-400">{t('split.participants')}</label>
          {participants.map((p, idx) => (
            <div key={p.id} className="bg-white/5 p-3 rounded space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {t('split.participant')} {idx + 1}
                </span>
                {participants.length > 1 && (
                  <button
                    onClick={() => removeParticipant(p.id)}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    {t('common.remove')}
                  </button>
                )}
              </div>
              <UserSearchInput
                value={p.recipientInput}
                onChange={(val) => updateParticipant(p.id, 'recipientInput', val)}
                onResolve={(user) => handleResolve(p.id, user)}
              />
              {splitMode === 'custom' && (
                <input
                  type="number"
                  value={p.amount}
                  onChange={(e) => updateParticipant(p.id, 'amount', e.target.value)}
                  placeholder={t('split.shareAmount')}
                  step="any"
                  className="w-full bg-white/10 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
                />
              )}
              {splitMode === 'equal' && p.amount && (
                <div className="text-xs text-gray-400">
                  {t('split.share')}: ${parseFloat(p.amount).toFixed(2)}
                </div>
              )}
            </div>
          ))}
          <button
            onClick={() => {
              addParticipant();
              if (splitMode === 'equal') setTimeout(recalcEqualShares, 0);
            }}
            disabled={participants.length >= 20}
            className="w-full py-2 bg-white/10 text-sm rounded hover:bg-white/20 transition disabled:opacity-50"
          >
            + {t('split.addParticipant')}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={
            submitting ||
            !totalAmount ||
            !description.trim() ||
            participants.some((p) => !p.recipientInput.trim())
          }
          className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? t('common.loading') : t('split.create')}
        </button>
      </div>
    </div>
  );
}
