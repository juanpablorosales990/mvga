import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { usePrices } from '../hooks/usePrices';
import { useWalletStore } from '../stores/walletStore';
import { useSavings } from '../hooks/useSavings';
import { showToast } from '../hooks/useToast';

export default function SavingsPage() {
  const { t } = useTranslation();
  const { connected, publicKey } = useSelfCustodyWallet();
  const balances = useWalletStore((s) => s.balances);
  const preferredCurrency = useWalletStore((s) => s.preferredCurrency);
  const savingsGoal = useWalletStore((s) => s.savingsGoal);
  const setSavingsGoal = useWalletStore((s) => s.setSavingsGoal);
  const { formatUsdValue } = usePrices();
  const walletAddr = publicKey?.toBase58() ?? null;
  const { bestApy, positions, rates, deposit, withdraw } = useSavings(walletAddr);

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalLabel, setGoalLabel] = useState(savingsGoal?.label ?? '');
  const [goalAmount, setGoalAmount] = useState(savingsGoal?.targetAmount?.toString() ?? '');

  // Deposit/withdraw modal state
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositToken, setDepositToken] = useState<'USDC' | 'USDT'>('USDC');
  const [withdrawPositionId, setWithdrawPositionId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const usdcBalance = balances.find((b) => b.symbol === 'USDC');
  const usdtBalance = balances.find((b) => b.symbol === 'USDT');
  const stablecoinUsd = (usdcBalance?.usdValue ?? 0) + (usdtBalance?.usdValue ?? 0);

  const totalInSavings = positions?.totalCurrent ?? 0;
  const totalDeposited = positions?.totalDeposited ?? 0;
  const totalYield = totalInSavings - totalDeposited;
  const displayBalance = totalInSavings > 0 ? totalInSavings : stablecoinUsd;

  const currentApy = bestApy || 5.2;
  const dailyInterest = (displayBalance * (currentApy / 100)) / 365;
  const monthlyInterest = (displayBalance * (currentApy / 100)) / 12;
  const yearlyInterest = displayBalance * (currentApy / 100);

  const formatUsd = (usd: number) => formatUsdValue(usd, preferredCurrency);

  const handleSaveGoal = () => {
    const amount = parseFloat(goalAmount);
    if (!goalLabel.trim() || isNaN(amount) || amount <= 0) return;
    setSavingsGoal({ label: goalLabel.trim(), targetAmount: amount });
    setShowGoalForm(false);
  };

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) return;
    setActionLoading(true);
    try {
      await deposit(amount, depositToken);
      showToast('success', t('banking.depositSuccess'));
      setShowDeposit(false);
      setDepositAmount('');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('common.somethingWrong'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawPositionId) return;
    setActionLoading(true);
    try {
      await withdraw(withdrawPositionId);
      showToast('success', t('banking.withdrawSuccess'));
      setShowWithdraw(false);
      setWithdrawPositionId(null);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('common.somethingWrong'));
    } finally {
      setActionLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('banking.connectPrompt')}</p>
      </div>
    );
  }

  const goalProgress = savingsGoal
    ? Math.min(((totalInSavings || stablecoinUsd) / savingsGoal.targetAmount) * 100, 100)
    : 0;

  const maxDeposit =
    depositToken === 'USDC' ? (usdcBalance?.balance ?? 0) : (usdtBalance?.balance ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/banking" className="text-gray-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold">{t('banking.savingsTitle')}</h1>
      </div>

      {/* Savings Balance Card */}
      <div className="card p-5 bg-gradient-to-br from-green-500/10 to-emerald-600/5 border-green-500/20">
        <p className="text-sm text-gray-400">{t('banking.savingsBalance')}</p>
        <p className="text-3xl font-bold mt-1">{formatUsd(totalInSavings)}</p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs text-green-400 font-medium">
            {currentApy.toFixed(1)}% {t('banking.apy')}
          </span>
          {totalYield > 0 && (
            <span className="text-xs text-green-400">
              +{formatUsd(totalYield)} {t('banking.earned')}
            </span>
          )}
          {totalInSavings === 0 && stablecoinUsd > 0 && (
            <span className="text-xs text-gray-500">~{formatUsd(monthlyInterest)}/mo</span>
          )}
        </div>
        {stablecoinUsd > 0 && totalInSavings === 0 && (
          <p className="text-xs text-gray-500 mt-1">
            {formatUsd(stablecoinUsd)} {t('banking.availableToDeposit')}
          </p>
        )}
      </div>

      {/* Interest Projections */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">{t('banking.interestProjections')}</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-xs text-gray-400">{t('banking.daily')}</p>
            <p className="font-medium text-sm mt-1">{formatUsd(dailyInterest)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">{t('banking.monthly')}</p>
            <p className="font-medium text-sm mt-1">{formatUsd(monthlyInterest)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">{t('banking.yearly')}</p>
            <p className="font-medium text-sm mt-1">{formatUsd(yearlyInterest)}</p>
          </div>
        </div>
      </div>

      {/* Deposit / Withdraw Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setShowDeposit(true)}
          className="card p-3 text-center hover:bg-white/10 transition"
        >
          <span className="text-sm font-medium text-green-400">{t('banking.depositFunds')}</span>
        </button>
        <button
          onClick={() => {
            if (positions?.positions?.length) {
              setWithdrawPositionId(positions.positions[0].id);
              setShowWithdraw(true);
            } else {
              showToast('error', t('banking.noPositionsToWithdraw'));
            }
          }}
          className="card p-3 text-center hover:bg-white/10 transition"
        >
          <span className="text-sm font-medium text-blue-400">{t('banking.withdrawFunds')}</span>
        </button>
      </div>

      {/* Savings Goal */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t('banking.savingsGoal')}</h2>
          {savingsGoal ? (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setGoalLabel(savingsGoal.label);
                  setGoalAmount(savingsGoal.targetAmount.toString());
                  setShowGoalForm(true);
                }}
                className="text-xs text-gold-400 hover:text-gold-300"
              >
                {t('banking.editGoal')}
              </button>
              <button
                onClick={() => setSavingsGoal(null)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                {t('banking.removeGoal')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowGoalForm(true)}
              className="text-xs text-gold-400 hover:text-gold-300"
            >
              {t('banking.setGoal')}
            </button>
          )}
        </div>

        {showGoalForm ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('banking.goalLabel')}</label>
              <input
                type="text"
                value={goalLabel}
                onChange={(e) => setGoalLabel(e.target.value)}
                placeholder={t('banking.goalLabelPlaceholder')}
                className="w-full bg-white/5 border border-white/10 px-4 py-2.5 text-sm focus:outline-none focus:border-gold-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {t('banking.targetAmount')}
              </label>
              <input
                type="number"
                value={goalAmount}
                onChange={(e) => setGoalAmount(e.target.value)}
                placeholder="1000"
                className="w-full bg-white/5 border border-white/10 px-4 py-2.5 text-sm focus:outline-none focus:border-gold-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveGoal}
                className="flex-1 py-2.5 bg-gold-500 text-black font-medium text-sm hover:bg-gold-400 transition"
              >
                {t('banking.saveGoal')}
              </button>
              <button
                onClick={() => setShowGoalForm(false)}
                className="flex-1 py-2.5 bg-white/10 text-gray-300 text-sm hover:bg-white/20 transition"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : savingsGoal ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">{savingsGoal.label}</span>
              <span className="text-gray-400">
                {formatUsd(totalInSavings || stablecoinUsd)} / {formatUsd(savingsGoal.targetAmount)}
              </span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${goalProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-right">{goalProgress.toFixed(1)}%</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">{t('banking.setGoal')}</p>
        )}
      </div>

      {/* Yield Rates */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">{t('banking.currentRates')}</h2>
        {rates.map((rate) => (
          <div key={`${rate.protocol}-${rate.token}`} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{rate.protocol}</p>
              <p className="text-xs text-gray-400">{rate.token}</p>
            </div>
            <span className="text-green-400 font-semibold text-sm">
              {rate.supplyApy.toFixed(1)}% APY
            </span>
          </div>
        ))}
      </div>

      {/* How Interest Works */}
      <div className="card p-4 space-y-2 bg-gradient-to-br from-blue-500/5 to-transparent border-blue-500/10">
        <h2 className="font-semibold text-sm">{t('banking.howInterestWorks')}</h2>
        <p className="text-xs text-gray-400 leading-relaxed">{t('banking.howInterestDesc')}</p>
      </div>

      {/* Savings Positions */}
      <div className="space-y-2">
        <h2 className="font-semibold">{t('banking.activePositions')}</h2>
        {positions?.positions?.length ? (
          positions.positions.map((pos) => (
            <div key={pos.id} className="card p-3 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">
                  {pos.currentAmount.toFixed(2)} {pos.token}
                </span>
                <p className="text-xs text-gray-500">
                  {pos.protocol} &middot; {pos.apy.toFixed(1)}% APY
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-green-400">
                  +{pos.earnedYield.toFixed(2)} {pos.token}
                </span>
                <button
                  onClick={() => {
                    setWithdrawPositionId(pos.id);
                    setShowWithdraw(true);
                  }}
                  className="block text-xs text-blue-400 hover:text-blue-300 mt-0.5"
                >
                  {t('banking.withdraw')}
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500">{t('banking.noPositions')}</p>
        )}
      </div>

      {/* Deposit Modal */}
      {showDeposit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-gray-900 border border-white/10 w-full sm:max-w-md p-6 space-y-4 sm:rounded-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">{t('banking.depositToSavings')}</h2>
              <button
                onClick={() => setShowDeposit(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('banking.token')}</label>
              <div className="flex gap-2">
                {(['USDC', 'USDT'] as const).map((tok) => (
                  <button
                    key={tok}
                    onClick={() => setDepositToken(tok)}
                    className={`flex-1 py-2 text-sm font-medium rounded transition ${
                      depositToken === tok
                        ? 'bg-gold-500 text-black'
                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                    }`}
                  >
                    {tok}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('banking.amount')}</label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-white/5 border border-white/10 px-4 py-2.5 text-sm focus:outline-none focus:border-gold-500"
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-500">
                  {t('banking.available')}: {maxDeposit.toLocaleString()} {depositToken}
                </span>
                <button
                  onClick={() => setDepositAmount(maxDeposit.toString())}
                  className="text-xs text-gold-400 hover:text-gold-300"
                >
                  MAX
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              {t('banking.earnAtRate', { apy: currentApy.toFixed(1) })}
            </p>

            <button
              onClick={handleDeposit}
              disabled={actionLoading || !depositAmount || parseFloat(depositAmount) <= 0}
              className="w-full py-3 bg-green-600 text-white font-medium text-sm hover:bg-green-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? t('common.processing') : t('banking.confirmDeposit')}
            </button>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdraw && withdrawPositionId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-gray-900 border border-white/10 w-full sm:max-w-md p-6 space-y-4 sm:rounded-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">{t('banking.withdrawFromSavings')}</h2>
              <button
                onClick={() => {
                  setShowWithdraw(false);
                  setWithdrawPositionId(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {(() => {
              const pos = positions?.positions?.find((p) => p.id === withdrawPositionId);
              if (!pos) return null;
              return (
                <div className="card p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>
                      {pos.protocol} {pos.token}
                    </span>
                    <span>
                      {pos.currentAmount.toFixed(2)} {pos.token}
                    </span>
                  </div>
                  <p className="text-xs text-green-400">
                    +{pos.earnedYield.toFixed(2)} {t('banking.earned')}
                  </p>
                </div>
              );
            })()}

            <p className="text-xs text-gray-400">{t('banking.withdrawFullPosition')}</p>

            <button
              onClick={handleWithdraw}
              disabled={actionLoading}
              className="w-full py-3 bg-blue-600 text-white font-medium text-sm hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? t('common.processing') : t('banking.confirmWithdraw')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
