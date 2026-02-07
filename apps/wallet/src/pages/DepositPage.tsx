import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function DepositPage() {
  const { t } = useTranslation();
  const { publicKey, connected } = useSelfCustodyWallet();
  const walletAddress = publicKey?.toBase58() || '';

  if (!connected) {
    return (
      <div className="text-center py-16 text-white/40">
        <p>{t('deposit.connectPrompt')}</p>
      </div>
    );
  }

  // Onramper widget URL with pre-filled wallet address
  const onramperUrl = new URL('https://buy.onramper.com');
  onramperUrl.searchParams.set('apiKey', 'pk_prod_01JDGFPQBQ1S4PKXZQHP3FSWPM');
  onramperUrl.searchParams.set('defaultCrypto', 'USDC_SOL');
  onramperUrl.searchParams.set('onlyCryptos', 'SOL,USDC_SOL,USDT_SOL');
  onramperUrl.searchParams.set(
    'wallets',
    `SOL:${walletAddress},USDC_SOL:${walletAddress},USDT_SOL:${walletAddress}`
  );
  onramperUrl.searchParams.set('themeName', 'dark');
  onramperUrl.searchParams.set('containerColor', '0a0a0aff');
  onramperUrl.searchParams.set('primaryColor', 'f59e0bff');
  onramperUrl.searchParams.set('secondaryColor', '1a1a1aff');
  onramperUrl.searchParams.set('cardColor', '1a1a1aff');
  onramperUrl.searchParams.set('primaryTextColor', 'ffffffff');
  onramperUrl.searchParams.set('secondaryTextColor', 'ffffff66');
  onramperUrl.searchParams.set('borderRadius', '0');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold uppercase tracking-tight">{t('deposit.title')}</h1>
        <Link to="/receive" className="text-xs text-gold-500 font-mono uppercase">
          {t('deposit.receiveCrypto')} &rarr;
        </Link>
      </div>

      <p className="text-white/40 text-xs">{t('deposit.description')}</p>

      {/* Onramper iframe */}
      <div className="border border-white/10 overflow-hidden" style={{ height: '630px' }}>
        <iframe
          src={onramperUrl.toString()}
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
