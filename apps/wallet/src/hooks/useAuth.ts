import { useEffect, useCallback, useRef } from 'react';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { useWalletStore } from '../stores/walletStore';
import { showToast } from './useToast';
import bs58 from 'bs58';
import { API_URL } from '../config';

// Singleton promise so only one authenticate() runs at a time across all hook instances
let authPromise: Promise<void> | null = null;

/** Decode JWT payload and check if expired (with 60s buffer) */
function isTokenExpired(token: string): boolean {
  try {
    const [, payload] = token.split('.');
    const decoded = JSON.parse(atob(payload));
    return decoded.exp * 1000 < Date.now() + 60_000;
  } catch {
    return true;
  }
}

export function useAuth() {
  const { connected, publicKey, signMessage } = useSelfCustodyWallet();
  const { authToken, setAuthToken } = useWalletStore();
  const hasAutoAuthed = useRef(false);

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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress }),
        });

        if (!nonceRes.ok) {
          if (nonceRes.status === 429) {
            showToast('error', 'Too many requests. Please wait a moment.');
          } else {
            showToast('error', 'Authentication failed. Please try again.');
          }
          return;
        }
        const { message } = await nonceRes.json();

        // 2. Sign the message with our keypair
        const encodedMessage = new TextEncoder().encode(message);
        const signatureBytes = await signMessage(encodedMessage);
        const signature = bs58.encode(signatureBytes);

        // 3. Verify signature and get JWT
        const verifyRes = await fetch(`${API_URL}/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress, signature }),
        });

        if (!verifyRes.ok) {
          if (verifyRes.status === 429) {
            showToast('error', 'Too many requests. Please wait a moment.');
          } else {
            showToast('error', 'Signature verification failed. Please try again.');
          }
          return;
        }
        const { accessToken } = await verifyRes.json();

        setAuthToken(accessToken);
      } catch {
        showToast('error', 'Network error. Please check your connection.');
      }
    };

    authPromise = run();
    try {
      await authPromise;
    } finally {
      authPromise = null;
    }
  }, [connected, publicKey, signMessage, setAuthToken]);

  // Auto-authenticate on wallet unlock (once per connect cycle)
  useEffect(() => {
    if (!connected || !publicKey) {
      setAuthToken(null);
      hasAutoAuthed.current = false;
      // Cancel any in-flight authentication to prevent stale token writes
      authPromise = null;
      return;
    }

    // If we have a valid (non-expired) token, skip
    if (authToken && !isTokenExpired(authToken)) {
      hasAutoAuthed.current = true;
      return;
    }

    // Clear stale/expired token
    if (authToken && isTokenExpired(authToken)) {
      setAuthToken(null);
    }

    // Only auto-auth once per connect cycle to avoid races
    if (!hasAutoAuthed.current) {
      hasAutoAuthed.current = true;
      authenticate();
    }
  }, [connected, publicKey, authToken, authenticate, setAuthToken]);

  return { authToken, authenticate, isAuthenticated: !!authToken && !isTokenExpired(authToken) };
}
