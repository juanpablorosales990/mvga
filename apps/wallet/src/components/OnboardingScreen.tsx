import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';

type Step =
  | 'CHOICE'
  | 'CREATE_PASSWORD'
  | 'SHOW_MNEMONIC'
  | 'CONFIRM_MNEMONIC'
  | 'IMPORT_CHOICE'
  | 'IMPORT_MNEMONIC'
  | 'IMPORT_KEY';

const INPUT_CLASS =
  'w-full bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/20 focus:border-gold-500 outline-none font-mono text-sm';

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { createWallet, completeOnboarding, importFromMnemonic, importFromSecretKey } =
    useSelfCustodyWallet();
  const [step, setStep] = useState<Step>('CHOICE');

  // Create flow
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mnemonicWords, setMnemonicWords] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  // Mnemonic confirmation
  const [confirmIndices, setConfirmIndices] = useState<number[]>([]);
  const [confirmAnswers, setConfirmAnswers] = useState<Record<number, string>>({});

  // Import flow
  const [importWords, setImportWords] = useState<string[]>(Array(12).fill(''));
  const [importKey, setImportKey] = useState('');
  const [importPassword, setImportPassword] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    if (password.length < 6) {
      setError(t('onboarding.passwordTooShort'));
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
    // Transition wallet state from NO_WALLET → UNLOCKED
    completeOnboarding();
  };

  // ─── Import from mnemonic ──────────────────────────────────────
  const handleImportMnemonic = async () => {
    const words = importWords.map((w) => w.trim().toLowerCase());
    if (words.some((w) => !w)) {
      setError(t('onboarding.fill12Words'));
      return;
    }
    if (importPassword.length < 6) {
      setError(t('onboarding.passwordTooShort'));
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
    if (importPassword.length < 6) {
      setError(t('onboarding.passwordTooShort'));
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

  const copyMnemonic = () => {
    navigator.clipboard.writeText(mnemonicWords.join(' '));
    setCopied(true);
    setTimeout(() => {
      navigator.clipboard.writeText('');
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
            {error && <p className="text-red-400 text-xs font-mono">{error}</p>}
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full btn-primary disabled:opacity-50"
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
            <p className="text-xs tracking-[0.3em] text-gold-500 uppercase font-mono mb-2">
              {t('onboarding.recoveryPhrase')}
            </p>
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
                  <span className="text-white font-mono text-sm">{word}</span>
                </div>
              ))}
            </div>

            <button onClick={copyMnemonic} className="w-full btn-secondary text-sm">
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
