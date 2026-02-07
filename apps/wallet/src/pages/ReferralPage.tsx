import { useState, useEffect } from 'react';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { API_URL } from '../config';

interface ReferralStats {
  code: string | null;
  totalReferrals: number;
  totalEarned: number;
  referrals: { refereeAddress: string; bonusPaid: boolean; amount: number; createdAt: string }[];
}

export default function ReferralPage() {
  const { t } = useTranslation();
  const { connected } = useSelfCustodyWallet();
  const { authToken } = useAuth();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authToken) return;
    const controller = new AbortController();

    async function fetchData() {
      try {
        // Get or create referral code
        const codeRes = await fetch(`${API_URL}/referrals/code`, {
          headers: { Authorization: `Bearer ${authToken}` },
          signal: controller.signal,
        });
        if (!codeRes.ok) return;

        // Get stats
        const statsRes = await fetch(`${API_URL}/referrals/stats`, {
          headers: { Authorization: `Bearer ${authToken}` },
          signal: controller.signal,
        });
        if (statsRes.ok) {
          setStats(await statsRes.json());
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    return () => controller.abort();
  }, [authToken]);

  const referralLink = stats?.code ? `${window.location.origin}?ref=${stats.code}` : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'MVGA Wallet',
          text: t('referral.shareText'),
          url: referralLink,
        });
      } catch {
        // User cancelled share
      }
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('referral.connectPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('referral.title')}</h1>
      <p className="text-gray-400 text-sm">{t('referral.subtitle')}</p>

      {loading ? (
        <div className="space-y-3">
          <div className="card animate-pulse h-32" />
          <div className="card animate-pulse h-24" />
        </div>
      ) : (
        <>
          {/* Referral Link */}
          <div className="card space-y-3">
            <p className="text-gray-400 text-sm">{t('referral.yourLink')}</p>
            <div className="bg-white/5 px-4 py-3 font-mono text-sm break-all">{referralLink}</div>
            <div className="flex gap-3">
              <button onClick={handleCopy} className="flex-1 btn-primary text-sm">
                {copied ? t('referral.copied') : t('referral.copy')}
              </button>
              {typeof navigator.share === 'function' && (
                <button
                  onClick={handleShare}
                  className="flex-1 bg-white/10 text-white py-3 font-medium text-sm hover:bg-white/20 transition"
                >
                  {t('referral.share')}
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card text-center">
              <p className="text-gray-400 text-sm">{t('referral.totalReferrals')}</p>
              <p className="text-2xl font-bold">{stats?.totalReferrals || 0}</p>
            </div>
            <div className="card text-center">
              <p className="text-gray-400 text-sm">{t('referral.totalEarned')}</p>
              <p className="text-2xl font-bold text-green-400">{stats?.totalEarned || 0} MVGA</p>
            </div>
          </div>

          {/* Reward Info */}
          <div className="card bg-gold-500/10 border border-gold-500/20">
            <p className="text-sm text-gold-400 font-medium mb-1">{t('referral.howItWorks')}</p>
            <p className="text-sm text-gray-400">{t('referral.howItWorksDesc')}</p>
          </div>

          {/* Referral History */}
          {stats && stats.referrals.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">{t('referral.history')}</h2>
              <div className="space-y-2">
                {stats.referrals.map((r, i) => (
                  <div key={i} className="card flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm">{r.refereeAddress}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        r.bonusPaid
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}
                    >
                      {r.bonusPaid ? `+${r.amount} MVGA` : t('referral.pending')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
