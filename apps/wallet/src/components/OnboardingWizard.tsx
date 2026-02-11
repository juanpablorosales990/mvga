import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useWalletStore } from '../stores/walletStore';
import { track, AnalyticsEvents } from '../lib/analytics';

interface WizardStep {
  target: string; // data-wizard-target value
  titleKey: string;
  descKey: string;
  position: 'top' | 'bottom';
}

const STEPS: WizardStep[] = [
  {
    target: 'balance-card',
    titleKey: 'wizard.balanceTitle',
    descKey: 'wizard.balanceDesc',
    position: 'bottom',
  },
  {
    target: 'deposit-btn',
    titleKey: 'wizard.depositTitle',
    descKey: 'wizard.depositDesc',
    position: 'bottom',
  },
  {
    target: 'cashout-btn',
    titleKey: 'wizard.cashoutTitle',
    descKey: 'wizard.cashoutDesc',
    position: 'bottom',
  },
  {
    target: 'actions-grid',
    titleKey: 'wizard.actionsTitle',
    descKey: 'wizard.actionsDesc',
    position: 'bottom',
  },
  {
    target: 'token-list',
    titleKey: 'wizard.tokensTitle',
    descKey: 'wizard.tokensDesc',
    position: 'top',
  },
  {
    target: 'bottom-nav',
    titleKey: 'wizard.navTitle',
    descKey: 'wizard.navDesc',
    position: 'top',
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function OnboardingWizard() {
  const { t } = useTranslation();
  const completeWizard = useWalletStore((s) => s.completeWizard);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const current = STEPS[step];

  const measureTarget = useCallback(() => {
    if (!current) return;
    const el = document.querySelector(`[data-wizard-target="${current.target}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top - 8,
      left: r.left - 8,
      width: r.width + 16,
      height: r.height + 16,
    });
  }, [current]);

  useEffect(() => {
    measureTarget();
    window.addEventListener('resize', measureTarget);
    window.addEventListener('scroll', measureTarget);
    return () => {
      window.removeEventListener('resize', measureTarget);
      window.removeEventListener('scroll', measureTarget);
    };
  }, [measureTarget]);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      track(AnalyticsEvents.WIZARD_COMPLETED, { steps: STEPS.length });
      completeWizard();
    }
  };

  const handleSkip = () => {
    track(AnalyticsEvents.WIZARD_SKIPPED, { skippedAt: step + 1 });
    completeWizard();
  };

  const isLast = step === STEPS.length - 1;

  if (!rect) return null;

  // Tooltip positioning
  const tooltipStyle: React.CSSProperties =
    current.position === 'bottom'
      ? { top: rect.top + rect.height + 16, left: 16, right: 16 }
      : { bottom: window.innerHeight - rect.top + 16, left: 16, right: 16 };

  return (
    <div
      className="fixed inset-0 z-[60] pointer-events-none"
      data-testid="onboarding-wizard-overlay"
    >
      {/* SVG overlay with cutout — pointer-events-none so it never blocks nav clicks */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="wizard-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={rect.left}
              y={rect.top}
              width={rect.width}
              height={rect.height}
              fill="black"
              rx="0"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.85)" mask="url(#wizard-mask)" />
        {/* Highlight border */}
        <rect
          x={rect.left}
          y={rect.top}
          width={rect.width}
          height={rect.height}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2"
          rx="0"
        />
      </svg>

      {/* Tooltip card — re-enable pointer events for interactive elements */}
      <div className="absolute pointer-events-auto" style={tooltipStyle}>
        <div className="bg-[#1a1a1a] border border-gold-500/30 p-5">
          {/* Step counter */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gold-500 font-mono uppercase tracking-wider">
              {step + 1} / {STEPS.length}
            </span>
            <button
              onClick={handleSkip}
              className="text-xs text-white/30 hover:text-white/50 transition font-mono uppercase tracking-wider"
            >
              {t('wizard.skip')}
            </button>
          </div>

          {/* Content */}
          <h3 className="text-lg font-bold mb-2">{t(current.titleKey)}</h3>
          <p className="text-sm text-white/50 mb-4">{t(current.descKey)}</p>

          {/* Navigation */}
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 py-2.5 text-sm font-medium bg-white/10 hover:bg-white/20 transition"
              >
                {t('wizard.prev')}
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex-1 py-2.5 text-sm font-bold bg-gold-500 text-black hover:bg-gold-400 transition"
            >
              {isLast ? t('wizard.done') : t('wizard.next')}
            </button>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mt-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 transition-all duration-300 ${
                  i === step
                    ? 'w-4 bg-gold-500'
                    : i < step
                      ? 'w-2 bg-gold-500/50'
                      : 'w-2 bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
