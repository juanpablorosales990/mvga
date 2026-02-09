import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../hooks/useToast';
import { API_URL } from '../config';

interface MoneygramTx {
  id: string;
  direction: 'ONRAMP' | 'OFFRAMP';
  amountUsd: number;
  status: string;
  referenceNumber?: string;
  interactiveUrl?: string;
  createdAt: string;
}

interface FeeEstimate {
  amountUsd: number;
  bridgeFee: number;
  mgFeeEstimate: number;
  totalFees: number;
  netAmount: number;
  estimatedTime: number;
}

type Tab = 'offramp' | 'onramp' | 'history';

const OFFRAMP_PRESETS = [25, 50, 100, 250];
const ONRAMP_PRESETS = [10, 25, 50, 100];

export default function MoneygramPage() {
  const { t } = useTranslation();
  const { connected } = useSelfCustodyWallet();
  const [searchParams] = useSearchParams();

  const initialTab = (searchParams.get('tab') as Tab) || 'offramp';
  const [tab, setTab] = useState<Tab>(initialTab);

  // Off-ramp state
  const [offrampAmount, setOfframpAmount] = useState<number | null>(null);
  const [offrampCustom, setOfframpCustom] = useState('');
  const [offrampSending, setOfframpSending] = useState(false);
  const [offrampFees, setOfframpFees] = useState<FeeEstimate | null>(null);
  const [offrampFeesLoading, setOfframpFeesLoading] = useState(false);

  // On-ramp state
  const [onrampAmount, setOnrampAmount] = useState<number | null>(null);
  const [onrampCustom, setOnrampCustom] = useState('');
  const [onrampSending, setOnrampSending] = useState(false);

  // History state
  const [history, setHistory] = useState<MoneygramTx[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Active transaction tracking
  const [activeTx, setActiveTx] = useState<MoneygramTx | null>(null);

  // MoneyGram enabled check
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/moneygram/status`)
      .then((r) => r.json())
      .then((d) => setEnabled(d.enabled))
      .catch(() => {});
  }, []);

  const offrampFinal = offrampAmount ?? (offrampCustom ? parseFloat(offrampCustom) : null);
  const onrampFinal = onrampAmount ?? (onrampCustom ? parseFloat(onrampCustom) : null);

  // Fetch fee estimate when off-ramp amount changes
  useEffect(() => {
    if (!offrampFinal || offrampFinal < 5) {
      setOfframpFees(null);
      return;
    }
    const controller = new AbortController();
    setOfframpFeesLoading(true);
    apiFetch<FeeEstimate>(`/moneygram/estimate?amountUsd=${offrampFinal}&direction=OFFRAMP`)
      .then(setOfframpFees)
      .catch(() => setOfframpFees(null))
      .finally(() => setOfframpFeesLoading(false));
    return () => controller.abort();
  }, [offrampFinal]);

  const handleOfframp = async () => {
    if (!offrampFinal || offrampFinal < 5 || offrampFinal > 2500) return;
    setOfframpSending(true);
    try {
      const result = await apiFetch<MoneygramTx>('/moneygram/offramp/initiate', {
        method: 'POST',
        body: JSON.stringify({ amountUsd: offrampFinal }),
      });
      setActiveTx(result);

      // Open MoneyGram webview in popup
      if (result.interactiveUrl) {
        const popup = window.open(result.interactiveUrl, 'moneygram', 'width=500,height=700');

        // Listen for popup close to confirm
        const check = setInterval(() => {
          if (!popup || popup.closed) {
            clearInterval(check);
            apiFetch('/moneygram/offramp/confirm', {
              method: 'POST',
              body: JSON.stringify({ transactionId: result.id }),
            })
              .then(() => {
                showToast('success', t('moneygram.offrampConfirmed'));
                setOfframpAmount(null);
                setOfframpCustom('');
                setOfframpFees(null);
              })
              .catch(() => {});
          }
        }, 1000);
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('moneygram.offrampFailed'));
    } finally {
      setOfframpSending(false);
    }
  };

  const handleOnramp = async () => {
    if (!onrampFinal || onrampFinal < 5 || onrampFinal > 950) return;
    setOnrampSending(true);
    try {
      const result = await apiFetch<MoneygramTx>('/moneygram/onramp/initiate', {
        method: 'POST',
        body: JSON.stringify({ amountUsd: onrampFinal }),
      });
      setActiveTx(result);

      if (result.interactiveUrl) {
        window.open(result.interactiveUrl, 'moneygram', 'width=500,height=700');
      }
      showToast('success', t('moneygram.onrampStarted'));
      setOnrampAmount(null);
      setOnrampCustom('');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('moneygram.onrampFailed'));
    } finally {
      setOnrampSending(false);
    }
  };

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await apiFetch<MoneygramTx[]>('/moneygram/transactions');
      setHistory(data);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const statusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-400';
      case 'FAILED':
      case 'CANCELLED':
      case 'EXPIRED':
        return 'text-red-400';
      default:
        return 'text-gold-500';
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('moneygram.connectPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold uppercase tracking-tight">{t('moneygram.title')}</h1>
      <p className="text-white/40 text-xs">{t('moneygram.subtitle')}</p>

      {!enabled && (
        <div className="bg-yellow-900/20 border border-yellow-500/30 px-4 py-3">
          <p className="text-yellow-400 text-xs">{t('moneygram.notEnabled')}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {(['offramp', 'onramp', 'history'] as Tab[]).map((t_tab) => (
          <button
            key={t_tab}
            onClick={() => {
              setTab(t_tab);
              if (t_tab === 'history') loadHistory();
            }}
            className={`flex-1 py-2 text-sm font-medium border transition ${
              tab === t_tab
                ? 'border-gold-500 bg-gold-500/10 text-gold-500'
                : 'border-white/10 text-white/50'
            }`}
          >
            {t(`moneygram.tab_${t_tab}`)}
          </button>
        ))}
      </div>

      {tab === 'offramp' ? (
        <>
          {/* Amount selection */}
          <div className="card space-y-3">
            <label className="text-xs text-white/40 block">
              {t('moneygram.offrampAmountLabel')}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {OFFRAMP_PRESETS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => {
                    setOfframpAmount(amt);
                    setOfframpCustom('');
                  }}
                  className={`py-2 text-sm font-medium border transition ${
                    offrampAmount === amt
                      ? 'border-gold-500 bg-gold-500/10 text-gold-500'
                      : 'border-white/10 text-white/50 hover:border-white/30'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={offrampCustom}
              onChange={(e) => {
                setOfframpCustom(e.target.value);
                setOfframpAmount(null);
              }}
              placeholder={t('moneygram.customAmount')}
              className="w-full bg-white/10 px-3 py-2 text-white text-sm"
              min={5}
              max={2500}
              step="0.01"
            />
            <p className="text-white/20 text-xs">{t('moneygram.offrampLimits')}</p>
          </div>

          {/* Fee estimate */}
          {offrampFeesLoading ? (
            <div className="card flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : offrampFees ? (
            <div className="card space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/40">{t('moneygram.amount')}</span>
                <span className="text-white">${offrampFees.amountUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">{t('moneygram.bridgeFee')}</span>
                <span className="text-white/60">-${offrampFees.bridgeFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">{t('moneygram.mgFee')}</span>
                <span className="text-white/60">-${offrampFees.mgFeeEstimate.toFixed(2)}</span>
              </div>
              <hr className="border-white/10" />
              <div className="flex justify-between text-sm font-bold">
                <span className="text-white/60">{t('moneygram.youReceive')}</span>
                <span className="text-gold-500">${offrampFees.netAmount.toFixed(2)}</span>
              </div>
              <p className="text-white/20 text-xs">
                {t('moneygram.estimatedTime', {
                  minutes: Math.round(offrampFees.estimatedTime / 60),
                })}
              </p>
            </div>
          ) : null}

          <button
            onClick={handleOfframp}
            disabled={
              !offrampFinal || offrampFinal < 5 || offrampFinal > 2500 || offrampSending || !enabled
            }
            className="btn-primary w-full"
          >
            {offrampSending ? t('common.processing') : t('moneygram.startCashOut')}
          </button>

          {/* Active transaction */}
          {activeTx && activeTx.direction === 'OFFRAMP' && (
            <div className="card space-y-2">
              <p className="text-sm font-medium text-gold-500">{t('moneygram.txActive')}</p>
              <p className="text-xs text-white/40">
                {t('moneygram.txId')}: {activeTx.id.slice(0, 8)}...
              </p>
              {activeTx.referenceNumber && (
                <p className="text-sm font-mono text-green-400">
                  {t('moneygram.referenceNumber')}: {activeTx.referenceNumber}
                </p>
              )}
            </div>
          )}
        </>
      ) : tab === 'onramp' ? (
        <>
          {/* On-ramp amount */}
          <div className="card space-y-3">
            <label className="text-xs text-white/40 block">
              {t('moneygram.onrampAmountLabel')}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {ONRAMP_PRESETS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => {
                    setOnrampAmount(amt);
                    setOnrampCustom('');
                  }}
                  className={`py-2 text-sm font-medium border transition ${
                    onrampAmount === amt
                      ? 'border-gold-500 bg-gold-500/10 text-gold-500'
                      : 'border-white/10 text-white/50 hover:border-white/30'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={onrampCustom}
              onChange={(e) => {
                setOnrampCustom(e.target.value);
                setOnrampAmount(null);
              }}
              placeholder={t('moneygram.customAmount')}
              className="w-full bg-white/10 px-3 py-2 text-white text-sm"
              min={5}
              max={950}
              step="0.01"
            />
            <p className="text-white/20 text-xs">{t('moneygram.onrampLimits')}</p>
          </div>

          {/* Instructions */}
          <div className="card space-y-2">
            <p className="text-sm font-medium">{t('moneygram.howItWorks')}</p>
            <ol className="list-decimal list-inside text-xs text-white/40 space-y-1">
              <li>{t('moneygram.step1_onramp')}</li>
              <li>{t('moneygram.step2_onramp')}</li>
              <li>{t('moneygram.step3_onramp')}</li>
            </ol>
          </div>

          <button
            onClick={handleOnramp}
            disabled={
              !onrampFinal || onrampFinal < 5 || onrampFinal > 950 || onrampSending || !enabled
            }
            className="btn-primary w-full"
          >
            {onrampSending ? t('common.processing') : t('moneygram.startDeposit')}
          </button>

          {/* Active on-ramp transaction */}
          {activeTx && activeTx.direction === 'ONRAMP' && (
            <div className="card space-y-2">
              <p className="text-sm font-medium text-gold-500">{t('moneygram.txActive')}</p>
              <p className="text-xs text-white/40">
                {t('moneygram.txId')}: {activeTx.id.slice(0, 8)}...
              </p>
              <p className="text-xs text-white/40">{t('moneygram.onrampPending')}</p>
            </div>
          )}
        </>
      ) : (
        /* History tab */
        <div className="space-y-2">
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-white/30 py-12 text-sm">{t('moneygram.noHistory')}</p>
          ) : (
            history.map((item) => (
              <div key={item.id} className="card flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {item.direction === 'OFFRAMP' ? t('moneygram.cashOut') : t('moneygram.cashIn')}
                  </p>
                  <p className="text-xs text-white/40">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                  {item.referenceNumber && (
                    <p className="text-xs text-white/30 font-mono">Ref: {item.referenceNumber}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">${item.amountUsd}</p>
                  <p className={`text-xs ${statusColor(item.status)}`}>
                    {t(`moneygram.status_${item.status}`)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Powered by */}
      <div className="bg-white/5 border border-white/10 px-4 py-3">
        <p className="text-white/30 text-xs font-mono">{t('moneygram.poweredBy')}</p>
      </div>
    </div>
  );
}
