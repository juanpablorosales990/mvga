import { useState } from 'react';
import { useSelfCustodyWallet } from '../contexts/WalletContext';

type Step = 'CHOICE' | 'CREATE_PASSWORD' | 'SHOW_KEY' | 'IMPORT';

export default function OnboardingScreen() {
  const { createWallet, importWallet } = useSelfCustodyWallet();
  const [step, setStep] = useState<Step>('CHOICE');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [importKey, setImportKey] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

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
      const key = await createWallet(password);
      setSecretKey(key);
      setStep('SHOW_KEY');
    } catch {
      setError('Failed to create wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
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
      await importWallet(importKey.trim(), importPassword);
    } catch {
      setError('Invalid secret key or encryption failed');
    } finally {
      setLoading(false);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(secretKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            <button onClick={() => setStep('IMPORT')} className="w-full btn-secondary">
              Import Existing
            </button>
            <p className="text-white/20 text-xs text-center font-mono mt-8">
              Your private key is encrypted and stored locally.
              <br />
              We never have access to your funds.
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
              className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/20 focus:border-gold-500 outline-none font-mono text-sm"
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/20 focus:border-gold-500 outline-none font-mono text-sm"
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
              onClick={() => {
                setStep('CHOICE');
                setError('');
              }}
              className="w-full text-white/30 text-xs font-mono hover:text-white/50 transition py-2"
            >
              ← Back
            </button>
          </div>
        )}

        {/* ── SHOW SECRET KEY ──────────────────── */}
        {step === 'SHOW_KEY' && (
          <div className="space-y-4">
            <p className="text-xs tracking-[0.3em] text-gold-500 uppercase font-mono mb-2">
              Backup Your Secret Key
            </p>
            <p className="text-white/40 text-xs mb-4">
              Save this key somewhere safe. If you lose your password AND this key, your funds are
              gone forever. Never share it with anyone.
            </p>
            <div className="bg-white/5 border border-gold-500/30 p-4 break-all font-mono text-xs text-white/70 leading-relaxed">
              {secretKey}
            </div>
            <button onClick={copyKey} className="w-full btn-secondary">
              {copied ? 'Copied!' : 'Copy Secret Key'}
            </button>
            <button
              onClick={() => {
                // Wallet is already created and unlocked from handleCreate
                // This screen just shows the key — user clicks to proceed
              }}
              className="w-full btn-primary"
            >
              I Saved My Key — Continue
            </button>
            <p className="text-red-400/60 text-xs font-mono text-center">
              This is the only time this key will be shown.
            </p>
          </div>
        )}

        {/* ── IMPORT ──────────────────────────── */}
        {step === 'IMPORT' && (
          <div className="space-y-4">
            <p className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono mb-6">
              Import Wallet
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
              className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/20 focus:border-gold-500 outline-none font-mono text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleImport()}
            />
            {error && <p className="text-red-400 text-xs font-mono">{error}</p>}
            <button
              onClick={handleImport}
              disabled={loading}
              className="w-full btn-primary disabled:opacity-50"
            >
              {loading ? 'Importing...' : 'Import & Encrypt'}
            </button>
            <button
              onClick={() => {
                setStep('CHOICE');
                setError('');
              }}
              className="w-full text-white/30 text-xs font-mono hover:text-white/50 transition py-2"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
