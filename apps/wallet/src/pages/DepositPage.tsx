import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMemo, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../hooks/useToast';

const PRESET_AMOUNTS = [5, 10, 25, 50];

type Tab = 'onramper' | 'coinbase';

export default function DepositPage() {
  const { t } = useTranslation();
  const { publicKey, connected } = useSelfCustodyWallet();
  const walletAddress = publicKey?.toBase58() || '';
  const [presetAmount, setPresetAmount] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('onramper');
  const [coinbaseUrl, setCoinbaseUrl] = useState<string | null>(null);
  const [coinbaseLoading, setCoinbaseLoading] = useState(false);

  const onramperSrc = useMemo(() => {
    if (!walletAddress) return '';
    const url = new URL('https://buy.onramper.com');
    url.searchParams.set('apiKey', 'pk_prod_01JDGFPQBQ1S4PKXZQHP3FSWPM');
    url.searchParams.set('defaultCrypto', 'USDC_SOL');
    url.searchParams.set('onlyCryptos', 'SOL,USDC_SOL,USDT_SOL');
    url.searchParams.set(
      'wallets',
      `SOL:${walletAddress},USDC_SOL:${walletAddress},USDT_SOL:${walletAddress}`
    );
    url.searchParams.set('themeName', 'dark');
    url.searchParams.set('containerColor', '0a0a0aff');
    url.searchParams.set('primaryColor', 'f59e0bff');
    url.searchParams.set('secondaryColor', '1a1a1aff');
    url.searchParams.set('cardColor', '1a1a1aff');
    url.searchParams.set('primaryTextColor', 'ffffffff');
    url.searchParams.set('secondaryTextColor', 'ffffff66');
    url.searchParams.set('borderRadius', '0');
    if (presetAmount) {
      url.searchParams.set('defaultAmount', String(presetAmount));
    }
    return url.toString();
  }, [walletAddress, presetAmount]);

  const loadCoinbaseSession = async () => {
    if (coinbaseUrl) return; // Already loaded
    setCoinbaseLoading(true);
    try {
      const data = await apiFetch<{ widgetUrl: string }>('/onramp/session', {
        method: 'POST',
      });
      setCoinbaseUrl(data.widgetUrl);
    } catch {
      showToast('error', t('deposit.coinbaseError'));
    } finally {
      setCoinbaseLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="text-center py-16 text-white/40">
        <p>{t('deposit.connectPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold uppercase tracking-tight">{t('deposit.title')}</h1>
        <Link to="/receive" className="text-xs text-gold-500 font-mono uppercase">
          {t('deposit.receiveCrypto')} &rarr;
        </Link>
      </div>

      <p className="text-white/40 text-xs">{t('deposit.description')}</p>

      {/* Provider tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('onramper')}
          className={`flex-1 py-2 text-sm font-medium border transition ${
            tab === 'onramper'
              ? 'border-gold-500 bg-gold-500/10 text-gold-500'
              : 'border-white/10 text-white/50'
          }`}
        >
          {t('deposit.cardBank')}
        </button>
        <button
          onClick={() => {
            setTab('coinbase');
            loadCoinbaseSession();
          }}
          className={`flex-1 py-2 text-sm font-medium border transition ${
            tab === 'coinbase'
              ? 'border-gold-500 bg-gold-500/10 text-gold-500'
              : 'border-white/10 text-white/50'
          }`}
        >
          {t('deposit.coinbaseTab')}
        </button>
      </div>

      {tab === 'onramper' ? (
        <>
          {/* Preset amounts */}
          <div>
            <p className="text-white/40 text-xs mb-2">{t('deposit.quickAmounts')}</p>
            <div className="flex gap-2">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setPresetAmount(presetAmount === amt ? null : amt)}
                  className={`flex-1 py-2 text-sm font-medium border transition ${
                    presetAmount === amt
                      ? 'border-gold-500 bg-gold-500/10 text-gold-500'
                      : 'border-white/10 text-white/50 hover:border-white/30'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
          </div>

          {/* Onramper iframe */}
          <div className="border border-white/10 overflow-hidden" style={{ height: '630px' }}>
            <iframe
              key={presetAmount ?? 'default'}
              src={onramperSrc}
              title={t('deposit.buyCrypto')}
              height="630"
              width="100%"
              allow="accelerometer; autoplay; camera; gyroscope; payment"
              style={{ border: 'none' }}
            />
          </div>

          <div className="bg-white/5 border border-white/10 px-4 py-3">
            <p className="text-white/30 text-xs font-mono">{t('deposit.poweredBy')}</p>
          </div>
        </>
      ) : (
        <>
          {/* Coinbase Onramp */}
          {coinbaseLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : coinbaseUrl ? (
            <div className="border border-white/10 overflow-hidden" style={{ height: '630px' }}>
              <iframe
                src={coinbaseUrl}
                title={t('deposit.coinbaseTitle')}
                height="630"
                width="100%"
                allow="accelerometer; autoplay; camera; gyroscope; payment"
                style={{ border: 'none' }}
              />
            </div>
          ) : (
            <div className="card text-center py-12 space-y-3">
              <p className="text-white/40 text-sm">{t('deposit.coinbaseUnavailable')}</p>
              <p className="text-white/20 text-xs">{t('deposit.coinbaseNote')}</p>
            </div>
          )}

          <div className="bg-white/5 border border-white/10 px-4 py-3">
            <p className="text-white/30 text-xs font-mono">{t('deposit.coinbasePoweredBy')}</p>
          </div>
        </>
      )}

      {/* Top-up link */}
      <Link
        to="/topup"
        className="card flex items-center justify-between hover:bg-white/5 transition"
      >
        <div>
          <p className="text-sm font-medium">{t('deposit.phoneTopup')}</p>
          <p className="text-xs text-white/30">{t('deposit.phoneTopupDesc')}</p>
        </div>
        <span className="text-gold-500 text-sm font-mono">&rarr;</span>
      </Link>

      {/* P2P alternative */}
      <Link
        to="/p2p"
        className="card flex items-center justify-between hover:bg-white/5 transition"
      >
        <div>
          <p className="text-sm font-medium">{t('deposit.p2pExchange')}</p>
          <p className="text-xs text-white/30">{t('deposit.p2pDescription')}</p>
        </div>
        <span className="text-gold-500 text-sm font-mono">&rarr;</span>
      </Link>
    </div>
  );
}
