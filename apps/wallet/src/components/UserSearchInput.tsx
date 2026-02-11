import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PublicKey } from '@solana/web3.js';
import { apiFetch } from '../lib/apiClient';

export interface ResolvedUser {
  walletAddress: string;
  displayName?: string | null;
  username?: string | null;
  citizenNumber?: number | null;
}

interface UserSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onResolve: (user: ResolvedUser | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Reusable input that resolves @username, #citizen, or raw Solana addresses.
 * Shows resolving spinner, error states, and resolved user preview.
 */
export default function UserSearchInput({
  value,
  onChange,
  onResolve,
  placeholder,
  disabled,
}: UserSearchInputProps) {
  const { t } = useTranslation();
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');
  const [resolved, setResolved] = useState<ResolvedUser | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const doLookup = useCallback(
    async (trimmed: string) => {
      let param = '';
      if (trimmed.startsWith('@')) {
        const username = trimmed.slice(1);
        if (username.length < 3) {
          setError(t('send.usernameTooShort'));
          onResolve(null);
          setResolved(null);
          return;
        }
        param = `username=${encodeURIComponent(username)}`;
      } else if (trimmed.startsWith('#')) {
        const citizen = trimmed.slice(1);
        if (!/^\d+$/.test(citizen)) {
          setError(t('send.invalidCitizen'));
          onResolve(null);
          setResolved(null);
          return;
        }
        param = `citizen=${citizen}`;
      } else {
        return; // not a lookup query
      }

      setResolving(true);
      setError('');
      try {
        const data = await apiFetch<ResolvedUser>(`/social/lookup?${param}`);
        setResolved(data);
        onResolve(data);
        setError('');
      } catch {
        setError(trimmed.startsWith('@') ? t('send.usernameNotFound') : t('send.citizenNotFound'));
        setResolved(null);
        onResolve(null);
      } finally {
        setResolving(false);
      }
    },
    [t, onResolve]
  );

  useEffect(() => {
    const trimmed = value.trim();

    if (!trimmed) {
      setError('');
      setResolved(null);
      onResolve(null);
      return;
    }

    // @username or #citizen → debounced API lookup
    if (trimmed.startsWith('@') || trimmed.startsWith('#')) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doLookup(trimmed), 400);
      return;
    }

    // Plain Solana address → validate locally
    try {
      new PublicKey(trimmed);
      setError('');
      setResolved(null);
      onResolve({ walletAddress: trimmed });
    } catch {
      if (trimmed.length > 10) {
        setError(t('send.invalidAddress'));
      }
      setResolved(null);
      onResolve(null);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, doLookup, onResolve, t]);

  return (
    <div className="space-y-1">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || t('send.enterUsernameOrAddress')}
        disabled={disabled}
        className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-gold-500 disabled:opacity-50"
      />

      {resolving && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <span className="inline-block w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
          {t('send.resolving')}
        </p>
      )}

      {error && !resolving && <p className="text-xs text-red-400">{error}</p>}

      {resolved && !resolving && !error && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-gold-500/10 border border-gold-500/20 rounded text-xs">
          <div className="w-6 h-6 rounded-full bg-gold-500/30 flex items-center justify-center text-gold-400 font-bold text-[10px]">
            {(resolved.displayName || resolved.username || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-gold-400 font-medium truncate">
              {resolved.displayName || `@${resolved.username}`}
            </p>
            {resolved.citizenNumber && (
              <p className="text-gray-400 text-[10px]">
                {t('send.resolvedCitizen', { number: resolved.citizenNumber })}
              </p>
            )}
          </div>
          <p className="text-gray-500 font-mono text-[10px]">
            {resolved.walletAddress.slice(0, 4)}...{resolved.walletAddress.slice(-4)}
          </p>
        </div>
      )}
    </div>
  );
}
