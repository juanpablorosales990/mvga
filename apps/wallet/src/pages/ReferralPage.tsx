import { useState, useEffect } from 'react';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { API_URL } from '../config';

const TIERS = [
  { name: 'Bronze', min: 0, reward: '100', color: 'text-orange-400' },
  { name: 'Silver', min: 5, reward: '150', color: 'text-gray-300' },
  { name: 'Gold', min: 15, reward: '200', color: 'text-gold-500' },
  { name: 'Diamond', min: 50, reward: '300', color: 'text-cyan-400' },
];

interface ReferralStats {
  code: string | null;
  totalReferrals: number;
  totalEarned: number;
  referrals: { refereeAddress: string; bonusPaid: boolean; amount: number; createdAt: string }[];
}

export default function ReferralPage() {
  const { t } = useTranslation();
  const { connected } = useSelfCustodyWallet();
  const { isAuthenticated } = useAuth();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();

    async function fetchData() {
      try {
        // Get or create referral code
        const codeRes = await fetch(`${API_URL}/referrals/code`, {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!codeRes.ok) return;

        // Get stats
        const statsRes = await fetch(`${API_URL}/referrals/stats`, {
          credentials: 'include',
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
  }, [isAuthenticated]);

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
          {/* Referral Link + QR */}
          <div className="card space-y-4">
            {referralLink && (
              <div className="flex justify-center">
                <div className="bg-white p-3">
                  <QRCodeSVG value={referralLink} size={160} level="H" />
                </div>
              </div>
            )}
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

          {/* Tier Progress */}
          {(() => {
            const count = stats?.totalReferrals || 0;
            const currentTier = [...TIERS].reverse().find((t) => count >= t.min) || TIERS[0];
            const nextTier = TIERS.find((t) => t.min > count);
            const progress = nextTier
              ? ((count - currentTier.min) / (nextTier.min - currentTier.min)) * 100
              : 100;

            return (
              <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{t('referral.tierTitle')}</p>
                  <span className={`text-sm font-bold ${currentTier.color}`}>
                    {currentTier.name}
                  </span>
                </div>
                <div className="h-2 bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gold-500 transition-all"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                {nextTier ? (
                  <p className="text-xs text-gray-500">
                    {t('referral.tierNext', {
                      count: nextTier.min - count,
                      tier: nextTier.name,
                      reward: nextTier.reward,
                    })}
                  </p>
                ) : (
                  <p className="text-xs text-cyan-400">{t('referral.tierMax')}</p>
                )}
                <div className="grid grid-cols-4 gap-1 mt-2">
                  {TIERS.map((tier) => (
                    <div
                      key={tier.name}
                      className={`text-center py-2 text-xs ${
                        count >= tier.min
                          ? `${tier.color} bg-white/5 border border-white/10`
                          : 'text-gray-600 border border-white/5'
                      }`}
                    >
                      <p className="font-bold">{tier.name}</p>
                      <p>{tier.reward}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

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
