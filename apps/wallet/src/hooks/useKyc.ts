import { useEffect, useCallback, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useWalletStore } from '../stores/walletStore';
import type { KycStatus } from '../stores/walletStore';

interface KycStatusResponse {
  status: KycStatus;
  tier: number;
  rejectionReason?: string;
}

interface KycSessionResponse {
  // Common
  provider: 'persona' | 'sumsub' | 'mock';
  mock?: boolean;
  // Sumsub
  token?: string;
  applicantId?: string;
  // Persona
  inquiryId?: string;
  templateId?: string;
  environmentId?: string;
  referenceId?: string;
}

export function useKyc() {
  const isConnected = useWalletStore((s) => s.isConnected);
  const kycStatus = useWalletStore((s) => s.kycStatus);
  const kycTier = useWalletStore((s) => s.kycTier);
  const setKycStatus = useWalletStore((s) => s.setKycStatus);
  const setKycTier = useWalletStore((s) => s.setKycTier);
  const [loading, setLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<KycStatusResponse>('/kyc/status');
      setKycStatus(data.status);
      setKycTier(data.tier);
      setRejectionReason(data.rejectionReason);
    } catch {
      // Not authenticated yet or API down — keep current state
    }
  }, [setKycStatus, setKycTier]);

  const createSession = useCallback(async (): Promise<KycSessionResponse | null> => {
    setLoading(true);
    try {
      const data = await apiFetch<KycSessionResponse>('/kyc/session', { method: 'POST' });
      setKycStatus('PENDING');
      return data;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [setKycStatus]);

  // Fetch status on mount when authenticated
  useEffect(() => {
    if (isConnected) refresh();
  }, [isConnected, refresh]);

  // Poll every 10s when PENDING
  useEffect(() => {
    if (kycStatus !== 'PENDING') return;
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [kycStatus, refresh]);

  return { status: kycStatus, tier: kycTier, loading, rejectionReason, createSession, refresh };
}
