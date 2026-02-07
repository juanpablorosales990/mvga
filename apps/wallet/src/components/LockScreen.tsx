import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';

export default function LockScreen() {
  const { t } = useTranslation();
  const { unlock, deleteWallet } = useSelfCustodyWallet();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);

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
          <input
            type="password"
            placeholder={t('lockScreen.enterPassword')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/20 focus:border-gold-500 outline-none font-mono text-sm"
            autoFocus
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
