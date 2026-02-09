import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useKyc } from '../hooks/useKyc';

export default function KycPage() {
  const { t } = useTranslation();
  const { status, loading, rejectionReason, createSession } = useKyc();

  const handleStart = async () => {
    const session = await createSession();
    if (session?.mock) {
      // Mock mode — auto-approved, just refresh
      return;
    }
    if (session?.token) {
      // In production, this would mount @sumsub/websdk-react
      // For now, show pending state
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/"
          className="text-xs text-white/30 font-mono uppercase tracking-wider hover:text-white/50 transition"
        >
          ← {t('common.back')}
        </Link>
      </div>

      <h1 className="text-2xl font-bold uppercase tracking-tight">{t('kyc.title')}</h1>
      <p className="text-sm text-white/40">{t('kyc.subtitle')}</p>

      {/* UNVERIFIED */}
      {status === 'UNVERIFIED' && (
        <div className="card space-y-4">
          <div className="w-16 h-16 border border-gold-500/30 flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-gold-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <p className="text-center text-sm text-white/50">{t('kyc.verifyDesc')}</p>
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full bg-gold-500 text-black font-bold text-sm uppercase tracking-wider py-3 hover:bg-gold-400 transition disabled:opacity-50"
          >
            {loading ? '...' : t('kyc.startVerification')}
          </button>
        </div>
      )}

      {/* PENDING */}
      {status === 'PENDING' && (
        <div className="card text-center space-y-4">
          <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="text-lg font-bold">{t('kyc.pending')}</h3>
          <p className="text-sm text-white/40">{t('kyc.pendingDesc')}</p>
        </div>
      )}

      {/* APPROVED */}
      {status === 'APPROVED' && (
        <div className="card text-center space-y-4">
          <div className="w-16 h-16 border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-emerald-400">{t('kyc.approved')}</h3>
          <p className="text-sm text-white/40">{t('kyc.approvedDesc')}</p>
        </div>
      )}

      {/* REJECTED */}
      {status === 'REJECTED' && (
        <div className="card space-y-4">
          <div className="w-16 h-16 border border-red-500/30 bg-red-500/10 flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-red-400 text-center">{t('kyc.rejected')}</h3>
          {rejectionReason && (
            <p className="text-sm text-white/40 text-center">
              {t('kyc.rejectedReason', { reason: rejectionReason })}
            </p>
          )}
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full border border-white/20 text-white font-bold text-sm uppercase tracking-wider py-3 hover:border-white/40 transition disabled:opacity-50"
          >
            {loading ? '...' : t('kyc.tryAgain')}
          </button>
        </div>
      )}

      {/* EXPIRED */}
      {status === 'EXPIRED' && (
        <div className="card space-y-4 text-center">
          <h3 className="text-lg font-bold text-yellow-400">{t('kyc.title')}</h3>
          <p className="text-sm text-white/40">{t('kyc.verifyDesc')}</p>
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full bg-gold-500 text-black font-bold text-sm uppercase tracking-wider py-3 hover:bg-gold-400 transition disabled:opacity-50"
          >
            {loading ? '...' : t('kyc.startVerification')}
          </button>
        </div>
      )}
    </div>
  );
}
