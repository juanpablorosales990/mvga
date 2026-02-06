import { useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletStore } from '../stores/walletStore';
import { showToast } from './useToast';
import bs58 from 'bs58';
import { API_URL } from '../config';

export function useAuth() {
  const { connected, publicKey, signMessage } = useWallet();
  const { authToken, setAuthToken } = useWalletStore();

  const authenticate = useCallback(async () => {
    if (!connected || !publicKey || !signMessage) return;

    const walletAddress = publicKey.toBase58();

    try {
      // 1. Request nonce from server
      const nonceRes = await fetch(`${API_URL}/auth/nonce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });

      if (!nonceRes.ok) return;
      const { message } = await nonceRes.json();

      // 2. Sign the message with wallet
      const encodedMessage = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(encodedMessage);
      const signature = bs58.encode(signatureBytes);

      // 3. Verify signature and get JWT
      const verifyRes = await fetch(`${API_URL}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, signature }),
      });

      if (!verifyRes.ok) return;
      const { accessToken } = await verifyRes.json();

      setAuthToken(accessToken);
    } catch {
      showToast('error', 'Authentication failed. Please try reconnecting.');
    }
  }, [connected, publicKey, signMessage, setAuthToken]);

  // Auto-authenticate when wallet connects and no token exists
  useEffect(() => {
    if (connected && publicKey && !authToken) {
      authenticate();
    }
    if (!connected) {
      setAuthToken(null);
    }
  }, [connected, publicKey, authToken, authenticate, setAuthToken]);

  return { authToken, authenticate, isAuthenticated: !!authToken };
}
