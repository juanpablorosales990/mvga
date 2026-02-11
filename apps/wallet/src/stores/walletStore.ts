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

export type KycStatus = 'UNVERIFIED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export type SpendingPeriod = 'daily' | 'weekly' | 'monthly';

export interface SpendingLimit {
  id: string;
  period: SpendingPeriod;
  amount: number; // USD limit
  token: string; // 'ALL' or specific token
  isActive: boolean;
  createdAt: number;
}

export interface SpendingRecord {
  amount: number; // USD
  token: string;
  timestamp: number; // Unix ms
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

  // Spending Limits
  spendingLimits: SpendingLimit[];
  spendingHistory: SpendingRecord[];

  // Pending scheduled executions (not persisted, fetched from API)
  pendingExecutionCount: number;

  // Balance refresh trigger
  balanceVersion: number;

  // KYC
  kycStatus: KycStatus;
  kycTier: number;

  // Profile
  email: string | null;
  displayName: string | null;
  username: string | null;
  citizenNumber: number | null;

  // Onboarding
  tourCompleted: boolean;
  wizardCompleted: boolean;
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
  addSpendingLimit: (limit: Omit<SpendingLimit, 'id' | 'createdAt'>) => void;
  removeSpendingLimit: (id: string) => void;
  toggleSpendingLimit: (id: string) => void;
  recordSpending: (amount: number, token: string) => void;
  setKycStatus: (status: KycStatus) => void;
  setKycTier: (tier: number) => void;
  setProfile: (profile: {
    email?: string | null;
    displayName?: string | null;
    username?: string | null;
    citizenNumber?: number | null;
  }) => void;
  completeTour: () => void;
  completeWizard: () => void;
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
      spendingLimits: [],
      spendingHistory: [],
      pendingExecutionCount: 0,
      autoCompoundDefault: false,
      readNotifications: [],
      savingsGoal: null,
      cardStatus: 'none' as CardStatus,
      balanceVersion: 0,
      kycStatus: 'UNVERIFIED' as KycStatus,
      kycTier: 0,
      email: null,
      displayName: null,
      username: null,
      citizenNumber: null,
      tourCompleted: false,
      wizardCompleted: false,
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
      addSpendingLimit: (limit) =>
        set((state) => ({
          spendingLimits: [
            ...state.spendingLimits,
            { ...limit, id: crypto.randomUUID(), createdAt: Date.now() },
          ],
        })),
      removeSpendingLimit: (id) =>
        set((state) => ({
          spendingLimits: state.spendingLimits.filter((l) => l.id !== id),
        })),
      toggleSpendingLimit: (id) =>
        set((state) => ({
          spendingLimits: state.spendingLimits.map((l) =>
            l.id === id ? { ...l, isActive: !l.isActive } : l
          ),
        })),
      recordSpending: (amount, token) =>
        set((state) => ({
          spendingHistory: [
            ...state.spendingHistory.filter(
              (r) => r.timestamp > Date.now() - 31 * 24 * 60 * 60 * 1000 // keep last 31 days
            ),
            { amount, token, timestamp: Date.now() },
          ],
        })),
      setKycStatus: (status) => set({ kycStatus: status }),
      setKycTier: (tier) => set({ kycTier: tier }),
      setProfile: (profile) =>
        set((state) => ({
          email: profile.email !== undefined ? profile.email : state.email,
          displayName: profile.displayName !== undefined ? profile.displayName : state.displayName,
          username: profile.username !== undefined ? profile.username : state.username,
          citizenNumber:
            profile.citizenNumber !== undefined ? profile.citizenNumber : state.citizenNumber,
        })),
      completeTour: () => set({ tourCompleted: true }),
      completeWizard: () => set({ wizardCompleted: true }),
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
        spendingLimits: state.spendingLimits,
        spendingHistory: state.spendingHistory,
        autoCompoundDefault: state.autoCompoundDefault,
        readNotifications: state.readNotifications,
        savingsGoal: state.savingsGoal,
        cardStatus: state.cardStatus,
        kycStatus: state.kycStatus,
        kycTier: state.kycTier,
        email: state.email,
        displayName: state.displayName,
        username: state.username,
        citizenNumber: state.citizenNumber,
        tourCompleted: state.tourCompleted,
        wizardCompleted: state.wizardCompleted,
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
