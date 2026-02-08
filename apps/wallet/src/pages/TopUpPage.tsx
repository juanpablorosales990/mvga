import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../hooks/useToast';

interface Operator {
  operatorId: number;
  name: string;
  denominationType: string;
  minAmount: number | null;
  maxAmount: number | null;
  fixedAmounts: number[];
  suggestedAmounts: number[];
  country: { isoName: string; name: string };
}

interface TopUpRecord {
  id: string;
  recipientPhone: string;
  operatorName: string;
  amountUsd: number;
  deliveredAmount: number | null;
  deliveredCurrency: string | null;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'REFUNDED';
  createdAt: string;
}

const COUNTRY_CODE = 'VE';
const PRESET_AMOUNTS = [1, 2, 5, 10];

export default function TopUpPage() {
  const { t } = useTranslation();
  const { connected } = useSelfCustodyWallet();

  const [phone, setPhone] = useState('');
  const [operator, setOperator] = useState<Operator | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<'topup' | 'history'>('topup');
  const [history, setHistory] = useState<TopUpRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const detectOperator = useCallback(async () => {
    if (phone.length < 7) return;
    setDetecting(true);
    try {
      const op = await apiFetch<Operator>('/topup/detect-operator', {
        method: 'POST',
        body: JSON.stringify({ phone, countryCode: COUNTRY_CODE }),
      });
      setOperator(op);
    } catch {
      showToast('error', t('topup.detectFailed'));
      setOperator(null);
    } finally {
      setDetecting(false);
    }
  }, [phone, t]);

  const handleTopUp = async () => {
    if (!operator || !finalAmount) return;
    setSending(true);
    try {
      const result = await apiFetch<{
        status: string;
        deliveredAmount: number;
        deliveredCurrency: string;
      }>('/topup/topup', {
        method: 'POST',
        body: JSON.stringify({
          phone,
          countryCode: COUNTRY_CODE,
          operatorId: operator.operatorId,
          amount: finalAmount,
        }),
      });
      showToast(
        'success',
        t('topup.success', {
          amount: result.deliveredAmount,
          currency: result.deliveredCurrency,
        })
      );
      setPhone('');
      setOperator(null);
      setAmount(null);
      setCustomAmount('');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('topup.failed'));
    } finally {
      setSending(false);
    }
  };

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await apiFetch<TopUpRecord[]>('/topup/history');
      setHistory(data);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const finalAmount = amount ?? (customAmount ? parseFloat(customAmount) : null);
  const isRanged = operator?.denominationType === 'RANGE';
  const fixedAmounts = operator?.fixedAmounts?.length ? operator.fixedAmounts : null;
  const suggestedAmounts = operator?.suggestedAmounts?.length ? operator.suggestedAmounts : null;

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('topup.connectPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold uppercase tracking-tight">{t('topup.title')}</h1>
      <p className="text-white/40 text-xs">{t('topup.subtitle')}</p>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('topup')}
          className={`flex-1 py-2 text-sm font-medium border transition ${
            tab === 'topup'
              ? 'border-gold-500 bg-gold-500/10 text-gold-500'
              : 'border-white/10 text-white/50'
          }`}
        >
          {t('topup.rechargeTab')}
        </button>
        <button
          onClick={() => {
            setTab('history');
            loadHistory();
          }}
          className={`flex-1 py-2 text-sm font-medium border transition ${
            tab === 'history'
              ? 'border-gold-500 bg-gold-500/10 text-gold-500'
              : 'border-white/10 text-white/50'
          }`}
        >
          {t('topup.historyTab')}
        </button>
      </div>

      {tab === 'topup' ? (
        <>
          {/* Phone input */}
          <div className="card space-y-3">
            <label className="text-xs text-white/40 block">{t('topup.phone')}</label>
            <div className="flex gap-2">
              <span className="bg-white/10 px-3 py-2 text-white text-sm flex items-center">
                +58
              </span>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, ''));
                  setOperator(null);
                  setAmount(null);
                }}
                placeholder="4121234567"
                className="flex-1 bg-white/10 px-3 py-2 text-white text-sm"
                maxLength={10}
              />
            </div>
            <button
              onClick={detectOperator}
              disabled={phone.length < 7 || detecting}
              className="btn-primary w-full text-sm"
            >
              {detecting ? t('common.loading') : t('topup.detectCarrier')}
            </button>
          </div>

          {/* Operator detected */}
          {operator && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">{t('topup.carrier')}</span>
                <span className="text-sm font-medium text-gold-500">{operator.name}</span>
              </div>

              {/* Amount selection */}
              <label className="text-xs text-white/40 block">{t('topup.amount')}</label>

              {/* Fixed amounts from operator */}
              {fixedAmounts && (
                <div className="grid grid-cols-4 gap-2">
                  {fixedAmounts.slice(0, 8).map((amt) => (
                    <button
                      key={amt}
                      onClick={() => {
                        setAmount(amt);
                        setCustomAmount('');
                      }}
                      className={`py-2 text-sm font-medium border transition ${
                        amount === amt
                          ? 'border-gold-500 bg-gold-500/10 text-gold-500'
                          : 'border-white/10 text-white/50 hover:border-white/30'
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
              )}

              {/* Suggested amounts */}
              {!fixedAmounts && suggestedAmounts && (
                <div className="grid grid-cols-4 gap-2">
                  {suggestedAmounts.slice(0, 8).map((amt) => (
                    <button
                      key={amt}
                      onClick={() => {
                        setAmount(amt);
                        setCustomAmount('');
                      }}
                      className={`py-2 text-sm font-medium border transition ${
                        amount === amt
                          ? 'border-gold-500 bg-gold-500/10 text-gold-500'
                          : 'border-white/10 text-white/50 hover:border-white/30'
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
              )}

              {/* Preset quick amounts (always shown) */}
              {!fixedAmounts && !suggestedAmounts && (
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => {
                        setAmount(amt);
                        setCustomAmount('');
                      }}
                      className={`py-2 text-sm font-medium border transition ${
                        amount === amt
                          ? 'border-gold-500 bg-gold-500/10 text-gold-500'
                          : 'border-white/10 text-white/50 hover:border-white/30'
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
              )}

              {/* Custom amount for RANGE operators */}
              {isRanged && (
                <div>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value);
                      setAmount(null);
                    }}
                    placeholder={`$${operator.minAmount ?? 1} - $${operator.maxAmount ?? 50}`}
                    className="w-full bg-white/10 px-3 py-2 text-white text-sm"
                    min={operator.minAmount ?? 1}
                    max={operator.maxAmount ?? 50}
                    step="0.01"
                  />
                </div>
              )}

              {/* Confirm button */}
              <button
                onClick={handleTopUp}
                disabled={!finalAmount || finalAmount < 0.01 || finalAmount > 50 || sending}
                className="btn-primary w-full"
              >
                {sending
                  ? t('common.processing')
                  : t('topup.recharge', { amount: finalAmount ?? '...' })}
              </button>
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
            <p className="text-center text-white/30 py-12 text-sm">{t('topup.noHistory')}</p>
          ) : (
            history.map((item) => (
              <div key={item.id} className="card flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">+58{item.recipientPhone}</p>
                  <p className="text-xs text-white/40">
                    {item.operatorName} &middot; {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">${item.amountUsd}</p>
                  <p
                    className={`text-xs ${
                      item.status === 'SUCCESSFUL'
                        ? 'text-green-400'
                        : item.status === 'FAILED'
                          ? 'text-red-400'
                          : 'text-gold-500'
                    }`}
                  >
                    {t(`topup.status_${item.status}`)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Info */}
      <div className="bg-white/5 border border-white/10 px-4 py-3">
        <p className="text-white/30 text-xs font-mono">{t('topup.poweredBy')}</p>
      </div>
    </div>
  );
}
