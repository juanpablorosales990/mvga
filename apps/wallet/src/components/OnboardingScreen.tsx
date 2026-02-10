import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { useBiometric } from '../hooks/useBiometric';
import { useWalletStore } from '../stores/walletStore';
import { API_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import bs58 from 'bs58';

type Step =
  | 'CHOICE'
  | 'CREATE_PASSWORD'
  | 'SHOW_MNEMONIC'
  | 'CONFIRM_MNEMONIC'
  | 'ENABLE_BIOMETRIC'
  | 'BIOMETRIC_SUCCESS'
  | 'SETUP_PROFILE'
  | 'IMPORT_CHOICE'
  | 'IMPORT_MNEMONIC'
  | 'IMPORT_KEY';

const INPUT_CLASS =
  'w-full bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/20 focus:border-gold-500 outline-none font-mono text-sm';

const PASSWORD_MIN_LEN = 8;

function getPasswordRules(pw: string) {
  return {
    minLen: pw.length >= PASSWORD_MIN_LEN,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    symbol: /[^A-Za-z0-9\s]/.test(pw),
    noSpaces: !/\s/.test(pw),
  };
}

function isStrongPassword(pw: string) {
  const r = getPasswordRules(pw);
  return Object.values(r).every(Boolean);
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const {
    createWallet,
    completeOnboarding,
    importFromMnemonic,
    importFromSecretKey,
    keypair,
    signMessage,
  } = useSelfCustodyWallet();
  const { isAvailable: biometricAvailable, isEnabled: biometricEnabled, register } = useBiometric();
  const [step, setStep] = useState<Step>('CHOICE');

  // Create flow
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mnemonicWords, setMnemonicWords] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [revealMnemonic, setRevealMnemonic] = useState(false);

  // Mnemonic confirmation
  const [confirmIndices, setConfirmIndices] = useState<number[]>([]);
  const [confirmAnswers, setConfirmAnswers] = useState<Record<number, string>>({});

  // Import flow
  const [importWords, setImportWords] = useState<string[]>(Array(12).fill(''));
  const [importKey, setImportKey] = useState('');
  const [importPassword, setImportPassword] = useState('');

  // Optional: bind password to biometric unlock (WebAuthn)
  const [biometricPassword, setBiometricPassword] = useState('');
  const [biometricError, setBiometricError] = useState('');

  // Profile setup
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>(
    'idle'
  );
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const progressIndex = useMemo(() => {
    // 0 Start, 1 Password, 2 Backup, 3 Verify, 4 Secure, 5 Profile
    switch (step) {
      case 'CHOICE':
        return 0;
      case 'CREATE_PASSWORD':
      case 'IMPORT_CHOICE':
        return 1;
      case 'SHOW_MNEMONIC':
      case 'IMPORT_MNEMONIC':
      case 'IMPORT_KEY':
        return 2;
      case 'CONFIRM_MNEMONIC':
        return 3;
      case 'ENABLE_BIOMETRIC':
      case 'BIOMETRIC_SUCCESS':
        return 4;
      case 'SETUP_PROFILE':
        return 5;
      default:
        return 0;
    }
  }, [step]);

  const passwordRules = useMemo(() => getPasswordRules(password), [password]);
  const passwordMeetsRules = useMemo(
    () => Object.values(passwordRules).every(Boolean),
    [passwordRules]
  );
  const passwordsMatch = useMemo(
    () => confirmPassword.length > 0 && password === confirmPassword,
    [password, confirmPassword]
  );

  // Pick 3 random indices for mnemonic confirmation
  const generateConfirmIndices = (words: string[]) => {
    const indices: number[] = [];
    while (indices.length < 3) {
      const idx = Math.floor(Math.random() * words.length);
      if (!indices.includes(idx)) indices.push(idx);
    }
    return indices.sort((a, b) => a - b);
  };

  // ─── Create wallet ──────────────────────────────────────────────
  const handleCreate = async () => {
    if (!isStrongPassword(password)) {
      setError(t('onboarding.passwordTooWeak'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('onboarding.passwordsNoMatch'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const words = await createWallet(password);
      setRevealMnemonic(false);
      setMnemonicWords(words);
      setStep('SHOW_MNEMONIC');
    } catch {
      setError(t('onboarding.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToConfirm = () => {
    const indices = generateConfirmIndices(mnemonicWords);
    setConfirmIndices(indices);
    setConfirmAnswers({});
    setError('');
    setStep('CONFIRM_MNEMONIC');
  };

  const handleConfirmMnemonic = () => {
    for (const idx of confirmIndices) {
      if ((confirmAnswers[idx] || '').trim().toLowerCase() !== mnemonicWords[idx]) {
        setError(t('onboarding.wordsIncorrect'));
        return;
      }
    }
    // Mnemonic confirmed — clear sensitive data from component state
    setMnemonicWords([]);
    setConfirmAnswers({});

    // Clear password fields once the wallet is created (reduce sensitive data lifetime in memory).
    setPassword('');
    setConfirmPassword('');

    // Offer biometric/passkey unlock right after backup confirmation (optional).
    if (biometricAvailable && !biometricEnabled) {
      setBiometricPassword('');
      setBiometricError('');
      setStep('ENABLE_BIOMETRIC');
      return;
    }

    // Go to profile setup instead of completing onboarding
    setStep('SETUP_PROFILE');
  };

  const handleEnableBiometric = async () => {
    if (!biometricAvailable) {
      setBiometricError(t('onboarding.biometricsUnavailable'));
      return;
    }
    if (!biometricPassword || !isStrongPassword(biometricPassword)) {
      setBiometricError(t('onboarding.passwordTooWeak'));
      return;
    }

    setBiometricError('');
    setLoading(true);
    try {
      const ok = await register(biometricPassword);
      if (!ok) {
        setBiometricError(t('onboarding.biometricsFailed'));
        return;
      }
      setStep('BIOMETRIC_SUCCESS');
    } finally {
      setLoading(false);
    }
  };

  const finishOnboarding = () => {
    // Clear local password fields before leaving onboarding.
    setPassword('');
    setConfirmPassword('');
    setImportPassword('');
    setBiometricPassword('');
    setBiometricError('');
    // Go to profile setup instead of completing onboarding
    setStep('SETUP_PROFILE');
  };

  // ─── Import from mnemonic ──────────────────────────────────────
  const handleImportMnemonic = async () => {
    const words = importWords.map((w) => w.trim().toLowerCase());
    if (words.some((w) => !w)) {
      setError(t('onboarding.fill12Words'));
      return;
    }
    if (!isStrongPassword(importPassword)) {
      setError(t('onboarding.passwordTooWeak'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await importFromMnemonic(words, importPassword);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('onboarding.invalidPhrase'));
    } finally {
      setLoading(false);
    }
  };

  // ─── Import from secret key ────────────────────────────────────
  const handleImportKey = async () => {
    if (!importKey.trim()) {
      setError(t('onboarding.pasteKey'));
      return;
    }
    if (!isStrongPassword(importPassword)) {
      setError(t('onboarding.passwordTooWeak'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await importFromSecretKey(importKey.trim(), importPassword);
    } catch {
      setError(t('onboarding.invalidKey'));
    } finally {
      setLoading(false);
    }
  };

  // Debounced username availability check
  useEffect(() => {
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    const u = profileUsername.trim();
    if (!u || u.length < 3 || !/^[a-zA-Z0-9_]+$/.test(u)) {
      setUsernameStatus(u.length > 0 && u.length < 3 ? 'idle' : 'idle');
      return;
    }
    setUsernameStatus('checking');
    usernameTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_URL}/auth/check-username/${encodeURIComponent(u.toLowerCase())}`,
          {
            credentials: 'include',
          }
        );
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
  }, [profileUsername]);

  // Inline auth during onboarding + save profile
  const handleSaveProfile = async () => {
    if (!profileName.trim() && !profileEmail.trim() && !profileUsername.trim()) {
      completeOnboarding();
      return;
    }
    setError('');
    setLoading(true);
    try {
      const walletAddress = keypair?.publicKey.toBase58();
      if (!walletAddress || !signMessage) throw new Error('No keypair');

      // 1. Get nonce
      const nonceRes = await fetch(`${API_URL}/auth/nonce`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });
      if (!nonceRes.ok) throw new Error('Auth failed');
      const { message } = await nonceRes.json();

      // 2. Sign
      const signatureBytes = await signMessage(new TextEncoder().encode(message));
      const signature = bs58.encode(signatureBytes);

      // 3. Verify (sets httpOnly cookie)
      const verifyRes = await fetch(`${API_URL}/auth/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, signature }),
      });
      if (!verifyRes.ok) throw new Error('Verify failed');

      // 4. Save profile
      const profileData: Record<string, string> = {};
      if (profileName.trim()) profileData.displayName = profileName.trim();
      if (profileEmail.trim()) profileData.email = profileEmail.trim();
      if (profileUsername.trim()) profileData.username = profileUsername.trim();

      const saved = await apiFetch<{
        displayName: string | null;
        email: string | null;
        username: string | null;
      }>('/auth/profile', { method: 'PUT', body: JSON.stringify(profileData) });

      useWalletStore.getState().setProfile({
        displayName: saved.displayName,
        email: saved.email,
        username: saved.username,
      });

      completeOnboarding();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('Email already in use')) {
        setError(t('profile.emailTaken'));
      } else if (msg.includes('Username already taken')) {
        setError(t('profile.usernameTakenError'));
      } else {
        setError(t('profile.saveFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const copyMnemonic = () => {
    navigator.clipboard.writeText(mnemonicWords.join(' '));
    setCopied(true);
    setTimeout(() => {
      navigator.clipboard.writeText('').catch(() => {});
      setCopied(false);
    }, 30000);
  };

  const goBack = (target: Step) => {
    setError('');
    setStep(target);
  };

  // Check if all confirm answers are filled
  const allConfirmFilled = useMemo(
    () => confirmIndices.every((idx) => (confirmAnswers[idx] || '').trim()),
    [confirmIndices, confirmAnswers]
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Progress indicator */}
        <div className="flex gap-1 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 transition-colors ${
                i <= progressIndex ? 'bg-gold-500' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Logo */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black tracking-tighter">MVGA</h1>
          <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mt-2">Wallet</p>
        </div>

        {/* ── CHOICE ─────────────────────────── */}
        {step === 'CHOICE' && (
          <div className="space-y-4">
            <p className="text-white/40 text-sm text-center mb-8">{t('onboarding.tagline')}</p>
            <button onClick={() => setStep('CREATE_PASSWORD')} className="w-full btn-primary">
              {t('onboarding.createNew')}
            </button>
            <button onClick={() => setStep('IMPORT_CHOICE')} className="w-full btn-secondary">
              {t('onboarding.importExisting')}
            </button>
            <p className="text-white/20 text-xs text-center font-mono mt-8">
              {t('onboarding.securityNote')}
            </p>
          </div>
        )}

        {/* ── CREATE PASSWORD ─────────────────── */}
        {step === 'CREATE_PASSWORD' && (
          <div className="space-y-4">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-6">
              {t('onboarding.setPassword')}
            </p>
            <input
              type="password"
              placeholder={t('onboarding.passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT_CLASS}
            />
            <input
              type="password"
              placeholder={t('onboarding.confirmPasswordPlaceholder')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={INPUT_CLASS}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />

            {/* Password checklist (Meru-inspired gating) */}
            <div className="space-y-2 border border-white/10 bg-white/5 px-4 py-3">
              {[
                { ok: passwordRules.minLen, text: t('onboarding.pwRuleMinLen') },
                { ok: passwordRules.upper, text: t('onboarding.pwRuleUpper') },
                { ok: passwordRules.lower, text: t('onboarding.pwRuleLower') },
                { ok: passwordRules.number, text: t('onboarding.pwRuleNumber') },
                { ok: passwordRules.symbol, text: t('onboarding.pwRuleSymbol') },
                { ok: passwordRules.noSpaces, text: t('onboarding.pwRuleNoSpaces') },
                { ok: passwordsMatch, text: t('onboarding.pwRuleMatch') },
              ].map((r) => (
                <div key={r.text} className="flex items-center gap-2">
                  <span
                    className={`text-xs font-mono ${r.ok ? 'text-emerald-400' : 'text-white/20'}`}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  <span className={`text-xs ${r.ok ? 'text-white/60' : 'text-white/30'}`}>
                    {r.text}
                  </span>
                </div>
              ))}
            </div>

            {error && <p className="text-red-400 text-xs font-mono">{error}</p>}
            <button
              onClick={handleCreate}
              disabled={loading || !passwordMeetsRules || !passwordsMatch}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('onboarding.creating') : t('onboarding.createWallet')}
            </button>
            <button
              onClick={() => goBack('CHOICE')}
              className="w-full text-white/30 text-xs font-mono hover:text-white/50 transition py-2"
            >
              &larr; {t('common.back')}
            </button>
          </div>
        )}

        {/* ── SHOW MNEMONIC (12 words) ──────────── */}
        {step === 'SHOW_MNEMONIC' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs tracking-[0.3em] text-gold-500 uppercase font-mono">
                {t('onboarding.recoveryPhrase')}
              </p>
              <button
                onClick={() => setRevealMnemonic((v) => !v)}
                className="text-xs text-white/30 font-mono uppercase tracking-wider hover:text-white/50 transition"
              >
                {revealMnemonic ? t('onboarding.hideWords') : t('onboarding.revealWords')}
              </button>
            </div>
            <p className="text-white/40 text-xs mb-4">{t('onboarding.mnemonicInstructions')}</p>

            {/* Word grid */}
            <div className="grid grid-cols-3 gap-2">
              {mnemonicWords.map((word, i) => (
                <div
                  key={i}
                  className="bg-white/5 border border-white/10 px-3 py-2 flex items-center gap-2"
                >
                  <span className="text-white/20 text-[10px] font-mono w-4 text-right">
                    {i + 1}
                  </span>
                  <span className="text-white font-mono text-sm">
                    {revealMnemonic ? word : '••••'}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={copyMnemonic}
              disabled={!revealMnemonic}
              className="w-full btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copied ? t('onboarding.copiedClears') : t('onboarding.copyToClipboard')}
            </button>

            <div className="bg-red-500/10 border border-red-500/30 px-4 py-3">
              <p className="text-red-400 text-xs font-mono">{t('onboarding.noScreenshot')}</p>
            </div>

            <button onClick={handleProceedToConfirm} className="w-full btn-primary">
              {t('onboarding.wroteItDown')} &rarr;
            </button>
          </div>
        )}

        {/* ── CONFIRM MNEMONIC ──────────────────── */}
        {step === 'CONFIRM_MNEMONIC' && (
          <div className="space-y-4">
            <p className="text-xs tracking-[0.3em] text-gold-500 uppercase font-mono mb-2">
              {t('onboarding.verifyBackup')}
            </p>
            <p className="text-white/40 text-xs mb-4">{t('onboarding.verifyInstructions')}</p>

            {confirmIndices.map((idx) => (
              <div key={idx}>
                <label className="text-white/30 text-xs font-mono mb-1 block">
                  {t('onboarding.wordNumber', { number: idx + 1 })}
                </label>
                <input
                  type="text"
                  autoCapitalize="none"
                  autoComplete="off"
                  value={confirmAnswers[idx] || ''}
                  onChange={(e) =>
                    setConfirmAnswers((prev) => ({ ...prev, [idx]: e.target.value }))
                  }
                  className={INPUT_CLASS}
                  placeholder={t('onboarding.enterWord', { number: idx + 1 })}
                />
              </div>
            ))}

            {error && <p className="text-red-400 text-xs font-mono">{error}</p>}

            <button
              onClick={handleConfirmMnemonic}
              disabled={!allConfirmFilled}
              className="w-full btn-primary disabled:opacity-50"
            >
              {t('onboarding.confirmContinue')}
            </button>
            <button
              onClick={() => goBack('SHOW_MNEMONIC')}
              className="w-full text-white/30 text-xs font-mono hover:text-white/50 transition py-2"
            >
              &larr; {t('onboarding.showWordsAgain')}
            </button>
          </div>
        )}

        {/* ── ENABLE BIOMETRIC (optional) ───────── */}
        {step === 'ENABLE_BIOMETRIC' && (
          <div className="space-y-4">
            <p className="text-xs tracking-[0.3em] text-gold-500 uppercase font-mono mb-2">
              {t('onboarding.enableBiometrics')}
            </p>
            <p className="text-white/40 text-xs mb-4">{t('onboarding.enableBiometricsDesc')}</p>

            <div className="bg-white/5 border border-white/10 px-4 py-3">
              <p className="text-white/30 text-xs font-mono">
                {t('onboarding.enableBiometricsNote')}
              </p>
            </div>

            <input
              type="password"
              placeholder={t('onboarding.passwordPlaceholder')}
              value={biometricPassword}
              onChange={(e) => setBiometricPassword(e.target.value)}
              className={INPUT_CLASS}
              onKeyDown={(e) => e.key === 'Enter' && handleEnableBiometric()}
            />

            {biometricError && <p className="text-red-400 text-xs font-mono">{biometricError}</p>}

            <button
              onClick={handleEnableBiometric}
              disabled={loading}
              className="w-full btn-primary disabled:opacity-50"
            >
              {loading ? t('common.loading') : t('onboarding.enableBiometricsCta')}
            </button>
            <button onClick={finishOnboarding} className="w-full btn-secondary text-sm">
              {t('onboarding.skipForNow')}
            </button>
          </div>
        )}

        {/* ── BIOMETRIC SUCCESS ─────────────────── */}
        {step === 'BIOMETRIC_SUCCESS' && (
          <div className="space-y-6 text-center">
            <div className="mx-auto w-16 h-16 border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center">
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
            <div className="space-y-2">
              <h2 className="text-xl font-bold">{t('onboarding.biometricsEnabled')}</h2>
              <p className="text-white/40 text-sm">{t('onboarding.biometricsEnabledDesc')}</p>
            </div>
            <button onClick={finishOnboarding} className="w-full btn-primary">
              {t('onboarding.goToHome')}
            </button>
          </div>
        )}

        {/* ── SETUP PROFILE (optional) ─────────── */}
        {step === 'SETUP_PROFILE' && (
          <div className="space-y-4">
            <p className="text-xs tracking-[0.3em] text-gold-500 uppercase font-mono mb-2">
              {t('profile.title')}
            </p>
            <p className="text-white/40 text-xs mb-4">{t('profile.subtitle')}</p>

            <div>
              <label className="text-white/30 text-xs font-mono mb-1 block">
                {t('profile.displayName')}
              </label>
              <input
                type="text"
                placeholder={t('profile.displayNamePlaceholder')}
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className="text-white/30 text-xs font-mono mb-1 block">
                {t('profile.email')}
              </label>
              <input
                type="email"
                placeholder={t('profile.emailPlaceholder')}
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className="text-white/30 text-xs font-mono mb-1 block">
                {t('profile.username')}
              </label>
              <input
                type="text"
                placeholder={t('profile.usernamePlaceholder')}
                value={profileUsername}
                autoCapitalize="none"
                autoComplete="off"
                onChange={(e) => setProfileUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                className={INPUT_CLASS}
              />
              {usernameStatus === 'checking' && (
                <p className="text-white/30 text-xs font-mono mt-1">
                  {t('profile.usernameChecking')}
                </p>
              )}
              {usernameStatus === 'available' && (
                <p className="text-emerald-400 text-xs font-mono mt-1">
                  {t('profile.usernameAvailable')}
                </p>
              )}
              {usernameStatus === 'taken' && (
                <p className="text-red-400 text-xs font-mono mt-1">{t('profile.usernameTaken')}</p>
              )}
              {profileUsername.length > 0 && profileUsername.length < 3 && (
                <p className="text-white/30 text-xs font-mono mt-1">
                  {t('profile.usernameInvalid')}
                </p>
              )}
            </div>

            {error && <p className="text-red-400 text-xs font-mono">{error}</p>}

            <button
              onClick={handleSaveProfile}
              disabled={loading || usernameStatus === 'taken' || usernameStatus === 'checking'}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('profile.saving') : t('profile.continue')}
            </button>
            <button
              onClick={() => completeOnboarding()}
              className="w-full text-white/30 text-xs font-mono hover:text-white/50 transition py-2"
            >
              {t('profile.skipForNow')}
            </button>
          </div>
        )}

        {/* ── IMPORT CHOICE ─────────────────────── */}
        {step === 'IMPORT_CHOICE' && (
          <div className="space-y-4">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-6">
              {t('onboarding.importWallet')}
            </p>
            <button
              onClick={() => {
                setError('');
                setStep('IMPORT_MNEMONIC');
              }}
              className="w-full btn-primary"
            >
              {t('onboarding.recoveryPhrase12')}
            </button>
            <button
              onClick={() => {
                setError('');
                setStep('IMPORT_KEY');
              }}
              className="w-full btn-secondary"
            >
              {t('onboarding.secretKeyBase58')}
            </button>
            <button
              onClick={() => goBack('CHOICE')}
              className="w-full text-white/30 text-xs font-mono hover:text-white/50 transition py-2"
            >
              &larr; {t('common.back')}
            </button>
          </div>
        )}

        {/* ── IMPORT MNEMONIC ──────────────────── */}
        {step === 'IMPORT_MNEMONIC' && (
          <div className="space-y-4">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              {t('onboarding.enterRecoveryPhrase')}
            </p>

            <div className="grid grid-cols-3 gap-2">
              {importWords.map((word, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-white/20 text-[10px] font-mono w-4 text-right">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    autoCapitalize="none"
                    autoComplete="off"
                    value={word}
                    onChange={(e) => {
                      const updated = [...importWords];
                      // Handle paste of full 12-word phrase into first field
                      const val = e.target.value;
                      if (i === 0 && val.includes(' ')) {
                        const pasted = val.trim().split(/\s+/);
                        if (pasted.length === 12) {
                          setImportWords(pasted);
                          return;
                        }
                      }
                      updated[i] = val;
                      setImportWords(updated);
                    }}
                    className="flex-1 bg-white/5 border border-white/10 px-2 py-2 text-white font-mono text-xs focus:border-gold-500 outline-none min-w-0"
                    placeholder={`${i + 1}`}
                  />
                </div>
              ))}
            </div>

            <input
              type="password"
              placeholder={t('onboarding.setPasswordEncrypt')}
              value={importPassword}
              onChange={(e) => setImportPassword(e.target.value)}
              className={INPUT_CLASS}
              onKeyDown={(e) => e.key === 'Enter' && handleImportMnemonic()}
            />

            {error && <p className="text-red-400 text-xs font-mono">{error}</p>}

            <button
              onClick={handleImportMnemonic}
              disabled={loading}
              className="w-full btn-primary disabled:opacity-50"
            >
              {loading ? t('onboarding.importing') : t('onboarding.importWallet')}
            </button>
            <button
              onClick={() => goBack('IMPORT_CHOICE')}
              className="w-full text-white/30 text-xs font-mono hover:text-white/50 transition py-2"
            >
              &larr; {t('common.back')}
            </button>
          </div>
        )}

        {/* ── IMPORT SECRET KEY ────────────────── */}
        {step === 'IMPORT_KEY' && (
          <div className="space-y-4">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-6">
              {t('onboarding.importViaSecretKey')}
            </p>
            <textarea
              placeholder={t('onboarding.pasteSecretKeyPlaceholder')}
              value={importKey}
              onChange={(e) => setImportKey(e.target.value)}
              rows={3}
              className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/20 focus:border-gold-500 outline-none font-mono text-xs resize-none"
            />
            <input
              type="password"
              placeholder={t('onboarding.setPasswordEncrypt')}
              value={importPassword}
              onChange={(e) => setImportPassword(e.target.value)}
              className={INPUT_CLASS}
              onKeyDown={(e) => e.key === 'Enter' && handleImportKey()}
            />
            {error && <p className="text-red-400 text-xs font-mono">{error}</p>}
            <button
              onClick={handleImportKey}
              disabled={loading}
              className="w-full btn-primary disabled:opacity-50"
            >
              {loading ? t('onboarding.importing') : t('onboarding.importEncrypt')}
            </button>
            <button
              onClick={() => goBack('IMPORT_CHOICE')}
              className="w-full text-white/30 text-xs font-mono hover:text-white/50 transition py-2"
            >
              &larr; {t('common.back')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
