import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
} from '@solana/spl-token';
import { useAuth } from '../hooks/useAuth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const MVGA_MINT = 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh';
const MVGA_DECIMALS = 9;

const TIERS = [
  { name: 'Bronze', minStake: 0, benefits: ['Basic wallet access', 'Community access'], color: 'from-amber-700 to-amber-900' },
  { name: 'Silver', minStake: 10000, benefits: ['0.5% cashback on swaps', 'Priority support'], color: 'from-gray-400 to-gray-600' },
  { name: 'Gold', minStake: 50000, benefits: ['1% cashback on swaps', 'Governance voting', 'Early feature access'], color: 'from-yellow-400 to-yellow-600' },
  { name: 'Platinum', minStake: 200000, benefits: ['2% cashback', 'Zero fees', 'VIP support', 'Exclusive events'], color: 'from-purple-400 to-purple-600' },
];

const LOCK_PERIODS = [
  { days: 0, label: 'Flexible', multiplier: 1.0 },
  { days: 30, label: '30 Days', multiplier: 1.25 },
  { days: 90, label: '90 Days', multiplier: 1.5 },
  { days: 180, label: '180 Days', multiplier: 2.0 },
];

interface StakePosition {
  id: string;
  amount: number;
  lockPeriod: number;
  lockedUntil: string | null;
  createdAt: string;
  apy: number;
  rewards: number;
  status: string;
}

