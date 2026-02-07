import { useState, useEffect, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
} from '@solana/spl-token';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useWalletStore } from '../stores/walletStore';
import FiatValue from '../components/FiatValue';
import TransactionPreviewModal from '../components/TransactionPreviewModal';
import { showToast } from '../hooks/useToast';
import { API_URL } from '../config';

const MVGA_MINT = 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh';
const MVGA_DECIMALS = 9;

const TIER_COLORS: Record<string, string> = {
  Bronze: 'from-amber-700 to-amber-900',
  Silver: 'from-gray-400 to-gray-600',
  Gold: 'from-yellow-400 to-yellow-600',
  Diamond: 'from-cyan-400 to-cyan-600',
};

interface StakePosition {
  id: string;
  amount: number;
  lockPeriod: number;
  lockedUntil: string | null;
  createdAt: string;
  apy: number;
  rewards: number;
  status: string;
  autoCompound: boolean;
}

export default function StakePage() {
  const { t } = useTranslation();
  const invalidateBalances = useWalletStore((s) => s.invalidateBalances);

  const TIERS = [
    {
      name: t('stake.tierBronze'),
      key: 'Bronze',
      minStake: 0,
      benefits: [t('stake.benefitBasicWallet'), t('stake.benefitCommunity')],
      color: TIER_COLORS.Bronze,
    },
    {
      name: t('stake.tierSilver'),
      key: 'Silver',
      minStake: 10000,
      benefits: [t('stake.benefitCashback05'), t('stake.benefitPrioritySupport')],
      color: TIER_COLORS.Silver,
    },
    {
      name: t('stake.tierGold'),
      key: 'Gold',
      minStake: 50000,
      benefits: [
        t('stake.benefitCashback1'),
        t('stake.benefitGovernance'),
        t('stake.benefitEarlyAccess'),
      ],
      color: TIER_COLORS.Gold,
    },
    {
      name: t('stake.tierDiamond'),
      key: 'Diamond',
      minStake: 200000,
      benefits: [
        t('stake.benefitCashback2'),
        t('stake.benefitZeroFees'),
        t('stake.benefitVipSupport'),
        t('stake.benefitExclusiveEvents'),
      ],
      color: TIER_COLORS.Diamond,
    },
  ];

  const LOCK_PERIODS = [
    { days: 0, label: t('stake.lockFlexible'), multiplier: 1.0 },
    { days: 30, label: t('stake.lock30'), multiplier: 1.25 },
    { days: 90, label: t('stake.lock90'), multiplier: 1.5 },
    { days: 180, label: t('stake.lock180'), multiplier: 2.0 },
  ];

  const TIER_NAME_MAP: Record<string, string> = {
    Bronze: t('stake.tierBronze'),
    Silver: t('stake.tierSilver'),
    Gold: t('stake.tierGold'),
    Diamond: t('stake.tierDiamond'),
  };

  const { connected, publicKey, sendTransaction } = useSelfCustodyWallet();
  const { connection } = useConnection();
  const { authToken } = useAuth();
  const [amount, setAmount] = useState('');
  const [lockPeriod, setLockPeriod] = useState(30);
  const [activeTab, setActiveTab] = useState<'stake' | 'unstake'>('stake');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [mvgaBalance, setMvgaBalance] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  const [stakingInfo, setStakingInfo] = useState({
    totalStaked: 0,
    totalStakers: 0,
    rewardPool: 0,
    baseApy: 12,
    dynamicApy: 12,
    apyMultiplier: 1.0,
    stakingRate: 0,
    weeklyFeePool: 0,
  });
  const [position, setPosition] = useState<{
    stakes: StakePosition[];
    totalStaked: number;
    earnedRewards: number;
    feeRewards: number;
    currentTier: string;
    apy: number;
    effectiveApy: number;
  }>({
    stakes: [],
    totalStaked: 0,
    earnedRewards: 0,
    feeRewards: 0,
    currentTier: 'Bronze',
    apy: 12,
    effectiveApy: 12,
  });

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const [infoRes, posRes] = await Promise.all([
          fetch(`${API_URL}/staking/info`, { signal }),
          publicKey ? fetch(`${API_URL}/staking/${publicKey.toBase58()}`, { signal }) : null,
        ]);
        if (infoRes.ok) setStakingInfo(await infoRes.json());
        if (posRes?.ok) setPosition(await posRes.json());
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError')
          showToast('error', t('common.somethingWrong'));
      }
    },
    [publicKey]
  );

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
    const controller = new AbortController();
    fetchData(controller.signal);
    const interval = setInterval(() => fetchData(controller.signal), 30000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
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
        body: JSON.stringify({
          address: publicKey.toBase58(),
          amount: parseFloat(amount),
          lockPeriod,
        }),
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

      setStatus(t('stake.waitingSignature'));
      const signature = await sendTransaction(tx, connection);
      setStatus(t('stake.confirming'));
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      if (confirmation.value.err) {
        throw new Error('Transaction failed on-chain');
      }

      setStatus(t('stake.recording'));
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

      setStatus(t('stake.stakedSuccess'));
      setAmount('');
      fetchData();
      invalidateBalances();
    } catch (err: unknown) {
      setStatus(
        t('stake.errorPrefix', { message: err instanceof Error ? err.message : String(err) })
      );
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
      setStatus(t('stake.unstakedSuccess', { sig: `${data.signature.slice(0, 16)}...` }));
      setAmount('');
      fetchData();
      invalidateBalances();
    } catch (err: unknown) {
      setStatus(
        t('stake.errorPrefix', { message: err instanceof Error ? err.message : String(err) })
      );
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
      setStatus(
        t('stake.claimedSuccess', {
          rewards: data.rewards.toFixed(2),
          sig: `${data.signature.slice(0, 16)}...`,
        })
      );
      fetchData();
      invalidateBalances();
    } catch (err: unknown) {
      setStatus(
        t('stake.errorPrefix', { message: err instanceof Error ? err.message : String(err) })
      );
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoCompound = async (stakeId: string, enabled: boolean) => {
    if (!authToken) return;
    try {
      const res = await fetch(`${API_URL}/staking/auto-compound`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ stakeId, enabled }),
      });
      if (res.ok) fetchData();
    } catch {
      showToast('error', t('common.somethingWrong'));
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('stake.connectPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('stake.title')}</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center">
          <p className="text-gray-400 text-sm">{t('stake.staked')}</p>
          <p className="text-xl font-bold">
            {position.totalStaked.toLocaleString(undefined, { maximumFractionDigits: 0 })} MVGA
          </p>
          {position.totalStaked > 0 && (
            <FiatValue
              amount={position.totalStaked}
              token="MVGA"
              className="text-sm text-gray-500"
            />
          )}
        </div>
        <div className="card text-center">
          <p className="text-gray-400 text-sm">{t('stake.baseRewards')}</p>
          <p className="text-xl font-bold text-green-400">
            +{position.earnedRewards.toFixed(2)} MVGA
          </p>
          {position.feeRewards > 0 && (
            <p className="text-xs text-blue-400 mt-1">
              +{position.feeRewards.toFixed(2)} {t('stake.feeRewards')}
            </p>
          )}
          {(position.earnedRewards > 0 || position.feeRewards > 0) && (
            <button
              onClick={handleClaim}
              disabled={loading}
              className="mt-1 text-xs bg-green-500/20 text-green-400 px-2 py-1"
            >
              {t('stake.claim')}
            </button>
          )}
        </div>
      </div>

      {/* Pool Stats */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400">{t('stake.currentTier')}</span>
          <span
            className={`px-3 py-1 rounded-full bg-gradient-to-r ${TIER_COLORS[position.currentTier] || TIER_COLORS.Bronze} text-white text-sm font-medium`}
          >
            {TIER_NAME_MAP[position.currentTier] || position.currentTier}
          </span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400">{t('stake.effectiveApy')}</span>
          <div className="flex items-center gap-1">
            <span className="text-green-400 font-bold">{position.effectiveApy.toFixed(1)}%</span>
            {stakingInfo.dynamicApy > 12 && <span className="text-green-400 text-xs">▲</span>}
            {stakingInfo.dynamicApy < 12 && <span className="text-red-400 text-xs">▼</span>}
          </div>
        </div>
        {stakingInfo.weeklyFeePool > 0 && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">{t('stake.weeklyFeePool')}</span>
            <span className="font-medium text-blue-400">
              {stakingInfo.weeklyFeePool.toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
              MVGA
            </span>
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400">{t('stake.stakingRate')}</span>
          <span className="font-medium">{(stakingInfo.stakingRate * 100).toFixed(1)}%</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400">{t('stake.totalStakedPool')}</span>
          <span className="font-medium">
            {stakingInfo.totalStaked.toLocaleString(undefined, { maximumFractionDigits: 0 })} MVGA
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400">{t('stake.totalStakers')}</span>
          <span className="font-medium">{stakingInfo.totalStakers}</span>
        </div>
      </div>

      {/* Stake/Unstake Tabs */}
      <div className="flex bg-white/5 p-1">
        <button
          onClick={() => setActiveTab('stake')}
          className={`flex-1 py-2 font-medium transition ${
            activeTab === 'stake' ? 'bg-gold-500 text-black' : 'text-gray-400'
          }`}
        >
          {t('stake.stakeTab')}
        </button>
        <button
          onClick={() => setActiveTab('unstake')}
          className={`flex-1 py-2 font-medium transition ${
            activeTab === 'unstake' ? 'bg-gold-500 text-black' : 'text-gray-400'
          }`}
        >
          {t('stake.unstakeTab')}
        </button>
      </div>

      {/* Stake Form */}
      <div className="card space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">{t('stake.amount')}</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-white/5 border border-white/10 px-4 py-3 pr-20 focus:outline-none focus:border-gold-500"
            />
            <button
              onClick={() =>
                setAmount(
                  activeTab === 'stake' ? mvgaBalance.toString() : position.totalStaked.toString()
                )
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gold-500 text-sm font-medium"
            >
              {t('stake.max')}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {t('stake.available')}:{' '}
            {activeTab === 'stake'
              ? `${mvgaBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} MVGA`
              : `${position.totalStaked.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${t('stake.mvgaStaked')}`}
          </p>
        </div>

        {activeTab === 'stake' && (
          <div>
            <label className="block text-sm text-gray-400 mb-2">{t('stake.lockPeriod')}</label>
            <div className="grid grid-cols-2 gap-2">
              {LOCK_PERIODS.map((period) => (
                <button
                  key={period.days}
                  onClick={() => setLockPeriod(period.days)}
                  className={`p-3 border transition ${
                    lockPeriod === period.days
                      ? 'border-gold-500 bg-gold-500/10'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <p className="font-medium">{period.label}</p>
                  <p className="text-xs text-gray-400">
                    {t('stake.xRewards', { multiplier: period.multiplier })}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'stake' && amount && parseFloat(amount) > 0 && parseFloat(amount) < 1 && (
          <p className="text-xs text-yellow-400">{t('stake.minimumAmount')}</p>
        )}

        <button
          onClick={() => {
            if (!amount || parseFloat(amount) <= 0) return;
            if (activeTab === 'stake' && parseFloat(amount) < 1) return;
            setShowPreview(true);
          }}
          disabled={
            !amount ||
            parseFloat(amount) <= 0 ||
            (activeTab === 'stake' && parseFloat(amount) < 1) ||
            loading ||
            !authToken
          }
          className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? t('common.processing')
            : activeTab === 'stake'
              ? t('stake.stakeButton')
              : t('stake.unstakeButton')}
        </button>

        {status && (
          <p
            className={`text-sm text-center ${status.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}
          >
            {status}
          </p>
        )}
      </div>

      {/* Active Stakes */}
      {position.stakes.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">{t('stake.activeStakes')}</h2>
          <div className="space-y-3">
            {position.stakes.map((stake) => (
              <div key={stake.id} className="card">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium">{stake.amount.toLocaleString()} MVGA</span>
                    <FiatValue
                      amount={stake.amount}
                      token="MVGA"
                      className="text-xs text-gray-500 ml-2"
                    />
                  </div>
                  <span className="text-green-400 text-sm">{stake.apy}% APY</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-400">
                  <span>
                    {stake.lockPeriod > 0
                      ? t('stake.dLock', { days: stake.lockPeriod })
                      : t('stake.flexible')}
                  </span>
                  <span>
                    +{stake.rewards.toFixed(4)} {t('stake.rewards')}
                  </span>
                </div>
                {stake.lockedUntil && (
                  <p className="text-xs text-gray-500 mt-1">
                    {t('stake.unlocks')}: {new Date(stake.lockedUntil).toLocaleDateString()}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                  <span className="text-xs text-gray-400">{t('stake.autoCompound')}</span>
                  <button
                    onClick={() => handleToggleAutoCompound(stake.id, !stake.autoCompound)}
                    className={`relative w-10 h-5 rounded-full transition ${
                      stake.autoCompound ? 'bg-green-500' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        stake.autoCompound ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tiers */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{t('stake.stakingTiers')}</h2>
        <div className="space-y-3">
          {TIERS.map((tier) => (
            <div key={tier.name} className="card">
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`px-3 py-1 rounded-full bg-gradient-to-r ${tier.color} text-white text-sm font-medium`}
                >
                  {tier.name}
                </span>
                <span className="text-gray-400 text-sm">
                  {tier.minStake > 0
                    ? `${tier.minStake.toLocaleString()}+ MVGA`
                    : t('stake.anyAmount')}
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

      <TransactionPreviewModal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={() => {
          setShowPreview(false);
          if (activeTab === 'stake') handleStake();
          else handleUnstake();
        }}
        loading={loading}
        tx={{
          type: activeTab === 'stake' ? 'stake' : 'unstake',
          amount: parseFloat(amount) || 0,
          token: 'MVGA',
        }}
      />
    </div>
  );
}
