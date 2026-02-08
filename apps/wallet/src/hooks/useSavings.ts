import { useState, useEffect, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { API_URL } from '../config';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { apiFetch } from '../lib/apiClient';

interface YieldRate {
  protocol: string;
  token: string;
  supplyApy: number;
}

interface SavingsPosition {
  id: string;
  protocol: string;
  token: string;
  depositedAmount: number;
  currentAmount: number;
  earnedYield: number;
  apy: number;
  status: string;
  createdAt: string;
}

interface SavingsData {
  positions: SavingsPosition[];
  totalDeposited: number;
  totalCurrent: number;
}

// Mock fallback rates
const FALLBACK_RATES: YieldRate[] = [
  { protocol: 'Kamino', token: 'USDC', supplyApy: 5.2 },
  { protocol: 'Kamino', token: 'USDT', supplyApy: 4.8 },
];

interface DepositResponse {
  positionId: string;
  amount: number;
  token: string;
  transaction?: string;
}

interface WithdrawResponse {
  positionId: string;
  amount: number;
  token: string;
  transaction?: string;
}

export function useSavings(walletAddress: string | null) {
  const { connection } = useConnection();
  const { sendTransaction, connected } = useSelfCustodyWallet();

  const [rates, setRates] = useState<YieldRate[]>(FALLBACK_RATES);
  const [positions, setPositions] = useState<SavingsData | null>(null);
  const [loadingRates, setLoadingRates] = useState(true);
  const [loadingPositions, setLoadingPositions] = useState(false);

  // Fetch live APY rates
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/savings/rates`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: YieldRate[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setRates(data);
        }
      })
      .catch(() => {
        // Use fallback rates on error
      })
      .finally(() => setLoadingRates(false));
    return () => controller.abort();
  }, []);

  // Fetch user positions
  useEffect(() => {
    if (!walletAddress) {
      setLoadingPositions(false);
      return;
    }
    const controller = new AbortController();
    setLoadingPositions(true);
    fetch(`${API_URL}/savings/positions`, { signal: controller.signal, credentials: 'include' })
      .then((r) => r.json())
      .then((data: SavingsData) => setPositions(data))
      .catch(() => {
        // No positions available
      })
      .finally(() => setLoadingPositions(false));
    return () => controller.abort();
  }, [walletAddress]);

  const bestApy = rates.reduce((best, r) => Math.max(best, r.supplyApy), 0);

  const refresh = useCallback(() => {
    if (!walletAddress) return;
    fetch(`${API_URL}/savings/positions`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data: SavingsData) => setPositions(data))
      .catch(() => {});
  }, [walletAddress]);

  const deposit = useCallback(
    async (amount: number, token = 'USDC') => {
      const result = await apiFetch<DepositResponse>('/savings/deposit', {
        method: 'POST',
        body: JSON.stringify({ amount, token }),
      });

      let signature: string;
      if (result.transaction && connected) {
        // Deserialize the unsigned transaction from the API and sign+send it
        const tx = Transaction.from(Buffer.from(result.transaction, 'base64'));
        signature = await sendTransaction(tx, connection);
      } else {
        // Fallback: mock signature when no transaction available
        signature = `mock_${Date.now()}`;
      }

      await apiFetch('/savings/confirm-deposit', {
        method: 'POST',
        body: JSON.stringify({ signature }),
      });
      refresh();
      return result;
    },
    [refresh, connected, sendTransaction, connection]
  );

  const withdraw = useCallback(
    async (positionId: string, amount?: number) => {
      const result = await apiFetch<WithdrawResponse>('/savings/withdraw', {
        method: 'POST',
        body: JSON.stringify({ positionId, amount }),
      });

      let signature: string;
      if (result.transaction && connected) {
        const tx = Transaction.from(Buffer.from(result.transaction, 'base64'));
        signature = await sendTransaction(tx, connection);
      } else {
        signature = `mock_${Date.now()}`;
      }

      await apiFetch('/savings/confirm-withdraw', {
        method: 'POST',
        body: JSON.stringify({ positionId, signature }),
      });
      refresh();
      return result;
    },
    [refresh, connected, sendTransaction, connection]
  );

  return {
    rates,
    positions,
    bestApy,
    loadingRates,
    loadingPositions,
    refresh,
    deposit,
    withdraw,
  };
}