export default function StakePage() {
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { authToken } = useAuth();
  const [amount, setAmount] = useState('');
  const [lockPeriod, setLockPeriod] = useState(30);
  const [activeTab, setActiveTab] = useState<'stake' | 'unstake'>('stake');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [mvgaBalance, setMvgaBalance] = useState(0);

  const [stakingInfo, setStakingInfo] = useState({ totalStaked: 0, totalStakers: 0, rewardPool: 0, baseApy: 12 });
  const [position, setPosition] = useState<{
    stakes: StakePosition[];
    totalStaked: number;
    earnedRewards: number;
    currentTier: string;
    apy: number;
  }>({ stakes: [], totalStaked: 0, earnedRewards: 0, currentTier: 'Bronze', apy: 12 });

  const fetchData = useCallback(async () => {
    try {
      const [infoRes, posRes] = await Promise.all([
        fetch(`${API_URL}/staking/info`),
        publicKey ? fetch(`${API_URL}/staking/${publicKey.toBase58()}`) : null,
      ]);
      if (infoRes.ok) setStakingInfo(await infoRes.json());
      if (posRes?.ok) setPosition(await posRes.json());
    } catch (err) {
      console.error('Failed to fetch staking data:', err);
    }
  }, [publicKey]);

  useEffect(() => {
    async function fetchBalance() {
      if (!publicKey) return;
      try {
        const mint = new PublicKey(MVGA_MINT);
        const ata = await getAssociatedTokenAddress(mint, publicKey);
        const account = await getAccount(connection, ata);
        setMvgaBalance(Number(account.amount) / 10 ** MVGA_DECIMALS);
      } catch {
        setMvgaBalance(0);
      }
    }
    fetchBalance();
  }, [publicKey, connection]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleStake = async () => {
    if (!publicKey || !amount || !authToken) return;
    setLoading(true);
    setStatus('');

    try {
      const stakeRes = await fetch(`${API_URL}/staking/stake`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ address: publicKey.toBase58(), amount: parseFloat(amount), lockPeriod }),
      });

      if (!stakeRes.ok) {
        const err = await stakeRes.json();
        throw new Error(err.message || 'Failed to create stake');
      }

      const { vaultAddress } = await stakeRes.json();
      const mint = new PublicKey(MVGA_MINT);
      const vaultPubkey = new PublicKey(vaultAddress);

      const userAta = await getAssociatedTokenAddress(mint, publicKey);
      const vaultAta = await getAssociatedTokenAddress(mint, vaultPubkey);

      const tx = new Transaction();

      try {
        await getAccount(connection, vaultAta);
      } catch {
        tx.add(createAssociatedTokenAccountInstruction(publicKey, vaultAta, vaultPubkey, mint));
      }

      const rawAmount = BigInt(Math.round(parseFloat(amount) * 10 ** MVGA_DECIMALS));
      tx.add(createTransferInstruction(userAta, vaultAta, publicKey, rawAmount));

      setStatus('Waiting for wallet signature...');
      const signature = await sendTransaction(tx, connection);
      setStatus('Confirming transaction...');
      await connection.confirmTransaction(signature, 'confirmed');

      setStatus('Recording stake...');
      const confirmRes = await fetch(`${API_URL}/staking/confirm-stake`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ signature, amount: parseFloat(amount), lockPeriod }),
      });

      if (!confirmRes.ok) {
        const err = await confirmRes.json();
        throw new Error(err.message || 'Failed to confirm stake');
      }

      setStatus('Staked successfully!');
      setAmount('');
      fetchData();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUnstake = async () => {
    if (!publicKey || !amount || !authToken) return;
    setLoading(true);
    setStatus('');

    try {
      const res = await fetch(`${API_URL}/staking/unstake`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ address: publicKey.toBase58(), amount: parseFloat(amount) }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to unstake');
      }

      const data = await res.json();
      setStatus(`Unstaked! TX: ${data.signature.slice(0, 16)}...`);
      setAmount('');
      fetchData();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!publicKey || !authToken) return;
    setLoading(true);
    setStatus('');

    try {
      const res = await fetch(`${API_URL}/staking/${publicKey.toBase58()}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to claim');
      }

      const data = await res.json();
      setStatus(`Claimed ${data.rewards.toFixed(2)} MVGA! TX: ${data.signature.slice(0, 16)}...`);
      fetchData();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

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
          <p className="text-xl font-bold">{position.totalStaked.toLocaleString(undefined, { maximumFractionDigits: 0 })} MVGA</p>
        </div>
        <div className="card text-center">
          <p className="text-gray-400 text-sm">Rewards</p>
          <p className="text-xl font-bold text-green-400">+{position.earnedRewards.toFixed(2)} MVGA</p>
          {position.earnedRewards > 0 && (
            <button
              onClick={handleClaim}
              disabled={loading}
              className="mt-1 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-lg"
            >
              Claim
            </button>
          )}
        </div>
      </div>

      {/* Pool Stats */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400">Current Tier</span>
          <span className={`px-3 py-1 rounded-full bg-gradient-to-r ${TIERS.find((t) => t.name === position.currentTier)?.color} text-white text-sm font-medium`}>
            {position.currentTier}
          </span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400">Your APY</span>
          <span className="text-green-400 font-bold">{position.apy}%</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400">Total Staked (Pool)</span>
          <span className="font-medium">{stakingInfo.totalStaked.toLocaleString(undefined, { maximumFractionDigits: 0 })} MVGA</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Total Stakers</span>
          <span className="font-medium">{stakingInfo.totalStakers}</span>
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
            <button
              onClick={() => setAmount(activeTab === 'stake' ? mvgaBalance.toString() : position.totalStaked.toString())}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-500 text-sm font-medium"
            >
              MAX
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Available: {activeTab === 'stake'
              ? `${mvgaBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} MVGA`
              : `${position.totalStaked.toLocaleString(undefined, { maximumFractionDigits: 2 })} MVGA staked`}
          </p>
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
          onClick={activeTab === 'stake' ? handleStake : handleUnstake}
          disabled={!amount || parseFloat(amount) <= 0 || loading || !authToken}
          className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : activeTab === 'stake' ? 'Stake MVGA' : 'Unstake MVGA'}
        </button>

        {status && (
          <p className={`text-sm text-center ${status.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
            {status}
          </p>
        )}
      </div>

      {/* Active Stakes */}
      {position.stakes.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Active Stakes</h2>
          <div className="space-y-3">
            {position.stakes.map((stake) => (
              <div key={stake.id} className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{stake.amount.toLocaleString()} MVGA</span>
                  <span className="text-green-400 text-sm">{stake.apy}% APY</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-400">
                  <span>{stake.lockPeriod > 0 ? `${stake.lockPeriod}d lock` : 'Flexible'}</span>
                  <span>+{stake.rewards.toFixed(4)} rewards</span>
                </div>
                {stake.lockedUntil && (
                  <p className="text-xs text-gray-500 mt-1">
                    Unlocks: {new Date(stake.lockedUntil).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
