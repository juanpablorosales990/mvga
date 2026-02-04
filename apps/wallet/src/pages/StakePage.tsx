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
  const [activeTab, setActiveTab] = useState<'stake' | 'unstake'>('stake');

  // Mock data - replace with real data from backend
  const stakedAmount = 0;
  const earnedRewards = 0;
  const currentTier = 'Bronze';
  const currentAPY = 12;

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">Connect your wallet to stake MVGA</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Stake MVGA</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center">
          <p className="text-gray-400 text-sm">Staked</p>
          <p className="text-xl font-bold">{stakedAmount.toLocaleString()} MVGA</p>
        </div>
        <div className="card text-center">
          <p className="text-gray-400 text-sm">Rewards</p>
          <p className="text-xl font-bold text-green-400">+{earnedRewards.toLocaleString()} MVGA</p>
        </div>
      </div>

      {/* Current Tier */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-400">Current Tier</span>
          <span className={`px-3 py-1 rounded-full bg-gradient-to-r ${TIERS.find((t) => t.name === currentTier)?.color} text-white text-sm font-medium`}>
            {currentTier}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Current APY</span>
          <span className="text-green-400 font-bold">{currentAPY}%</span>
        </div>
      </div>

      {/* Stake/Unstake Tabs */}
      <div className="flex bg-white/5 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('stake')}
          className={`flex-1 py-2 rounded-lg font-medium transition ${
            activeTab === 'stake' ? 'bg-primary-500 text-black' : 'text-gray-400'
          }`}
        >
          Stake
        </button>
        <button
          onClick={() => setActiveTab('unstake')}
          className={`flex-1 py-2 rounded-lg font-medium transition ${
            activeTab === 'unstake' ? 'bg-primary-500 text-black' : 'text-gray-400'
          }`}
        >
          Unstake
        </button>
      </div>

      {/* Stake Form */}
      <div className="card space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Amount</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-20 focus:outline-none focus:border-primary-500"
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-500 text-sm font-medium">
              MAX
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Available: 0 MVGA</p>
        </div>

        {activeTab === 'stake' && (
          <div>
            <label className="block text-sm text-gray-400 mb-2">Lock Period</label>
            <div className="grid grid-cols-2 gap-2">
              {LOCK_PERIODS.map((period) => (
                <button
                  key={period.days}
                  onClick={() => setLockPeriod(period.days)}
                  className={`p-3 rounded-xl border transition ${
                    lockPeriod === period.days
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <p className="font-medium">{period.label}</p>
                  <p className="text-xs text-gray-400">{period.multiplier}x rewards</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          disabled={!amount || parseFloat(amount) <= 0}
          className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {activeTab === 'stake' ? 'Stake MVGA' : 'Unstake MVGA'}
        </button>

        <p className="text-xs text-gray-500 text-center">
          Staking program coming soon. Earn rewards by holding MVGA.
        </p>
      </div>

      {/* Tiers */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Staking Tiers</h2>
        <div className="space-y-3">
          {TIERS.map((tier) => (
            <div key={tier.name} className="card">
              <div className="flex items-center justify-between mb-2">
                <span className={`px-3 py-1 rounded-full bg-gradient-to-r ${tier.color} text-white text-sm font-medium`}>
                  {tier.name}
                </span>
                <span className="text-gray-400 text-sm">
                  {tier.minStake > 0 ? `${tier.minStake.toLocaleString()}+ MVGA` : 'Any amount'}
                </span>
              </div>
              <ul className="text-sm text-gray-400 space-y-1">
                {tier.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
