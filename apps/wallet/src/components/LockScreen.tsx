import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { useBiometric } from '../hooks/useBiometric';

export default function LockScreen() {
  const { t } = useTranslation();
  const { unlock, deleteWallet } = useSelfCustodyWallet();
  const { isEnabled: biometricEnabled, authenticate, isLoading: biometricLoading } = useBiometric();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);

  // Auto-trigger biometric on mount if enabled
  useEffect(() => {
    if (biometricEnabled) {
      authenticate().then((pw) => {
        if (pw) {
          setLoading(true);
          unlock(pw)
            .catch(() => setError(t('lockScreen.wrongPassword')))
            .finally(() => setLoading(false));
        }
      });
    }
  }, [biometricEnabled, authenticate, unlock, t]);

  const handleUnlock = async () => {
    if (!password) return;
    setError('');
    setLoading(true);
    try {
      await unlock(password);
    } catch {
      setError(t('lockScreen.wrongPassword'));
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricUnlock = async () => {
    const pw = await authenticate();
    if (pw) {
      setLoading(true);
      try {
        await unlock(pw);
      } catch {
        setError(t('lockScreen.wrongPassword'));
      } finally {
        setLoading(false);
      }
    }
  };

  if (showReset) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <p className="text-xs tracking-[0.3em] text-red-400 uppercase font-mono mb-6">
            {t('lockScreen.resetWallet')}
          </p>
          <p className="text-white/40 text-sm mb-6">{t('lockScreen.resetWarning')}</p>
          <button
            onClick={() => deleteWallet()}
            className="w-full bg-red-500/20 border border-red-500/40 text-red-400 font-bold px-6 py-3 uppercase tracking-wider text-sm hover:bg-red-500/30 transition mb-4"
          >
            {t('lockScreen.deleteWallet')}
          </button>
          <button
            onClick={() => setShowReset(false)}
            className="w-full text-white/30 text-xs font-mono hover:text-white/50 transition py-2"
          >
            &larr; {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black tracking-tighter">MVGA</h1>
          <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mt-2">
            {t('lockScreen.walletLocked')}
          </p>
        </div>

        <div className="space-y-4">
          {/* Biometric unlock button */}
          {biometricEnabled && (
            <button
              onClick={handleBiometricUnlock}
              disabled={biometricLoading}
              className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839-1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
                />
              </svg>
              {biometricLoading ? t('common.loading') : t('lockScreen.unlockBiometric')}
            </button>
          )}

          {biometricEnabled && (
            <div className="flex items-center gap-3 text-white/20">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs font-mono uppercase">{t('lockScreen.orPassword')}</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
          )}

          <input
            type="password"
            placeholder={t('lockScreen.enterPassword')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/20 focus:border-gold-500 outline-none font-mono text-sm"
            autoFocus={!biometricEnabled}
          />
          {error && <p className="text-red-400 text-xs font-mono">{error}</p>}
          <button
            onClick={handleUnlock}
            disabled={loading}
            className="w-full btn-primary disabled:opacity-50"
          >
            {loading ? t('lockScreen.unlocking') : t('lockScreen.unlock')}
          </button>
          <button
            onClick={() => setShowReset(true)}
            className="w-full text-white/20 text-xs font-mono hover:text-white/40 transition py-2"
          >
            {t('lockScreen.forgotPassword')}
          </button>
        </div>
      </div>
    </div>
  );
}
