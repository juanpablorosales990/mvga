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

export interface AddressBookEntry {
  label: string;
  address: string;
  createdAt: number;
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
  preferredCurrency: 'USD' | 'VES';

  // Address Book
  addressBook: AddressBookEntry[];

  // Settings
  autoCompoundDefault: boolean;

  // Notifications
  readNotifications: string[];

  // Banking
  savingsGoal: { targetAmount: number; label: string } | null;
  cardWaitlisted: boolean;

  // Actions
  setPublicKey: (key: string | null) => void;
  setConnected: (connected: boolean) => void;
  setAuthToken: (token: string | null) => void;
  setBalances: (balances: TokenBalance[]) => void;
  setLoadingBalances: (loading: boolean) => void;
  setActiveTab: (tab: WalletState['activeTab']) => void;
  setPreferredCurrency: (currency: 'USD' | 'VES') => void;
  setAutoCompoundDefault: (enabled: boolean) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (ids: string[]) => void;
  setSavingsGoal: (goal: { targetAmount: number; label: string } | null) => void;
  setCardWaitlisted: (waitlisted: boolean) => void;
  addAddress: (entry: Omit<AddressBookEntry, 'createdAt'>) => void;
  removeAddress: (address: string) => void;
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
      preferredCurrency: 'USD',
      addressBook: [],
      autoCompoundDefault: false,
      readNotifications: [],
      savingsGoal: null,
      cardWaitlisted: false,

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
      setPreferredCurrency: (currency) => set({ preferredCurrency: currency }),
      setAutoCompoundDefault: (enabled) => set({ autoCompoundDefault: enabled }),
      markNotificationRead: (id) =>
        set((state) => ({
          readNotifications: state.readNotifications.includes(id)
            ? state.readNotifications
            : [...state.readNotifications, id],
        })),
      markAllNotificationsRead: (ids) =>
        set((state) => ({
          readNotifications: [...new Set([...state.readNotifications, ...ids])],
        })),
      setSavingsGoal: (goal) => set({ savingsGoal: goal }),
      setCardWaitlisted: (waitlisted) => set({ cardWaitlisted: waitlisted }),
      addAddress: (entry) =>
        set((state) => ({
          addressBook: [
            ...state.addressBook.filter((a) => a.address !== entry.address),
            { ...entry, createdAt: Date.now() },
          ],
        })),
      removeAddress: (address) =>
        set((state) => ({
          addressBook: state.addressBook.filter((a) => a.address !== address),
        })),
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
        preferredCurrency: state.preferredCurrency,
        addressBook: state.addressBook,
        autoCompoundDefault: state.autoCompoundDefault,
        readNotifications: state.readNotifications,
        savingsGoal: state.savingsGoal,
        cardWaitlisted: state.cardWaitlisted,
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
    logoUrl:
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  },
  USDC: {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoUrl:
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  },
  USDT: {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    logoUrl:
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
  },
  MVGA: {
    mint: 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh',
    symbol: 'MVGA',
    name: 'Make Venezuela Great Again',
    decimals: 9,
    logoUrl: '/mvga-logo.png',
  },
};
