import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
export default function Header() {
    const { connected, publicKey } = useWallet();
    return (_jsx("header", { className: "sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-lg border-b border-white/10", children: _jsxs("div", { className: "max-w-lg mx-auto px-4 py-3 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent", children: "MVGA" }), connected && (_jsxs("span", { className: "text-xs text-gray-500 hidden sm:block", children: [publicKey?.toBase58().slice(0, 4), "...", publicKey?.toBase58().slice(-4)] }))] }), _jsx(WalletMultiButton, { style: {
                        background: connected ? 'rgba(255,255,255,0.1)' : '#f59e0b',
                        color: connected ? '#fff' : '#000',
                        borderRadius: '9999px',
                        fontSize: '14px',
                        height: '36px',
                        padding: '0 16px',
                    } })] }) }));
}
//# sourceMappingURL=Header.js.map