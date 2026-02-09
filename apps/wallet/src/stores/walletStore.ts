import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CardStatus } from '../services/cardService.types';

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

export interface RecentRecipient {
  address: string;
  label?: string;
  lastUsed: number;
}

export interface PriceAlert {
  id: string;
  token: string; // SOL, USDC, MVGA
  condition: 'above' | 'below';
  targetPrice: number;
  triggered: boolean;
  createdAt: number;
}

interface WalletState {
  // Wallet
  publicKey: string | null;
  isConnected: boolean;

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
  cardStatus: CardStatus;

  // Recent Recipients
  recentRecipients: RecentRecipient[];

  // Price Alerts
  priceAlerts: PriceAlert[];

  // Pending scheduled executions (not persisted, fetched from API)
  pendingExecutionCount: number;

  // Balance refresh trigger
  balanceVersion: number;

  // Onboarding
  tourCompleted: boolean;
  checklistDismissed: boolean;
  firstSendCompleted: boolean;

  // Actions
  setPublicKey: (key: string | null) => void;
  setConnected: (connected: boolean) => void;
  setBalances: (balances: TokenBalance[]) => void;
  setLoadingBalances: (loading: boolean) => void;
  setActiveTab: (tab: WalletState['activeTab']) => void;
  setPreferredCurrency: (currency: 'USD' | 'VES') => void;
  setAutoCompoundDefault: (enabled: boolean) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (ids: string[]) => void;
  setSavingsGoal: (goal: { targetAmount: number; label: string } | null) => void;
  setCardStatus: (status: CardStatus) => void;
  setCardWaitlisted: (waitlisted: boolean) => void;
  invalidateBalances: () => void;
  addAddress: (entry: Omit<AddressBookEntry, 'createdAt'>) => void;
  removeAddress: (address: string) => void;
  addRecentRecipient: (address: string, label?: string) => void;
  setPendingExecutionCount: (count: number) => void;
  addPriceAlert: (alert: Omit<PriceAlert, 'id' | 'triggered' | 'createdAt'>) => void;
  removePriceAlert: (id: string) => void;
  triggerPriceAlert: (id: string) => void;
  completeTour: () => void;
  dismissChecklist: () => void;
  markFirstSend: () => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      // Initial state
      publicKey: null,
      isConnected: false,
      balances: [],
      totalUsdValue: 0,
      isLoadingBalances: false,
      activeTab: 'wallet',
      preferredCurrency: 'USD',
      addressBook: [],
      recentRecipients: [],
      priceAlerts: [],
      pendingExecutionCount: 0,
      autoCompoundDefault: false,
      readNotifications: [],
      savingsGoal: null,
      cardStatus: 'none' as CardStatus,
      balanceVersion: 0,
      tourCompleted: false,
      checklistDismissed: false,
      firstSendCompleted: false,

      // Actions
      setPublicKey: (key) => set({ publicKey: key, isConnected: !!key }),
      setConnected: (connected) => set({ isConnected: connected }),
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
      setCardStatus: (status) => set({ cardStatus: status }),
      setCardWaitlisted: (waitlisted) => set({ cardStatus: waitlisted ? 'waitlisted' : 'none' }),
      invalidateBalances: () => set((state) => ({ balanceVersion: state.balanceVersion + 1 })),
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
      addRecentRecipient: (address, label) =>
        set((state) => {
          const filtered = state.recentRecipients.filter((r) => r.address !== address);
          return {
            recentRecipients: [{ address, label, lastUsed: Date.now() }, ...filtered].slice(0, 5),
          };
        }),
      setPendingExecutionCount: (count) => set({ pendingExecutionCount: count }),
      addPriceAlert: (alert) =>
        set((state) => ({
          priceAlerts: [
            ...state.priceAlerts,
            { ...alert, id: crypto.randomUUID(), triggered: false, createdAt: Date.now() },
          ],
        })),
      removePriceAlert: (id) =>
        set((state) => ({
          priceAlerts: state.priceAlerts.filter((a) => a.id !== id),
        })),
      triggerPriceAlert: (id) =>
        set((state) => ({
          priceAlerts: state.priceAlerts.map((a) => (a.id === id ? { ...a, triggered: true } : a)),
        })),
      completeTour: () => set({ tourCompleted: true }),
      dismissChecklist: () => set({ checklistDismissed: true }),
      markFirstSend: () => set({ firstSendCompleted: true }),
      disconnect: () =>
        set({
          publicKey: null,
          isConnected: false,
          balances: [],
          totalUsdValue: 0,
        }),
    }),
    {
      name: 'mvga-wallet-storage',
      partialize: (state) => ({
        publicKey: state.publicKey,
        preferredCurrency: state.preferredCurrency,
        addressBook: state.addressBook,
        recentRecipients: state.recentRecipients,
        priceAlerts: state.priceAlerts,
        autoCompoundDefault: state.autoCompoundDefault,
        readNotifications: state.readNotifications,
        savingsGoal: state.savingsGoal,
        cardStatus: state.cardStatus,
        tourCompleted: state.tourCompleted,
        checklistDismissed: state.checklistDismissed,
        firstSendCompleted: state.firstSendCompleted,
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
