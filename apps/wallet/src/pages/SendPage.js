import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
export default function SendPage() {
    const { connected, publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [token, setToken] = useState('SOL');
    const [sending, setSending] = useState(false);
    const [txSignature, setTxSignature] = useState(null);
    const [error, setError] = useState(null);
    const handleSend = async () => {
        if (!connected || !publicKey) {
            setError('Please connect your wallet first');
            return;
        }
        if (!recipient || !amount) {
            setError('Please fill in all fields');
            return;
        }
        // Validate recipient address
        let recipientPubkey;
        try {
            recipientPubkey = new PublicKey(recipient);
        }
        catch {
            setError('Invalid recipient address');
            return;
        }
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            setError('Invalid amount');
            return;
        }
        setSending(true);
        setError(null);
        setTxSignature(null);
        try {
            if (token === 'SOL') {
                // Send SOL
                const transaction = new Transaction().add(SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: recipientPubkey,
                    lamports: amountNum * LAMPORTS_PER_SOL,
                }));
                const signature = await sendTransaction(transaction, connection);
                await connection.confirmTransaction(signature, 'confirmed');
                setTxSignature(signature);
                setRecipient('');
                setAmount('');
            }
            else {
                // TODO: Implement SPL token transfers
                setError('SPL token transfers coming soon');
            }
        }
        catch (err) {
            console.error('Send error:', err);
            setError(err instanceof Error ? err.message : 'Transaction failed');
        }
        finally {
            setSending(false);
        }
    };
    if (!connected) {
        return (_jsx("div", { className: "flex flex-col items-center justify-center min-h-[60vh] text-center", children: _jsx("p", { className: "text-gray-400", children: "Connect your wallet to send tokens" }) }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Send" }), _jsxs("div", { className: "card space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-gray-400 mb-2", children: "Token" }), _jsxs("select", { value: token, onChange: (e) => setToken(e.target.value), className: "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary-500", children: [_jsx("option", { value: "SOL", children: "SOL - Solana" }), _jsx("option", { value: "USDC", children: "USDC - USD Coin" }), _jsx("option", { value: "MVGA", children: "MVGA - Make Venezuela Great Again" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-gray-400 mb-2", children: "Recipient Address" }), _jsx("input", { type: "text", value: recipient, onChange: (e) => setRecipient(e.target.value), placeholder: "Enter Solana address...", className: "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-gray-400 mb-2", children: "Amount" }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: "number", value: amount, onChange: (e) => setAmount(e.target.value), placeholder: "0.00", step: "any", className: "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-16 focus:outline-none focus:border-primary-500" }), _jsx("span", { className: "absolute right-4 top-1/2 -translate-y-1/2 text-gray-400", children: token })] })] }), error && (_jsx("div", { className: "bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm", children: error })), txSignature && (_jsxs("div", { className: "bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm", children: [_jsx("p", { children: "Transaction sent successfully!" }), _jsx("a", { href: `https://solscan.io/tx/${txSignature}`, target: "_blank", rel: "noopener noreferrer", className: "underline", children: "View on Solscan" })] })), _jsx("button", { onClick: handleSend, disabled: sending || !recipient || !amount, className: "w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed", children: sending ? 'Sending...' : 'Send' })] })] }));
}
//# sourceMappingURL=SendPage.js.map