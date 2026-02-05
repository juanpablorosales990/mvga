import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TokenBalance {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
  usdValue: number;
  logoUrl?: string;
}

interface WalletState {
  // Wallet
  publicKey: string | null;
  isConnected: boolean;

  // Auth
  authToken: string | null;

  // Balances
  balances: TokenBalance[];
  totalUsdValue: number;
  isLoadingBalances: boolean;

  // UI State
  activeTab: 'wallet' | 'send' | 'receive' | 'swap' | 'stake' | 'p2p';

  // Actions
  setPublicKey: (key: string | null) => void;
  setConnected: (connected: boolean) => void;
  setAuthToken: (token: string | null) => void;
  setBalances: (balances: TokenBalance[]) => void;
  setLoadingBalances: (loading: boolean) => void;
  setActiveTab: (tab: WalletState['activeTab']) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      // Initial state
      publicKey: null,
      isConnected: false,
      authToken: null,
      balances: [],
      totalUsdValue: 0,
      isLoadingBalances: false,
      activeTab: 'wallet',

      // Actions
      setPublicKey: (key) => set({ publicKey: key, isConnected: !!key }),
      setConnected: (connected) => set({ isConnected: connected }),
      setAuthToken: (token) => set({ authToken: token }),
      setBalances: (balances) =>
        set({
          balances,
          totalUsdValue: balances.reduce((sum, b) => sum + b.usdValue, 0),
        }),
      setLoadingBalances: (loading) => set({ isLoadingBalances: loading }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      disconnect: () =>
        set({
          publicKey: null,
          isConnected: false,
          authToken: null,
          balances: [],
          totalUsdValue: 0,
        }),
    }),
    {
      name: 'mvga-wallet-storage',
      partialize: (state) => ({
        publicKey: state.publicKey,
        authToken: state.authToken,
      }),
    }
  )
);

// Token addresses (Solana Mainnet)
export const TOKENS = {
  SOL: {
    mint: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  },
  USDC: {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  },
  USDT: {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
  },
  MVGA: {
    mint: 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh',
    symbol: 'MVGA',
    name: 'Make Venezuela Great Again',
    decimals: 9,
    logoUrl: '/mvga-logo.png',
  },
};
