import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
const TIERS = [
    {
        name: 'Bronze',
        minStake: 0,
        benefits: ['Basic wallet access', 'Community access'],
        color: 'from-amber-700 to-amber-900',
    },
    {
        name: 'Silver',
        minStake: 10000,
        benefits: ['0.5% cashback on swaps', 'Priority support'],
        color: 'from-gray-400 to-gray-600',
    },
    {
        name: 'Gold',
        minStake: 50000,
        benefits: ['1% cashback on swaps', 'Governance voting', 'Early feature access'],
        color: 'from-yellow-400 to-yellow-600',
    },
    {
        name: 'Platinum',
        minStake: 200000,
        benefits: ['2% cashback', 'Zero fees', 'VIP support', 'Exclusive events'],
        color: 'from-purple-400 to-purple-600',
    },
];
const LOCK_PERIODS = [
    { days: 0, label: 'Flexible', multiplier: 1.0 },
    { days: 30, label: '30 Days', multiplier: 1.25 },
    { days: 90, label: '90 Days', multiplier: 1.5 },
    { days: 180, label: '180 Days', multiplier: 2.0 },
];
export default function StakePage() {
    const { connected } = useWallet();
    const [amount, setAmount] = useState('');
    const [lockPeriod, setLockPeriod] = useState(30);
    const [activeTab, setActiveTab] = useState('stake');
    // Mock data - replace with real data from backend
    const stakedAmount = 0;
    const earnedRewards = 0;
    const currentTier = 'Bronze';
    const currentAPY = 12;
    if (!connected) {
        return (_jsx("div", { className: "flex flex-col items-center justify-center min-h-[60vh] text-center", children: _jsx("p", { className: "text-gray-400", children: "Connect your wallet to stake MVGA" }) }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Stake MVGA" }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "card text-center", children: [_jsx("p", { className: "text-gray-400 text-sm", children: "Staked" }), _jsxs("p", { className: "text-xl font-bold", children: [stakedAmount.toLocaleString(), " MVGA"] })] }), _jsxs("div", { className: "card text-center", children: [_jsx("p", { className: "text-gray-400 text-sm", children: "Rewards" }), _jsxs("p", { className: "text-xl font-bold text-green-400", children: ["+", earnedRewards.toLocaleString(), " MVGA"] })] })] }), _jsxs("div", { className: "card", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("span", { className: "text-gray-400", children: "Current Tier" }), _jsx("span", { className: `px-3 py-1 rounded-full bg-gradient-to-r ${TIERS.find((t) => t.name === currentTier)?.color} text-white text-sm font-medium`, children: currentTier })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-gray-400", children: "Current APY" }), _jsxs("span", { className: "text-green-400 font-bold", children: [currentAPY, "%"] })] })] }), _jsxs("div", { className: "flex bg-white/5 rounded-xl p-1", children: [_jsx("button", { onClick: () => setActiveTab('stake'), className: `flex-1 py-2 rounded-lg font-medium transition ${activeTab === 'stake' ? 'bg-primary-500 text-black' : 'text-gray-400'}`, children: "Stake" }), _jsx("button", { onClick: () => setActiveTab('unstake'), className: `flex-1 py-2 rounded-lg font-medium transition ${activeTab === 'unstake' ? 'bg-primary-500 text-black' : 'text-gray-400'}`, children: "Unstake" })] }), _jsxs("div", { className: "card space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-gray-400 mb-2", children: "Amount" }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: "number", value: amount, onChange: (e) => setAmount(e.target.value), placeholder: "0", className: "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-20 focus:outline-none focus:border-primary-500" }), _jsx("button", { className: "absolute right-3 top-1/2 -translate-y-1/2 text-primary-500 text-sm font-medium", children: "MAX" })] }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Available: 0 MVGA" })] }), activeTab === 'stake' && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-gray-400 mb-2", children: "Lock Period" }), _jsx("div", { className: "grid grid-cols-2 gap-2", children: LOCK_PERIODS.map((period) => (_jsxs("button", { onClick: () => setLockPeriod(period.days), className: `p-3 rounded-xl border transition ${lockPeriod === period.days
                                        ? 'border-primary-500 bg-primary-500/10'
                                        : 'border-white/10 hover:border-white/30'}`, children: [_jsx("p", { className: "font-medium", children: period.label }), _jsxs("p", { className: "text-xs text-gray-400", children: [period.multiplier, "x rewards"] })] }, period.days))) })] })), _jsx("button", { disabled: !amount || parseFloat(amount) <= 0, className: "w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed", children: activeTab === 'stake' ? 'Stake MVGA' : 'Unstake MVGA' }), _jsx("p", { className: "text-xs text-gray-500 text-center", children: "Staking program coming soon. Earn rewards by holding MVGA." })] }), _jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold mb-3", children: "Staking Tiers" }), _jsx("div", { className: "space-y-3", children: TIERS.map((tier) => (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: `px-3 py-1 rounded-full bg-gradient-to-r ${tier.color} text-white text-sm font-medium`, children: tier.name }), _jsx("span", { className: "text-gray-400 text-sm", children: tier.minStake > 0 ? `${tier.minStake.toLocaleString()}+ MVGA` : 'Any amount' })] }), _jsx("ul", { className: "text-sm text-gray-400 space-y-1", children: tier.benefits.map((benefit) => (_jsxs("li", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-green-400", children: "\u2713" }), benefit] }, benefit))) })] }, tier.name))) })] })] }));
}
//# sourceMappingURL=StakePage.js.map