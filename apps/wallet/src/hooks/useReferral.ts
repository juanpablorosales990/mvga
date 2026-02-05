import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuth } from './useAuth';

const REF_STORAGE_KEY = 'mvga_ref_code';

export function useReferral() {
  const { connected } = useWallet();
  const { authToken } = useAuth();

  // Capture ?ref= param on first load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && ref.length === 6) {
      localStorage.setItem(REF_STORAGE_KEY, ref);
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // Claim referral after wallet connect
  useEffect(() => {
    if (!connected || !authToken) return;

    const code = localStorage.getItem(REF_STORAGE_KEY);
    if (!code) return;

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

    fetch(`${API_URL}/referrals/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ code }),
    })
      .then((res) => {
        if (res.ok) {
          localStorage.removeItem(REF_STORAGE_KEY);
        }
      })
      .catch(() => {
        // Will retry on next connect
      });
  }, [connected, authToken]);
}
