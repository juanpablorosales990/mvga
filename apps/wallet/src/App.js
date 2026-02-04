import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Routes, Route, Navigate } from 'react-router-dom';
import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider, } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';
// Pages
import WalletPage from './pages/WalletPage';
import SendPage from './pages/SendPage';
import ReceivePage from './pages/ReceivePage';
import SwapPage from './pages/SwapPage';
import StakePage from './pages/StakePage';
import P2PPage from './pages/P2PPage';
// Components
import BottomNav from './components/BottomNav';
import Header from './components/Header';
function App() {
    // Solana network - use devnet for testing, mainnet-beta for production
    const network = 'mainnet-beta';
    const endpoint = useMemo(() => clusterApiUrl(network), []);
    // Supported wallets
    const wallets = useMemo(() => [
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(),
    ], []);
    return (_jsx(ConnectionProvider, { endpoint: endpoint, children: _jsx(WalletProvider, { wallets: wallets, autoConnect: true, children: _jsx(WalletModalProvider, { children: _jsxs("div", { className: "min-h-screen bg-[#0a0a0a] text-white flex flex-col", children: [_jsx(Header, {}), _jsx("main", { className: "flex-1 pb-20 px-4 pt-4 max-w-lg mx-auto w-full", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(WalletPage, {}) }), _jsx(Route, { path: "/send", element: _jsx(SendPage, {}) }), _jsx(Route, { path: "/receive", element: _jsx(ReceivePage, {}) }), _jsx(Route, { path: "/swap", element: _jsx(SwapPage, {}) }), _jsx(Route, { path: "/stake", element: _jsx(StakePage, {}) }), _jsx(Route, { path: "/p2p", element: _jsx(P2PPage, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) }), _jsx(BottomNav, {})] }) }) }) }));
}
export default App;
//# sourceMappingURL=App.js.map