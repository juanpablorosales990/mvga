import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import TokenCard from '../components/TokenCard';
export default function WalletPage() {
    const { connected, publicKey } = useWallet();
    const { connection } = useConnection();
    const [balances, setBalances] = useState([]);
    const [totalValue, setTotalValue] = useState(0);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        async function fetchBalances() {
            if (!connected || !publicKey) {
                setBalances([]);
                setTotalValue(0);
                return;
            }
            setLoading(true);
            try {
                // Fetch SOL balance
                const solBalance = await connection.getBalance(publicKey);
                const solAmount = solBalance / LAMPORTS_PER_SOL;
                // For now, use placeholder USD values
                // In production, fetch from Jupiter or CoinGecko
                const solPrice = 150; // Placeholder
                const newBalances = [
                    {
                        symbol: 'SOL',
                        name: 'Solana',
                        balance: solAmount,
                        usdValue: solAmount * solPrice,
                        logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
                    },
                    // TODO: Fetch actual SPL token balances (USDC, USDT, MVGA)
                    {
                        symbol: 'USDC',
                        name: 'USD Coin',
                        balance: 0,
                        usdValue: 0,
                        logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
                    },
                    {
                        symbol: 'MVGA',
                        name: 'Make Venezuela Great Again',
                        balance: 0,
                        usdValue: 0,
                        logoUrl: '/mvga-logo.png',
                    },
                ];
                setBalances(newBalances);
                setTotalValue(newBalances.reduce((sum, b) => sum + b.usdValue, 0));
            }
            catch (error) {
                console.error('Error fetching balances:', error);
            }
            finally {
                setLoading(false);
            }
        }
        fetchBalances();
        // Refresh every 30 seconds
        const interval = setInterval(fetchBalances, 30000);
        return () => clearInterval(interval);
    }, [connected, publicKey, connection]);
    if (!connected) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center min-h-[60vh] text-center", children: [_jsx("div", { className: "w-20 h-20 bg-primary-500/20 rounded-full flex items-center justify-center mb-6", children: _jsx("svg", { className: "w-10 h-10 text-primary-500", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" }) }) }), _jsx("h2", { className: "text-2xl font-bold mb-2", children: "Welcome to MVGA" }), _jsx("p", { className: "text-gray-400 mb-6 max-w-sm", children: "Connect your wallet to view balances, send tokens, and participate in the Venezuelan financial revolution." }), _jsx("p", { className: "text-sm text-gray-500", children: "Click \"Connect Wallet\" above to get started" })] }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "card text-center py-8", children: [_jsx("p", { className: "text-gray-400 text-sm mb-1", children: "Total Balance" }), _jsxs("h1", { className: "text-4xl font-bold mb-1", children: ["$", totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })] }), _jsxs("p", { className: "text-gray-500 text-sm", children: [publicKey?.toBase58().slice(0, 8), "...", publicKey?.toBase58().slice(-8)] })] }), _jsx("div", { className: "grid grid-cols-4 gap-3", children: [
                    { label: 'Send', icon: '↑', href: '/send', color: 'bg-blue-500' },
                    { label: 'Receive', icon: '↓', href: '/receive', color: 'bg-green-500' },
                    { label: 'Swap', icon: '⇄', href: '/swap', color: 'bg-purple-500' },
                    { label: 'Stake', icon: '◎', href: '/stake', color: 'bg-primary-500' },
                ].map((action) => (_jsxs("a", { href: action.href, className: "flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition", children: [_jsx("div", { className: `w-10 h-10 ${action.color} rounded-full flex items-center justify-center text-white font-bold`, children: action.icon }), _jsx("span", { className: "text-xs text-gray-400", children: action.label })] }, action.label))) }), _jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold mb-3", children: "Assets" }), loading ? (_jsx("div", { className: "space-y-3", children: [1, 2, 3].map((i) => (_jsx("div", { className: "card animate-pulse", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-10 h-10 bg-gray-700 rounded-full" }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "h-4 bg-gray-700 rounded w-20 mb-2" }), _jsx("div", { className: "h-3 bg-gray-700 rounded w-16" })] })] }) }, i))) })) : (_jsx("div", { className: "space-y-3", children: balances.map((token) => (_jsx(TokenCard, { token: token }, token.symbol))) }))] })] }));
}
//# sourceMappingURL=WalletPage.js.map