import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { useWalletStore } from '../stores/walletStore';
import { useBiometric } from '../hooks/useBiometric';
import { showToast } from '../hooks/useToast';
import { apiFetch } from '../lib/apiClient';
import { API_URL } from '../config';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { connected, publicKey, hasMnemonic, exportMnemonic } = useSelfCustodyWallet();
  const preferredCurrency = useWalletStore((s) => s.preferredCurrency);
  const setPreferredCurrency = useWalletStore((s) => s.setPreferredCurrency);
  const autoCompoundDefault = useWalletStore((s) => s.autoCompoundDefault);
  const setAutoCompoundDefault = useWalletStore((s) => s.setAutoCompoundDefault);
  const {
    isAvailable: biometricAvailable,
    isEnabled: biometricEnabled,
    register: registerBiometric,
    disable: disableBiometric,
    isLoading: biometricLoading,
  } = useBiometric();
  const [copied, setCopied] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryWords, setRecoveryWords] = useState<string[] | null>(null);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [biometricPassword, setBiometricPassword] = useState('');
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [biometricError, setBiometricError] = useState('');

  // Profile editing
  const storeEmail = useWalletStore((s) => s.email);
  const storeDisplayName = useWalletStore((s) => s.displayName);
  const storeUsername = useWalletStore((s) => s.username);
  const [profileName, setProfileName] = useState(storeDisplayName ?? '');
  const [profileEmail, setProfileEmail] = useState(storeEmail ?? '');
  const [profileUsername, setProfileUsername] = useState(storeUsername ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>(
    'idle'
  );
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced username availability check
  useEffect(() => {
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    const u = profileUsername.trim().toLowerCase();
    // Don't check if it matches current username
    if (!u || u.length < 3 || !/^[a-zA-Z0-9_]+$/.test(u) || u === storeUsername?.toLowerCase()) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    usernameTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/auth/check-username/${encodeURIComponent(u)}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const { available } = await res.json();
          setUsernameStatus(available ? 'available' : 'taken');
        }
      } catch {
        setUsernameStatus('idle');
      }
    }, 300);
    return () => {
      if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    };
  }, [profileUsername, storeUsername]);

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const data: Record<string, string> = {};
      if (profileName.trim() !== (storeDisplayName ?? '')) data.displayName = profileName.trim();
      if (profileEmail.trim() !== (storeEmail ?? '')) data.email = profileEmail.trim();
      if (profileUsername.trim() !== (storeUsername ?? '')) data.username = profileUsername.trim();

      if (Object.keys(data).length === 0) {
        showToast('info', t('profile.saved'));
        setProfileSaving(false);
        return;
      }

      const saved = await apiFetch<{
        displayName: string | null;
        email: string | null;
        username: string | null;
      }>('/auth/profile', { method: 'PUT', body: JSON.stringify(data) });
      useWalletStore.getState().setProfile({
        displayName: saved.displayName,
        email: saved.email,
        username: saved.username,
      });
      showToast('success', t('profile.saved'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('Email already in use')) {
        showToast('error', t('profile.emailTaken'));
      } else if (msg.includes('Username already taken')) {
        showToast('error', t('profile.usernameTakenError'));
      } else {
        showToast('error', t('profile.saveFailed'));
      }
    } finally {
      setProfileSaving(false);
    }
  };

  const profileDirty =
    profileName.trim() !== (storeDisplayName ?? '') ||
    profileEmail.trim() !== (storeEmail ?? '') ||
    profileUsername.trim() !== (storeUsername ?? '');

  const copyAddress = () => {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
      </div>

      {/* Profile */}
      {connected && (
        <div className="card p-4 space-y-3">
          <h2 className="font-semibold text-sm text-gray-400 uppercase tracking-wide">
            {t('profile.editProfile')}
          </h2>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('profile.displayName')}</label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder={t('profile.displayNamePlaceholder')}
              className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('profile.email')}</label>
            <input
              type="email"
              value={profileEmail}
              onChange={(e) => setProfileEmail(e.target.value)}
              placeholder={t('profile.emailPlaceholder')}
              className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('profile.username')}</label>
            <input
              type="text"
              value={profileUsername}
              autoCapitalize="none"
              autoComplete="off"
              onChange={(e) => setProfileUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder={t('profile.usernamePlaceholder')}
              className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
            />
            {usernameStatus === 'checking' && (
              <p className="text-gray-400 text-xs mt-1">{t('profile.usernameChecking')}</p>
            )}
            {usernameStatus === 'available' && (
              <p className="text-emerald-400 text-xs mt-1">{t('profile.usernameAvailable')}</p>
            )}
            {usernameStatus === 'taken' && (
              <p className="text-red-400 text-xs mt-1">{t('profile.usernameTaken')}</p>
            )}
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={
              profileSaving ||
              !profileDirty ||
              usernameStatus === 'taken' ||
              usernameStatus === 'checking'
            }
            className="w-full py-2 text-sm font-medium bg-gold-500 text-black disabled:opacity-50 transition"
          >
            {profileSaving ? t('profile.saving') : t('profile.save')}
          </button>
        </div>
      )}

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

      {/* Biometric Authentication */}
      {connected && biometricAvailable && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-sm text-gray-400 uppercase tracking-wide">
                {t('settings.biometric')}
              </h2>
              <p className="text-xs text-gray-500 mt-1">{t('settings.biometricDesc')}</p>
            </div>
            <button
              onClick={() => {
                if (biometricEnabled) {
                  disableBiometric();
                  showToast('success', t('settings.biometricDisabled'));
                } else {
                  setShowBiometricSetup(true);
                }
              }}
              disabled={biometricLoading}
              className={`relative w-10 h-5 rounded-full transition flex-shrink-0 ${
                biometricEnabled ? 'bg-green-500' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  biometricEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {showBiometricSetup && !biometricEnabled && (
            <div className="space-y-2">
              <input
                type="password"
                value={biometricPassword}
                onChange={(e) => {
                  setBiometricPassword(e.target.value);
                  setBiometricError('');
                }}
                placeholder={t('settings.enterPassword')}
                className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
              />
              {biometricError && <p className="text-xs text-red-400">{biometricError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowBiometricSetup(false);
                    setBiometricPassword('');
                    setBiometricError('');
                  }}
                  className="flex-1 py-2 text-sm font-medium bg-white/10 text-gray-300 hover:bg-white/20 transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={async () => {
                    if (!biometricPassword) return;
                    setBiometricError('');
                    // Validate the password is correct before binding to biometric
                    try {
                      await exportMnemonic(biometricPassword);
                    } catch {
                      setBiometricError(t('settings.wrongPassword'));
                      return;
                    }
                    const ok = await registerBiometric(biometricPassword);
                    if (ok) {
                      showToast('success', t('settings.biometricEnabled'));
                      setShowBiometricSetup(false);
                      setBiometricPassword('');
                    } else {
                      setBiometricError(t('settings.biometricFailed'));
                    }
                  }}
                  disabled={biometricLoading || !biometricPassword}
                  className="flex-1 py-2 text-sm font-medium bg-gold-500 text-black disabled:opacity-50 transition"
                >
                  {biometricLoading ? t('common.loading') : t('settings.enableBiometric')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KYC Verification */}
      {connected && (
        <Link
          to="/kyc"
          className="card p-4 flex items-center justify-between hover:bg-white/10 transition"
        >
          <div>
            <h2 className="font-semibold text-sm text-gray-400 uppercase tracking-wide">
              {t('settings.kyc')}
            </h2>
            <p className="text-xs text-gray-500 mt-1">{t('settings.kycDesc')}</p>
          </div>
          <svg
            className="w-5 h-5 text-gray-400 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
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
