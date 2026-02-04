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
    publicKey: string | null;
    isConnected: boolean;
    balances: TokenBalance[];
    totalUsdValue: number;
    isLoadingBalances: boolean;
    activeTab: 'wallet' | 'send' | 'receive' | 'swap' | 'stake' | 'p2p';
    setPublicKey: (key: string | null) => void;
    setConnected: (connected: boolean) => void;
    setBalances: (balances: TokenBalance[]) => void;
    setLoadingBalances: (loading: boolean) => void;
    setActiveTab: (tab: WalletState['activeTab']) => void;
    disconnect: () => void;
}
export declare const useWalletStore: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<WalletState>, "persist"> & {
    persist: {
        setOptions: (options: Partial<import("zustand/middleware").PersistOptions<WalletState, {
            publicKey: string | null;
        }>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void> | void;
        hasHydrated: () => boolean;
        onHydrate: (fn: (state: WalletState) => void) => () => void;
        onFinishHydration: (fn: (state: WalletState) => void) => () => void;
        getOptions: () => Partial<import("zustand/middleware").PersistOptions<WalletState, {
            publicKey: string | null;
        }>>;
    };
}>;
export declare const TOKENS: {
    SOL: {
        mint: string;
        symbol: string;
        name: string;
        decimals: number;
        logoUrl: string;
    };
    USDC: {
        mint: string;
        symbol: string;
        name: string;
        decimals: number;
        logoUrl: string;
    };
    USDT: {
        mint: string;
        symbol: string;
        name: string;
        decimals: number;
        logoUrl: string;
    };
    MVGA: {
        mint: string;
        symbol: string;
        name: string;
        decimals: number;
        logoUrl: string;
    };
};
export {};
//# sourceMappingURL=walletStore.d.ts.map