import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const PAYMENT_METHODS = ['ZELLE', 'VENMO', 'PAYPAL', 'BANK_TRANSFER'];
const CRYPTO_OPTIONS = ['USDC', 'MVGA'];
export default function P2PPage() {
    const { connected, publicKey } = useWallet();
    const [activeTab, setActiveTab] = useState('buy');
    const [offers, setOffers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    // Create offer form state
    const [newOffer, setNewOffer] = useState({
        type: 'SELL',
        cryptoAmount: '',
        cryptoCurrency: 'USDC',
        paymentMethod: 'ZELLE',
        rate: '1.0',
        minAmount: '10',
        maxAmount: '500',
    });
    // Trade modal state
    const [selectedOffer, setSelectedOffer] = useState(null);
    const [tradeAmount, setTradeAmount] = useState('');
    const fetchOffers = async () => {
        setLoading(true);
        try {
            const type = activeTab === 'buy' ? 'SELL' : activeTab === 'sell' ? 'BUY' : undefined;
            const url = type ? `${API_URL}/p2p/offers?type=${type}` : `${API_URL}/p2p/offers`;
            const response = await fetch(url);
            const data = await response.json();
            setOffers(data);
        }
        catch (error) {
            console.error('Failed to fetch offers:', error);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchOffers();
    }, [activeTab]);
    const handleCreateOffer = async () => {
        if (!publicKey)
            return;
        try {
            const response = await fetch(`${API_URL}/p2p/offers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sellerAddress: publicKey.toString(),
                    type: newOffer.type,
                    cryptoAmount: parseFloat(newOffer.cryptoAmount),
                    cryptoCurrency: newOffer.cryptoCurrency,
                    paymentMethod: newOffer.paymentMethod,
                    rate: parseFloat(newOffer.rate),
                    minAmount: parseFloat(newOffer.minAmount),
                    maxAmount: parseFloat(newOffer.maxAmount),
                }),
            });
            if (response.ok) {
                setShowCreateModal(false);
                fetchOffers();
                setNewOffer({
                    type: 'SELL',
                    cryptoAmount: '',
                    cryptoCurrency: 'USDC',
                    paymentMethod: 'ZELLE',
                    rate: '1.0',
                    minAmount: '10',
                    maxAmount: '500',
                });
            }
        }
        catch (error) {
            console.error('Failed to create offer:', error);
        }
    };
    const handleAcceptOffer = async () => {
        if (!publicKey || !selectedOffer || !tradeAmount)
            return;
        try {
            const response = await fetch(`${API_URL}/p2p/offers/${selectedOffer.id}/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    buyerAddress: publicKey.toString(),
                    amount: parseFloat(tradeAmount),
                }),
            });
            if (response.ok) {
                setSelectedOffer(null);
                setTradeAmount('');
                fetchOffers();
                alert('Trade started! Check your trades in the My Offers tab.');
            }
        }
        catch (error) {
            console.error('Failed to accept offer:', error);
        }
    };
    const getPaymentMethodLabel = (method) => {
        const labels = {
            ZELLE: 'Zelle',
            VENMO: 'Venmo',
            PAYPAL: 'PayPal',
            BANK_TRANSFER: 'Bank Transfer',
        };
        return labels[method] || method;
    };
    const shortenAddress = (address) => {
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    };
    if (!connected) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center min-h-[60vh] text-center", children: [_jsx("div", { className: "w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mb-4", children: _jsx("span", { className: "text-3xl", children: "\uD83E\uDD1D" }) }), _jsx("h2", { className: "text-xl font-bold mb-2", children: "P2P Exchange" }), _jsx("p", { className: "text-gray-400 mb-4", children: "Connect your wallet to trade crypto for Zelle, Venmo, PayPal, and more." })] }));
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h1", { className: "text-2xl font-bold", children: "P2P Exchange" }), _jsx("button", { onClick: () => setShowCreateModal(true), className: "bg-primary-500 text-black px-4 py-2 rounded-lg font-medium text-sm", children: "+ Create Offer" })] }), _jsx("div", { className: "flex bg-white/5 rounded-xl p-1", children: ['buy', 'sell', 'my'].map((tab) => (_jsx("button", { onClick: () => setActiveTab(tab), className: `flex-1 py-2 rounded-lg font-medium text-sm transition ${activeTab === tab ? 'bg-primary-500 text-black' : 'text-gray-400'}`, children: tab === 'buy' ? 'Buy Crypto' : tab === 'sell' ? 'Sell Crypto' : 'My Offers' }, tab))) }), loading ? (_jsx("div", { className: "space-y-3", children: [1, 2, 3].map((i) => (_jsx("div", { className: "card animate-pulse h-24" }, i))) })) : offers.length === 0 ? (_jsxs("div", { className: "card text-center py-8 text-gray-400", children: [_jsx("p", { children: "No offers found" }), _jsx("p", { className: "text-sm mt-1", children: "Be the first to create one!" })] })) : (_jsx("div", { className: "space-y-3", children: offers.map((offer) => (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-xs font-bold", children: offer.sellerAddress.slice(0, 2) }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-sm", children: shortenAddress(offer.sellerAddress) }), _jsx("p", { className: "text-xs text-gray-500", children: "\u2B50 5.0 (New)" })] })] }), _jsxs("span", { className: `text-xs px-2 py-1 rounded-full ${offer.type === 'SELL' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`, children: [offer.type === 'SELL' ? 'Selling' : 'Buying', " ", offer.cryptoCurrency] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4 text-sm mb-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-gray-400", children: "Available" }), _jsxs("p", { className: "font-medium", children: [offer.availableAmount.toFixed(2), " ", offer.cryptoCurrency] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-gray-400", children: "Payment" }), _jsx("p", { className: "font-medium", children: getPaymentMethodLabel(offer.paymentMethod) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-gray-400", children: "Rate" }), _jsxs("p", { className: "font-medium", children: [(offer.rate * 100).toFixed(0), "%"] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-gray-400", children: "Limit" }), _jsxs("p", { className: "font-medium", children: ["$", offer.minAmount, " - $", offer.maxAmount] })] })] }), _jsx("button", { onClick: () => setSelectedOffer(offer), className: `w-full py-2 rounded-lg font-medium text-sm transition ${offer.sellerAddress === publicKey?.toString()
                                ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                                : 'bg-primary-500 text-black hover:bg-primary-600'}`, disabled: offer.sellerAddress === publicKey?.toString(), children: offer.sellerAddress === publicKey?.toString()
                                ? 'Your Offer'
                                : offer.type === 'SELL'
                                    ? 'Buy Now'
                                    : 'Sell Now' })] }, offer.id))) })), showCreateModal && (_jsx("div", { className: "fixed inset-0 bg-black/80 flex items-end justify-center z-50", children: _jsxs("div", { className: "bg-[#1a1a1a] rounded-t-3xl w-full max-w-lg p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-xl font-bold", children: "Create Offer" }), _jsx("button", { onClick: () => setShowCreateModal(false), className: "text-gray-400 text-2xl", children: "\u00D7" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx("button", { onClick: () => setNewOffer({ ...newOffer, type: 'SELL' }), className: `py-3 rounded-xl font-medium ${newOffer.type === 'SELL' ? 'bg-green-500 text-black' : 'bg-white/10'}`, children: "Sell Crypto" }), _jsx("button", { onClick: () => setNewOffer({ ...newOffer, type: 'BUY' }), className: `py-3 rounded-xl font-medium ${newOffer.type === 'BUY' ? 'bg-blue-500 text-white' : 'bg-white/10'}`, children: "Buy Crypto" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-gray-400 mb-1", children: "Crypto" }), _jsx("select", { value: newOffer.cryptoCurrency, onChange: (e) => setNewOffer({ ...newOffer, cryptoCurrency: e.target.value }), className: "w-full bg-white/10 rounded-lg px-3 py-2", children: CRYPTO_OPTIONS.map((c) => (_jsx("option", { value: c, className: "bg-gray-900", children: c }, c))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-gray-400 mb-1", children: "Payment" }), _jsx("select", { value: newOffer.paymentMethod, onChange: (e) => setNewOffer({ ...newOffer, paymentMethod: e.target.value }), className: "w-full bg-white/10 rounded-lg px-3 py-2", children: PAYMENT_METHODS.map((m) => (_jsx("option", { value: m, className: "bg-gray-900", children: getPaymentMethodLabel(m) }, m))) })] })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm text-gray-400 mb-1", children: ["Amount (", newOffer.cryptoCurrency, ")"] }), _jsx("input", { type: "number", value: newOffer.cryptoAmount, onChange: (e) => setNewOffer({ ...newOffer, cryptoAmount: e.target.value }), placeholder: "100", className: "w-full bg-white/10 rounded-lg px-3 py-2" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-gray-400 mb-1", children: "Min ($)" }), _jsx("input", { type: "number", value: newOffer.minAmount, onChange: (e) => setNewOffer({ ...newOffer, minAmount: e.target.value }), className: "w-full bg-white/10 rounded-lg px-3 py-2" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-gray-400 mb-1", children: "Max ($)" }), _jsx("input", { type: "number", value: newOffer.maxAmount, onChange: (e) => setNewOffer({ ...newOffer, maxAmount: e.target.value }), className: "w-full bg-white/10 rounded-lg px-3 py-2" })] })] }), _jsx("button", { onClick: handleCreateOffer, disabled: !newOffer.cryptoAmount, className: "w-full btn-primary disabled:opacity-50", children: "Create Offer" })] }) })), selectedOffer && (_jsx("div", { className: "fixed inset-0 bg-black/80 flex items-end justify-center z-50", children: _jsxs("div", { className: "bg-[#1a1a1a] rounded-t-3xl w-full max-w-lg p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h2", { className: "text-xl font-bold", children: [selectedOffer.type === 'SELL' ? 'Buy' : 'Sell', " ", selectedOffer.cryptoCurrency] }), _jsx("button", { onClick: () => setSelectedOffer(null), className: "text-gray-400 text-2xl", children: "\u00D7" })] }), _jsxs("div", { className: "bg-white/5 rounded-xl p-4 space-y-2", children: [_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-gray-400", children: "Trader" }), _jsx("span", { children: shortenAddress(selectedOffer.sellerAddress) })] }), _jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-gray-400", children: "Payment" }), _jsx("span", { children: getPaymentMethodLabel(selectedOffer.paymentMethod) })] }), _jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-gray-400", children: "Available" }), _jsxs("span", { children: [selectedOffer.availableAmount, " ", selectedOffer.cryptoCurrency] })] }), _jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-gray-400", children: "Limits" }), _jsxs("span", { children: ["$", selectedOffer.minAmount, " - $", selectedOffer.maxAmount] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-gray-400 mb-1", children: "Amount (USD)" }), _jsx("input", { type: "number", value: tradeAmount, onChange: (e) => setTradeAmount(e.target.value), placeholder: `${selectedOffer.minAmount} - ${selectedOffer.maxAmount}`, className: "w-full bg-white/10 rounded-lg px-3 py-3 text-lg" }), tradeAmount && (_jsxs("p", { className: "text-sm text-gray-400 mt-2", children: ["You will ", selectedOffer.type === 'SELL' ? 'receive' : 'send', ":", ' ', _jsxs("span", { className: "text-white font-medium", children: [(parseFloat(tradeAmount) * selectedOffer.rate).toFixed(2), " ", selectedOffer.cryptoCurrency] })] }))] }), _jsxs("button", { onClick: handleAcceptOffer, disabled: !tradeAmount ||
                                parseFloat(tradeAmount) < selectedOffer.minAmount ||
                                parseFloat(tradeAmount) > selectedOffer.maxAmount, className: "w-full btn-primary disabled:opacity-50", children: [selectedOffer.type === 'SELL' ? 'Buy' : 'Sell', " ", selectedOffer.cryptoCurrency] }), _jsx("p", { className: "text-xs text-gray-500 text-center", children: "Crypto will be held in escrow until you confirm payment" })] }) }))] }));
}
//# sourceMappingURL=P2PPage.js.map