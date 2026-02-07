import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { useWalletStore } from '../stores/walletStore';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { connected, publicKey, hasMnemonic, exportMnemonic } = useSelfCustodyWallet();
  const preferredCurrency = useWalletStore((s) => s.preferredCurrency);
  const setPreferredCurrency = useWalletStore((s) => s.setPreferredCurrency);
  const autoCompoundDefault = useWalletStore((s) => s.autoCompoundDefault);
  const setAutoCompoundDefault = useWalletStore((s) => s.setAutoCompoundDefault);
  const [copied, setCopied] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryWords, setRecoveryWords] = useState<string[] | null>(null);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const copyAddress = () => {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
      </div>

      {/* Language */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-sm text-gray-400 uppercase tracking-wide">
          {t('settings.language')}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => i18n.changeLanguage('en')}
            className={`flex-1 py-2 text-sm font-medium transition ${
              i18n.language === 'en'
                ? 'bg-gold-500 text-black'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            English
          </button>
          <button
            onClick={() => i18n.changeLanguage('es')}
            className={`flex-1 py-2 text-sm font-medium transition ${
              i18n.language === 'es'
                ? 'bg-gold-500 text-black'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            Español
          </button>
        </div>
      </div>

      {/* Currency */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-sm text-gray-400 uppercase tracking-wide">
          {t('settings.currency')}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setPreferredCurrency('USD')}
            className={`flex-1 py-2 text-sm font-medium transition ${
              preferredCurrency === 'USD'
                ? 'bg-gold-500 text-black'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            USD
          </button>
          <button
            onClick={() => setPreferredCurrency('VES')}
            className={`flex-1 py-2 text-sm font-medium transition ${
              preferredCurrency === 'VES'
                ? 'bg-gold-500 text-black'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            VES
          </button>
        </div>
      </div>

      {/* Connected Wallet */}
      {connected && publicKey && (
        <div className="card p-4 space-y-3">
          <h2 className="font-semibold text-sm text-gray-400 uppercase tracking-wide">
            {t('settings.connectedWallet')}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300 font-mono truncate flex-1">
              {publicKey.toBase58()}
            </span>
            <button
              onClick={copyAddress}
              className="text-xs px-3 py-1.5 bg-white/10 text-gray-300 hover:bg-white/20 transition flex-shrink-0"
            >
              {copied ? t('receive.copied') : t('receive.copyAddress')}
            </button>
          </div>
        </div>
      )}

      {/* View Recovery Phrase */}
      {connected && hasMnemonic && (
        <div className="card p-4 space-y-3">
          <h2 className="font-semibold text-sm text-gray-400 uppercase tracking-wide">
            {t('settings.recoveryPhrase')}
          </h2>
          {!showRecovery ? (
            <button
              onClick={() => setShowRecovery(true)}
              className="w-full py-2 text-sm font-medium bg-white/10 text-gray-300 hover:bg-white/20 transition"
            >
              {t('settings.viewRecoveryPhrase')}
            </button>
          ) : recoveryWords ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {recoveryWords.map((word, i) => (
                  <div key={i} className="bg-white/5 px-2 py-1.5 text-sm font-mono">
                    <span className="text-gray-500 mr-1">{i + 1}.</span>
                    {word}
                  </div>
                ))}
              </div>
              <p className="text-xs text-yellow-400">{t('settings.recoveryWarning')}</p>
              <button
                onClick={() => {
                  setShowRecovery(false);
                  setRecoveryWords(null);
                  setRecoveryPassword('');
                }}
                className="w-full py-2 text-sm font-medium bg-white/10 text-gray-300 hover:bg-white/20 transition"
              >
                {t('common.close')}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="password"
                value={recoveryPassword}
                onChange={(e) => {
                  setRecoveryPassword(e.target.value);
                  setRecoveryError('');
                }}
                placeholder={t('settings.enterPassword')}
                className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
              />
              {recoveryError && <p className="text-xs text-red-400">{recoveryError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowRecovery(false);
                    setRecoveryPassword('');
                    setRecoveryError('');
                  }}
                  className="flex-1 py-2 text-sm font-medium bg-white/10 text-gray-300 hover:bg-white/20 transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={async () => {
                    if (!recoveryPassword) return;
                    setRecoveryLoading(true);
                    setRecoveryError('');
                    try {
                      const words = await exportMnemonic(recoveryPassword);
                      if (words) {
                        setRecoveryWords(words);
                      } else {
                        setRecoveryError(t('settings.noMnemonic'));
                      }
                    } catch {
                      setRecoveryError(t('settings.wrongPassword'));
                    } finally {
                      setRecoveryLoading(false);
                    }
                  }}
                  disabled={recoveryLoading || !recoveryPassword}
                  className="flex-1 py-2 text-sm font-medium bg-gold-500 text-black disabled:opacity-50 transition"
                >
                  {recoveryLoading ? t('common.loading') : t('settings.reveal')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Auto-Compound Default */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm text-gray-400 uppercase tracking-wide">
              {t('settings.autoCompound')}
            </h2>
            <p className="text-xs text-gray-500 mt-1">{t('settings.autoCompoundDesc')}</p>
          </div>
          <button
            onClick={() => setAutoCompoundDefault(!autoCompoundDefault)}
            className={`relative w-10 h-5 rounded-full transition flex-shrink-0 ${
              autoCompoundDefault ? 'bg-green-500' : 'bg-white/10'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                autoCompoundDefault ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Help Link */}
      <Link
        to="/help"
        className="card p-4 flex items-center justify-between hover:bg-white/10 transition"
      >
        <span className="font-medium">{t('settings.helpSupport')}</span>
        <svg
          className="w-5 h-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      {/* App Version */}
      <p className="text-center text-xs text-gray-600">MVGA Wallet v1.0.0</p>
    </div>
  );
}
