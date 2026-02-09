import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWalletStore } from '../stores/walletStore';

interface ChecklistItem {
  labelKey: string;
  completed: boolean;
  href: string;
}

export default function GettingStartedCard() {
  const { t } = useTranslation();
  const checklistDismissed = useWalletStore((s) => s.checklistDismissed);
  const dismissChecklist = useWalletStore((s) => s.dismissChecklist);
  const balances = useWalletStore((s) => s.balances);
  const firstSendCompleted = useWalletStore((s) => s.firstSendCompleted);
  const cardStatus = useWalletStore((s) => s.cardStatus);
  const kycStatus = useWalletStore((s) => s.kycStatus);

  const hasBalance = useMemo(() => balances.some((b) => b.balance > 0), [balances]);

  const items: ChecklistItem[] = useMemo(
    () => [
      { labelKey: 'checklist.createWallet', completed: true, href: '/' },
      { labelKey: 'checklist.secureBiometrics', completed: false, href: '/settings' },
      { labelKey: 'checklist.firstDeposit', completed: hasBalance, href: '/deposit' },
      { labelKey: 'checklist.verifyIdentity', completed: kycStatus === 'APPROVED', href: '/kyc' },
      { labelKey: 'checklist.firstSend', completed: firstSendCompleted, href: '/send' },
      { labelKey: 'checklist.joinCard', completed: cardStatus !== 'none', href: '/banking/card' },
      { labelKey: 'checklist.inviteFriend', completed: false, href: '/referral' },
    ],
    [hasBalance, kycStatus, firstSendCompleted, cardStatus]
  );

  const completedCount = items.filter((i) => i.completed).length;

  if (checklistDismissed || completedCount === items.length) return null;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider">{t('checklist.title')}</h3>
        <button
          onClick={dismissChecklist}
          className="text-xs text-white/30 font-mono uppercase tracking-wider hover:text-white/50 transition"
        >
          {t('checklist.dismiss')}
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-white/10 mb-4">
        <div
          className="h-full bg-gold-500 transition-all duration-500"
          style={{ width: `${(completedCount / items.length) * 100}%` }}
        />
      </div>

      <p className="text-xs text-white/30 font-mono mb-3">
        {t('checklist.progress', { completed: completedCount, total: items.length })}
      </p>

      {/* Checklist items */}
      <div className="space-y-1">
        {items.map((item) => (
          <Link
            key={item.labelKey}
            to={item.completed ? '#' : item.href}
            className={`flex items-center gap-3 py-2 px-1 transition ${
              item.completed ? 'opacity-50 pointer-events-none' : 'hover:bg-white/5'
            }`}
          >
            {/* Checkbox */}
            <div
              className={`w-5 h-5 border flex-shrink-0 flex items-center justify-center ${
                item.completed ? 'border-gold-500 bg-gold-500/20' : 'border-white/20'
              }`}
            >
              {item.completed && (
                <svg
                  className="w-3 h-3 text-gold-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>

            {/* Label */}
            <span
              className={`text-sm font-mono ${
                item.completed ? 'line-through text-white/30' : 'text-white/70'
              }`}
            >
              {t(item.labelKey)}
            </span>

            {/* Arrow for incomplete */}
            {!item.completed && <span className="ml-auto text-gold-500 text-xs font-mono">→</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
