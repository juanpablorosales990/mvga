import { useState, useMemo } from 'react';
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
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const words = await createWallet(password);
      setMnemonicWords(words);
      setStep('SHOW_MNEMONIC');
    } catch {
      setError('Failed to create wallet');
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
        setError('One or more words are incorrect. Please check your backup.');
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
      setError('Please fill in all 12 words');
      return;
    }
    if (importPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await importFromMnemonic(words, importPassword);
    } catch (err: any) {
      setError(err?.message || 'Invalid recovery phrase');
    } finally {
      setLoading(false);
    }
  };

  // ─── Import from secret key ────────────────────────────────────
  const handleImportKey = async () => {
    if (!importKey.trim()) {
      setError('Paste your secret key');
      return;
    }
    if (importPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await importFromSecretKey(importKey.trim(), importPassword);
    } catch {
      setError('Invalid secret key');
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
            <p className="text-white/40 text-sm text-center mb-8">
              Your keys, your coins. No extensions. No middlemen.
            </p>
            <button onClick={() => setStep('CREATE_PASSWORD')} className="w-full btn-primary">
              Create New Wallet
            </button>
            <button onClick={() => setStep('IMPORT_CHOICE')} className="w-full btn-secondary">
              Import Existing
            </button>
            <p className="text-white/20 text-xs text-center font-mono mt-8">
              Your recovery phrase and private key are encrypted
              <br />
              and stored only on this device.
            </p>
          </div>
        )}

        {/* ── CREATE PASSWORD ─────────────────── */}
        {step === 'CREATE_PASSWORD' && (
          <div className="space-y-4">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-6">
              Set Password
            </p>
            <input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT_CLASS}
            />
            <input
              type="password"
              placeholder="Confirm password"
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
              {loading ? 'Creating...' : 'Create Wallet'}
            </button>
            <button
              onClick={() => goBack('CHOICE')}
              className="w-full text-white/30 text-xs font-mono hover:text-white/50 transition py-2"
            >
              &larr; Back
            </button>
          </div>
        )}

        {/* ── SHOW MNEMONIC (12 words) ──────────── */}
        {step === 'SHOW_MNEMONIC' && (
          <div className="space-y-4">
            <p className="text-xs tracking-[0.3em] text-gold-500 uppercase font-mono mb-2">
              Recovery Phrase
            </p>
            <p className="text-white/40 text-xs mb-4">
              Write down these 12 words in order. This is the only way to recover your wallet. Never
              share them with anyone.
            </p>

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
              {copied ? 'Copied! (clears in 30s)' : 'Copy to Clipboard'}
            </button>

            <div className="bg-red-500/10 border border-red-500/30 px-4 py-3">
              <p className="text-red-400 text-xs font-mono">
                Do NOT screenshot. Write these words on paper and store safely.
              </p>
            </div>

            <button onClick={handleProceedToConfirm} className="w-full btn-primary">
              I Wrote It Down &rarr;
            </button>
          </div>
        )}

        {/* ── CONFIRM MNEMONIC ──────────────────── */}
        {step === 'CONFIRM_MNEMONIC' && (
          <div className="space-y-4">
            <p className="text-xs tracking-[0.3em] text-gold-500 uppercase font-mono mb-2">
              Verify Backup
            </p>
            <p className="text-white/40 text-xs mb-4">
              Enter the words for the following positions to confirm your backup.
            </p>

            {confirmIndices.map((idx) => (
              <div key={idx}>
                <label className="text-white/30 text-xs font-mono mb-1 block">
                  Word #{idx + 1}
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
                  placeholder={`Enter word #${idx + 1}`}
                />
              </div>
            ))}

            {error && <p className="text-red-400 text-xs font-mono">{error}</p>}

            <button
              onClick={handleConfirmMnemonic}
              disabled={!allConfirmFilled}
              className="w-full btn-primary disabled:opacity-50"
            >
              Confirm &amp; Continue
            </button>
            <button
              onClick={() => goBack('SHOW_MNEMONIC')}
              className="w-full text-white/30 text-xs font-mono hover:text-white/50 transition py-2"
            >
              &larr; Show Words Again
            </button>
          </div>
        )}

        {/* ── IMPORT CHOICE ─────────────────────── */}
        {step === 'IMPORT_CHOICE' && (
          <div className="space-y-4">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-6">
              Import Wallet
            </p>
            <button
              onClick={() => {
                setError('');
                setStep('IMPORT_MNEMONIC');
              }}
              className="w-full btn-primary"
            >
              Recovery Phrase (12 words)
            </button>
            <button
              onClick={() => {
                setError('');
                setStep('IMPORT_KEY');
              }}
              className="w-full btn-secondary"
            >
              Secret Key (base58)
            </button>
            <button
              onClick={() => goBack('CHOICE')}
              className="w-full text-white/30 text-xs font-mono hover:text-white/50 transition py-2"
            >
              &larr; Back
            </button>
          </div>
        )}

        {/* ── IMPORT MNEMONIC ──────────────────── */}
        {step === 'IMPORT_MNEMONIC' && (
          <div className="space-y-4">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-4">
              Enter Recovery Phrase
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
              placeholder="Set a password to encrypt it"
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
              {loading ? 'Importing...' : 'Import Wallet'}
            </button>
            <button
              onClick={() => goBack('IMPORT_CHOICE')}
              className="w-full text-white/30 text-xs font-mono hover:text-white/50 transition py-2"
            >
              &larr; Back
            </button>
          </div>
        )}

        {/* ── IMPORT SECRET KEY ────────────────── */}
        {step === 'IMPORT_KEY' && (
          <div className="space-y-4">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-6">
              Import via Secret Key
            </p>
            <textarea
              placeholder="Paste your base58 secret key"
              value={importKey}
              onChange={(e) => setImportKey(e.target.value)}
              rows={3}
              className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/20 focus:border-gold-500 outline-none font-mono text-xs resize-none"
            />
            <input
              type="password"
              placeholder="Set a password to encrypt it"
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
              {loading ? 'Importing...' : 'Import & Encrypt'}
            </button>
            <button
              onClick={() => goBack('IMPORT_CHOICE')}
              className="w-full text-white/30 text-xs font-mono hover:text-white/50 transition py-2"
            >
              &larr; Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
