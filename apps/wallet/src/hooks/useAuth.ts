import { useEffect, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { showToast } from './useToast';
import bs58 from 'bs58';
import { API_URL } from '../config';
import { apiFetch } from '../lib/apiClient';

// Singleton promise so only one authenticate() runs at a time across all hook instances
let authPromise: Promise<void> | null = null;

export function useAuth() {
  const { t } = useTranslation();
  const { connected, publicKey, signMessage } = useSelfCustodyWallet();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const hasAutoAuthed = useRef(false);

  /** Check auth status via httpOnly cookie (server validates) */
  const checkAuth = useCallback(async (): Promise<boolean> => {
    try {
      const res = await apiFetch<{ authenticated: boolean }>('/auth/me');
      setIsAuthenticated(res.authenticated);
      return res.authenticated;
    } catch {
      setIsAuthenticated(false);
      return false;
    }
  }, []);

  const authenticate = useCallback(async () => {
    if (!connected || !publicKey || !signMessage) return;

    // If another authenticate() is in-flight, wait for it instead of racing
    if (authPromise) {
      await authPromise;
      return;
    }

    const walletAddress = publicKey.toBase58();

    const run = async () => {
      try {
        // 1. Request nonce from server
        const nonceRes = await fetch(`${API_URL}/auth/nonce`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress }),
        });

        if (!nonceRes.ok) {
          if (nonceRes.status === 429) {
            showToast('error', t('auth.rateLimited'));
          } else {
            showToast('error', t('auth.authFailed'));
          }
          return;
        }
        const { message } = await nonceRes.json();

        // 2. Sign the message with our keypair
        const encodedMessage = new TextEncoder().encode(message);
        const signatureBytes = await signMessage(encodedMessage);
        const signature = bs58.encode(signatureBytes);

        // 3. Verify signature — server sets httpOnly cookie
        const verifyRes = await fetch(`${API_URL}/auth/verify`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress, signature }),
        });

        if (!verifyRes.ok) {
          if (verifyRes.status === 429) {
            showToast('error', t('auth.rateLimited'));
          } else {
            showToast('error', t('auth.verifyFailed'));
          }
          return;
        }

        // Cookie is set by server — verify we're authenticated
        setIsAuthenticated(true);
      } catch {
        showToast('error', t('auth.networkError'));
      }
    };

    authPromise = run();
    try {
      await authPromise;
    } finally {
      authPromise = null;
    }
  }, [connected, publicKey, signMessage, t]);

  /** Clear server-side auth cookie */
  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Best-effort
    }
    setIsAuthenticated(false);
  }, []);

  // Auto-authenticate on wallet unlock (once per connect cycle)
  useEffect(() => {
    if (!connected || !publicKey) {
      hasAutoAuthed.current = false;
      if (isAuthenticated) logout();
      authPromise = null;
      return;
    }

    // Only auto-auth once per connect cycle to avoid races
    if (!hasAutoAuthed.current) {
      hasAutoAuthed.current = true;
      // Check if existing cookie is still valid, otherwise re-authenticate
      checkAuth().then((valid) => {
        if (!valid) authenticate();
      });
    }
  }, [connected, publicKey, isAuthenticated, authenticate, checkAuth, logout]);

  return { isAuthenticated, authenticate, logout };
}
