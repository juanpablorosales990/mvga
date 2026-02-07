import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { usePrices } from '../hooks/usePrices';
import { useWalletStore } from '../stores/walletStore';

const MOCK_APY = 5.2;

const MOCK_INTEREST_HISTORY = [
  { date: '2025-12-01', amount: 2.17 },
  { date: '2025-11-01', amount: 1.94 },
  { date: '2025-10-01', amount: 1.82 },
  { date: '2025-09-01', amount: 1.65 },
];

export default function SavingsPage() {
  const { t } = useTranslation();
  const { connected } = useSelfCustodyWallet();
  const balances = useWalletStore((s) => s.balances);
  const preferredCurrency = useWalletStore((s) => s.preferredCurrency);
  const savingsGoal = useWalletStore((s) => s.savingsGoal);
  const setSavingsGoal = useWalletStore((s) => s.setSavingsGoal);
  const { prices, formatUsdValue } = usePrices();

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalLabel, setGoalLabel] = useState(savingsGoal?.label ?? '');
  const [goalAmount, setGoalAmount] = useState(savingsGoal?.targetAmount?.toString() ?? '');

  const usdcBalance = balances.find((b) => b.symbol === 'USDC');
  const usdtBalance = balances.find((b) => b.symbol === 'USDT');
  const stablecoinUsd = (usdcBalance?.usdValue ?? 0) + (usdtBalance?.usdValue ?? 0);

  const dailyInterest = (stablecoinUsd * (MOCK_APY / 100)) / 365;
  const monthlyInterest = (stablecoinUsd * (MOCK_APY / 100)) / 12;
  const yearlyInterest = stablecoinUsd * (MOCK_APY / 100);

  const formatUsd = (usd: number) => formatUsdValue(usd, preferredCurrency);

  const handleSaveGoal = () => {
    const amount = parseFloat(goalAmount);
    if (!goalLabel.trim() || isNaN(amount) || amount <= 0) return;
    setSavingsGoal({ label: goalLabel.trim(), targetAmount: amount });
    setShowGoalForm(false);
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('banking.connectPrompt')}</p>
      </div>
    );
  }

  const goalProgress = savingsGoal
    ? Math.min((stablecoinUsd / savingsGoal.targetAmount) * 100, 100)
    : 0;

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
        <p className="text-3xl font-bold mt-1">{formatUsd(stablecoinUsd)}</p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs text-green-400 font-medium">
            {MOCK_APY}% {t('banking.apy')}
          </span>
          <span className="text-xs text-gray-500">~{formatUsd(monthlyInterest)}/mo</span>
        </div>
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
                {formatUsd(stablecoinUsd)} / {formatUsd(savingsGoal.targetAmount)}
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

      {/* Deposit / Withdraw */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/receive" className="card p-3 text-center hover:bg-white/10 transition">
          <span className="text-sm font-medium text-green-400">{t('banking.depositFunds')}</span>
        </Link>
        <Link to="/send" className="card p-3 text-center hover:bg-white/10 transition">
          <span className="text-sm font-medium text-blue-400">{t('banking.withdrawFunds')}</span>
        </Link>
      </div>

      {/* How Interest Works */}
      <div className="card p-4 space-y-2 bg-gradient-to-br from-blue-500/5 to-transparent border-blue-500/10">
        <h2 className="font-semibold text-sm">{t('banking.howInterestWorks')}</h2>
        <p className="text-xs text-gray-400 leading-relaxed">{t('banking.howInterestDesc')}</p>
      </div>

      {/* Interest History (Mock) */}
      <div className="space-y-2">
        <h2 className="font-semibold">{t('banking.interestHistory')}</h2>
        {MOCK_INTEREST_HISTORY.map((entry) => (
          <div key={entry.date} className="card p-3 flex items-center justify-between">
            <span className="text-sm text-green-400 font-medium">+${entry.amount.toFixed(2)}</span>
            <span className="text-xs text-gray-500">
              {new Date(entry.date).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
