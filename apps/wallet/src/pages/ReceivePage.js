import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useWallet } from '@solana/wallet-adapter-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
export default function ReceivePage() {
    const { connected, publicKey } = useWallet();
    const [copied, setCopied] = useState(false);
    const address = publicKey?.toBase58() || '';
    const handleCopy = async () => {
        if (!address)
            return;
        try {
            await navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
        catch (err) {
            console.error('Failed to copy:', err);
        }
    };
    if (!connected) {
        return (_jsx("div", { className: "flex flex-col items-center justify-center min-h-[60vh] text-center", children: _jsx("p", { className: "text-gray-400", children: "Connect your wallet to receive tokens" }) }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Receive" }), _jsxs("div", { className: "card flex flex-col items-center py-8", children: [_jsx("div", { className: "bg-white p-4 rounded-2xl mb-6", children: _jsx(QRCodeSVG, { value: address, size: 200, level: "H" }) }), _jsx("p", { className: "text-gray-400 text-sm mb-2", children: "Your Solana Address" }), _jsx("p", { className: "text-sm text-center break-all px-4 mb-4 font-mono", children: address }), _jsx("button", { onClick: handleCopy, className: "btn-secondary flex items-center gap-2", children: copied ? (_jsxs(_Fragment, { children: [_jsx("svg", { className: "w-5 h-5 text-green-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }), "Copied!"] })) : (_jsxs(_Fragment, { children: [_jsx("svg", { className: "w-5 h-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" }) }), "Copy Address"] })) })] }), _jsxs("div", { className: "card space-y-3", children: [_jsx("h3", { className: "font-semibold", children: "How to receive" }), _jsxs("ol", { className: "text-sm text-gray-400 space-y-2 list-decimal list-inside", children: [_jsx("li", { children: "Share your QR code or address with the sender" }), _jsx("li", { children: "They can send SOL, USDC, MVGA, or any Solana token" }), _jsx("li", { children: "Tokens will appear in your wallet within seconds" })] })] })] }));
}
//# sourceMappingURL=ReceivePage.js.map