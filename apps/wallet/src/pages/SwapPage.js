import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { VersionedTransaction } from '@solana/web3.js';
const TOKENS = [
    {
        symbol: 'SOL',
        name: 'Solana',
        mint: 'So11111111111111111111111111111111111111112',
        decimals: 9,
        logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    },
    {
        symbol: 'USDC',
        name: 'USD Coin',
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 6,
        logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    },
    {
        symbol: 'USDT',
        name: 'Tether USD',
        mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        decimals: 6,
        logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
    },
];
export default function SwapPage() {
    const { connected, publicKey, signTransaction } = useWallet();
    const { connection } = useConnection();
    const [fromToken, setFromToken] = useState(TOKENS[0]);
    const [toToken, setToToken] = useState(TOKENS[1]);
    const [fromAmount, setFromAmount] = useState('');
    const [quote, setQuote] = useState(null);
    const [loading, setLoading] = useState(false);
    const [swapping, setSwapping] = useState(false);
    const [error, setError] = useState(null);
    const [txSignature, setTxSignature] = useState(null);
    // Fetch quote when amount changes
    const fetchQuote = useCallback(async () => {
        if (!fromAmount || parseFloat(fromAmount) <= 0 || fromToken.mint === toToken.mint) {
            setQuote(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const amount = Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals));
            const response = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${fromToken.mint}&outputMint=${toToken.mint}&amount=${amount}&slippageBps=50`);
            if (!response.ok) {
                throw new Error('Failed to get quote');
            }
            const data = await response.json();
            setQuote(data);
        }
        catch (err) {
            setError('Failed to get quote. Try again.');
            setQuote(null);
        }
        finally {
            setLoading(false);
        }
    }, [fromAmount, fromToken, toToken]);
    // Debounce quote fetching
    useEffect(() => {
        const timer = setTimeout(fetchQuote, 500);
        return () => clearTimeout(timer);
    }, [fetchQuote]);
    const handleSwapTokens = () => {
        const temp = fromToken;
        setFromToken(toToken);
        setToToken(temp);
        setFromAmount('');
        setQuote(null);
    };
    const handleSwap = async () => {
        if (!connected || !publicKey || !signTransaction || !quote)
            return;
        setSwapping(true);
        setError(null);
        setTxSignature(null);
        try {
            // Get swap transaction
            const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quoteResponse: quote,
                    userPublicKey: publicKey.toString(),
                    wrapAndUnwrapSol: true,
                    dynamicComputeUnitLimit: true,
                    prioritizationFeeLamports: 'auto',
                }),
            });
            if (!swapResponse.ok) {
                throw new Error('Failed to create swap transaction');
            }
            const { swapTransaction } = await swapResponse.json();
            // Deserialize and sign
            const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
            const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
            const signedTransaction = await signTransaction(transaction);
            // Send transaction
            const rawTransaction = signedTransaction.serialize();
            const signature = await connection.sendRawTransaction(rawTransaction, {
                skipPreflight: true,
                maxRetries: 2,
            });
            // Confirm
            await connection.confirmTransaction(signature, 'confirmed');
            setTxSignature(signature);
            setFromAmount('');
            setQuote(null);
        }
        catch (err) {
            console.error('Swap error:', err);
            setError(err instanceof Error ? err.message : 'Swap failed');
        }
        finally {
            setSwapping(false);
        }
    };
    const formatOutput = () => {
        if (!quote)
            return '0.00';
        return (parseInt(quote.outAmount) / Math.pow(10, toToken.decimals)).toFixed(6);
    };
    if (!connected) {
        return (_jsx("div", { className: "flex flex-col items-center justify-center min-h-[60vh] text-center", children: _jsx("p", { className: "text-gray-400", children: "Connect your wallet to swap tokens" }) }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Swap" }), _jsxs("div", { className: "card space-y-4", children: [_jsxs("div", { className: "bg-white/5 rounded-xl p-4", children: [_jsx("div", { className: "flex justify-between mb-2", children: _jsx("label", { className: "text-sm text-gray-400", children: "From" }) }), _jsxs("div", { className: "flex gap-3", children: [_jsx("input", { type: "number", value: fromAmount, onChange: (e) => setFromAmount(e.target.value), placeholder: "0.00", className: "flex-1 bg-transparent text-2xl font-semibold focus:outline-none" }), _jsx("select", { value: fromToken.symbol, onChange: (e) => {
                                            const token = TOKENS.find((t) => t.symbol === e.target.value);
                                            if (token)
                                                setFromToken(token);
                                        }, className: "bg-white/10 rounded-lg px-3 py-2 font-medium focus:outline-none", children: TOKENS.map((t) => (_jsx("option", { value: t.symbol, className: "bg-gray-900", children: t.symbol }, t.symbol))) })] })] }), _jsx("div", { className: "flex justify-center -my-2 relative z-10", children: _jsx("button", { onClick: handleSwapTokens, className: "w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-black hover:bg-primary-600 transition", children: _jsx("svg", { className: "w-5 h-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" }) }) }) }), _jsxs("div", { className: "bg-white/5 rounded-xl p-4", children: [_jsx("div", { className: "flex justify-between mb-2", children: _jsx("label", { className: "text-sm text-gray-400", children: "To" }) }), _jsxs("div", { className: "flex gap-3", children: [_jsx("div", { className: "flex-1 text-2xl font-semibold", children: loading ? (_jsx("span", { className: "text-gray-500 animate-pulse", children: "Loading..." })) : (formatOutput()) }), _jsx("select", { value: toToken.symbol, onChange: (e) => {
                                            const token = TOKENS.find((t) => t.symbol === e.target.value);
                                            if (token)
                                                setToToken(token);
                                        }, className: "bg-white/10 rounded-lg px-3 py-2 font-medium focus:outline-none", children: TOKENS.map((t) => (_jsx("option", { value: t.symbol, className: "bg-gray-900", children: t.symbol }, t.symbol))) })] })] }), quote && (_jsxs("div", { className: "bg-white/5 rounded-xl p-3 space-y-2 text-sm", children: [_jsxs("div", { className: "flex justify-between text-gray-400", children: [_jsx("span", { children: "Price Impact" }), _jsxs("span", { className: parseFloat(quote.priceImpactPct) > 1 ? 'text-red-400' : 'text-green-400', children: [parseFloat(quote.priceImpactPct).toFixed(2), "%"] })] }), _jsxs("div", { className: "flex justify-between text-gray-400", children: [_jsx("span", { children: "Route" }), _jsx("span", { children: quote.routePlan.map((r) => r.swapInfo.label).join(' → ') })] })] })), error && (_jsx("div", { className: "bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm", children: error })), txSignature && (_jsxs("div", { className: "bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm", children: [_jsx("p", { children: "Swap successful!" }), _jsx("a", { href: `https://solscan.io/tx/${txSignature}`, target: "_blank", rel: "noopener noreferrer", className: "underline", children: "View on Solscan" })] })), _jsx("button", { onClick: handleSwap, disabled: !quote || swapping || fromToken.mint === toToken.mint, className: "w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed", children: swapping
                            ? 'Swapping...'
                            : fromToken.mint === toToken.mint
                                ? 'Select different tokens'
                                : quote
                                    ? 'Swap'
                                    : 'Enter amount' }), _jsx("p", { className: "text-xs text-gray-500 text-center", children: "Powered by Jupiter Aggregator - Best rates across Solana" })] })] }));
}
//# sourceMappingURL=SwapPage.js.map