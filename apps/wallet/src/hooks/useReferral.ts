import { useEffect } from 'react';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { useAuth } from './useAuth';
import { API_URL } from '../config';

const REF_STORAGE_KEY = 'mvga_ref_code';

export function useReferral() {
  const { connected } = useSelfCustodyWallet();
  const { isAuthenticated } = useAuth();

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
    if (!connected || !isAuthenticated) return;

    const code = localStorage.getItem(REF_STORAGE_KEY);
    if (!code) return;

    fetch(`${API_URL}/referrals/claim`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
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
  }, [connected, isAuthenticated]);
}
