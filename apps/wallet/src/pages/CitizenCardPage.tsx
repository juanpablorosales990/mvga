import { useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useWalletStore } from '../stores/walletStore';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { track, AnalyticsEvents } from '../lib/analytics';

function padNumber(n: number, digits = 6): string {
  return String(n).padStart(digits, '0');
}

function formatDate(dateStr?: string): string {
  const date = dateStr ? new Date(dateStr) : new Date();
  return date.toLocaleDateString('es-VE', { year: 'numeric', month: 'short' });
}

export default function CitizenCardPage() {
  const { t } = useTranslation();
  const { connected, publicKey } = useSelfCustodyWallet();
  const citizenNumber = useWalletStore((s) => s.citizenNumber);
  const displayName = useWalletStore((s) => s.displayName);
  const username = useWalletStore((s) => s.username);
  const cardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  const walletShort = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : '';

  const handleShare = useCallback(async () => {
    if (!citizenNumber) return;
    setSharing(true);

    try {
      // Use Web Share API if available (mobile-first)
      if (navigator.share) {
        await navigator.share({
          title: 'MVGA - Ciudadano Digital',
          text: t('citizen.shareText', { number: citizenNumber }),
          url: 'https://mvga.io',
        });
      } else {
        // Fallback: copy share text
        await navigator.clipboard.writeText(
          `${t('citizen.shareText', { number: citizenNumber })}\nhttps://mvga.io`
        );
      }
      track(AnalyticsEvents.CITIZEN_CARD_SHARED, { citizenNumber });
    } catch {
      // User cancelled share — not an error
    } finally {
      setSharing(false);
    }
  }, [citizenNumber, t]);

  if (!connected) {
    return (
      <div className="space-y-6 text-center pt-12">
        <p className="text-white/40">{t('common.connectWallet')}</p>
      </div>
    );
  }

  if (!citizenNumber) {
    return (
      <div className="space-y-6 text-center pt-12">
        <div className="w-10 h-10 border-2 border-gold-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-white/40 text-sm">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t('citizen.title')}</h1>
        <p className="text-white/40 text-sm mt-1">{t('citizen.subtitle')}</p>
      </div>

      {/* ── THE CARD ─────────────────────────────────── */}
      <div ref={cardRef} className="citizen-card mx-auto max-w-sm">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] border border-gold-500/30 p-6 shadow-[0_0_40px_rgba(212,175,55,0.15)]">
          {/* Background pattern — subtle Venezuelan stars */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext x='30' y='35' text-anchor='middle' font-size='20' fill='%23D4AF37'%3E%E2%98%85%3C/text%3E%3C/svg%3E")`,
              backgroundSize: '60px 60px',
            }}
          />

          {/* Top bar */}
          <div className="relative flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] tracking-[0.4em] text-gold-500/60 uppercase font-mono">
                {t('citizen.cardTitle')}
              </p>
              <p className="text-3xl font-black tracking-tighter text-white mt-1">MVGA</p>
            </div>
            <div className="w-14 h-14 border-2 border-gold-500/40 flex items-center justify-center">
              <div className="text-gold-500 text-2xl font-black">VE</div>
            </div>
          </div>

          {/* Citizen Number — the big reveal */}
          <div className="relative bg-white/5 border border-white/10 px-4 py-5 mb-5">
            <p className="text-[10px] tracking-[0.3em] text-white/30 uppercase font-mono mb-1">
              {t('citizen.number')}
            </p>
            <p className="text-4xl font-black tracking-wider text-gold-500 font-mono tabular-nums">
              {padNumber(citizenNumber)}
            </p>
          </div>

          {/* Name & wallet */}
          <div className="relative space-y-3">
            <div>
              <p className="text-[10px] tracking-[0.3em] text-white/30 uppercase font-mono">
                {displayName || username || walletShort}
              </p>
              {(displayName || username) && (
                <p className="text-[9px] text-white/20 font-mono mt-0.5">{walletShort}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] text-white/20 font-mono uppercase">
                  {t('citizen.memberSince')}
                </p>
                <p className="text-xs text-white/50 font-mono">{formatDate()}</p>
              </div>

              {/* Gold accent line */}
              <div className="h-px flex-1 mx-4 bg-gradient-to-r from-transparent via-gold-500/40 to-transparent" />

              <div className="text-right">
                <p className="text-[9px] text-white/20 font-mono uppercase">SOLANA</p>
                <p className="text-xs text-white/50 font-mono">BLOCKCHAIN</p>
              </div>
            </div>
          </div>

          {/* Bottom gold stripe */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-gold-500/0 via-gold-500 to-gold-500/0" />
        </div>
      </div>

      {/* ── ACTIONS ───────────────────────────────────── */}
      <div className="flex gap-3 max-w-sm mx-auto">
        <button
          onClick={handleShare}
          disabled={sharing}
          className="flex-1 btn-primary text-sm disabled:opacity-50"
        >
          {sharing ? '...' : t('citizen.share')}
        </button>
      </div>

      {/* Fun stat */}
      <p className="text-center text-white/20 text-xs font-mono">
        {t('citizen.totalCitizens', { count: citizenNumber })}
      </p>
    </div>
  );
}
