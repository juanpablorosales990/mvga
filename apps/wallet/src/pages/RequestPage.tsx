import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import UserSearchInput, { type ResolvedUser } from '../components/UserSearchInput';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../hooks/useToast';
import { track, AnalyticsEvents } from '../lib/analytics';

export default function RequestPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [recipientInput, setRecipientInput] = useState('');
  const [resolvedUser, setResolvedUser] = useState<ResolvedUser | null>(null);
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('USDC');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleResolve = useCallback((user: ResolvedUser | null) => {
    setResolvedUser(user);
  }, []);

  const handleSubmit = async () => {
    if (!resolvedUser?.walletAddress && !recipientInput.trim()) {
      setError(t('request.recipientRequired'));
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError(t('request.invalidAmount'));
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await apiFetch('/payments/request-from-user', {
        method: 'POST',
        body: JSON.stringify({
          recipientIdentifier: recipientInput.trim(),
          token,
          amount: amountNum,
          note: note.trim() || undefined,
        }),
      });
      track(AnalyticsEvents.REQUEST_SENT, { token, amount: amountNum });
      showToast('success', t('request.success'));
      navigate('/requests');
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('request.failed');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/more" className="text-gray-400 hover:text-white" aria-label={t('common.back')}>
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
          <h1 className="text-2xl font-bold">{t('request.title')}</h1>
          <p className="text-sm text-gray-400">{t('request.subtitle')}</p>
        </div>
      </div>

      <div className="card space-y-4">
        {/* Token Selector */}
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

        {/* Recipient — @username, #citizen, or address */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">{t('request.fromUser')}</label>
          <UserSearchInput
            value={recipientInput}
            onChange={setRecipientInput}
            onResolve={handleResolve}
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">{t('request.amount')}</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="any"
              className="w-full bg-white/5 border border-white/10 px-4 py-3 pr-16 focus:outline-none focus:border-gold-500"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">{token}</span>
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">{t('request.note')}</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('request.notePlaceholder')}
            maxLength={100}
            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-gold-500"
          />
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
          disabled={submitting || !recipientInput.trim() || !amount}
          className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? t('common.loading') : t('request.submit')}
        </button>
      </div>

      {/* Link to inbox */}
      <Link
        to="/requests"
        className="block text-center text-sm text-gold-500 hover:text-gold-400 transition"
      >
        {t('request.viewInbox')} →
      </Link>
    </div>
  );
}
