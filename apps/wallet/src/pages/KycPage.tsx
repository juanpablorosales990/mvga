import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useKyc } from '../hooks/useKyc';

/**
 * Load the Sumsub WebSDK script dynamically.
 * Returns a promise that resolves when the script is loaded.
 */
function loadSumsubScript(): Promise<void> {
  if (document.getElementById('sumsub-websdk-script')) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'sumsub-websdk-script';
    script.src = 'https://static.sumsub.com/idensic/static/sns-websdk-builder.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Sumsub WebSDK'));
    document.head.appendChild(script);
  });
}

/**
 * SumsubWebSdk — mounts the Sumsub verification widget.
 * Uses the vanilla JS SDK loaded via script tag (no npm dependency needed).
 */
function SumsubWebSdk({
  accessToken,
  onRefreshToken,
  onComplete,
  onError,
}: {
  accessToken: string;
  onRefreshToken: () => Promise<string>;
  onComplete: () => void;
  onError: (msg: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sdkRef = useRef<unknown>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await loadSumsubScript();
        if (!mounted || !containerRef.current) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const snsWebSdkBuilder = (window as any).snsWebSdk;
        if (!snsWebSdkBuilder) {
          onError('Sumsub SDK failed to initialize');
          return;
        }

        const sdk = snsWebSdkBuilder
          .init(accessToken, onRefreshToken)
          .withConf({ lang: document.documentElement.lang || 'en' })
          .withOptions({ addViewportTag: false, adaptIframeHeight: true })
          .on('idCheck.onStepCompleted', () => {
            // Step completed — verification is in progress
          })
          .on('idCheck.onApplicantStatusChanged', () => {
            onComplete();
          })
          .on('idCheck.onError', (error: unknown) => {
            onError(String(error));
          })
          .build();

        sdk.launch('#sumsub-container');
        sdkRef.current = sdk;
      } catch (err) {
        if (mounted) onError(err instanceof Error ? err.message : 'SDK load failed');
      }
    }

    init();

    return () => {
      mounted = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (sdkRef.current && typeof (sdkRef.current as any).destroy === 'function') {
        (sdkRef.current as any).destroy();
      }
    };
  }, [accessToken, onRefreshToken, onComplete, onError]);

  return (
    <div
      ref={containerRef}
      id="sumsub-container"
      className="min-h-[400px] bg-white/5 border border-white/10"
    />
  );
}

export default function KycPage() {
  const { t } = useTranslation();
  const { status, loading, rejectionReason, createSession, refresh } = useKyc();
  const [sdkToken, setSdkToken] = useState<string | null>(null);
  const [sdkError, setSdkError] = useState<string | null>(null);

  const handleStart = async () => {
    setSdkError(null);
    const session = await createSession();
    if (session?.mock) {
      // Mock mode — auto-approved, just refresh
      refresh();
      return;
    }
    if (session?.token) {
      setSdkToken(session.token);
    }
  };

  const handleSdkComplete = useCallback(() => {
    setSdkToken(null);
    refresh();
  }, [refresh]);

  const handleRefreshToken = useCallback(async (): Promise<string> => {
    const session = await createSession();
    return session?.token ?? '';
  }, [createSession]);

  const handleSdkError = useCallback((msg: string) => {
    setSdkError(msg);
    setSdkToken(null);
  }, []);

  // Auto-dismiss SDK on status change to APPROVED
  useEffect(() => {
    if (status === 'APPROVED' || status === 'REJECTED') {
      setSdkToken(null);
    }
  }, [status]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/"
          className="text-xs text-white/30 font-mono uppercase tracking-wider hover:text-white/50 transition"
        >
          ← {t('common.back')}
        </Link>
      </div>

      <h1 className="text-2xl font-bold uppercase tracking-tight">{t('kyc.title')}</h1>
      <p className="text-sm text-white/40">{t('kyc.subtitle')}</p>

      {sdkError && (
        <div className="bg-red-900/20 border border-red-500/30 px-4 py-3">
          <p className="text-red-400 text-xs">{sdkError}</p>
        </div>
      )}

      {/* Sumsub WebSDK mounted here when token is available */}
      {sdkToken && (
        <SumsubWebSdk
          accessToken={sdkToken}
          onRefreshToken={handleRefreshToken}
          onComplete={handleSdkComplete}
          onError={handleSdkError}
        />
      )}

      {/* UNVERIFIED */}
      {status === 'UNVERIFIED' && !sdkToken && (
        <div className="card space-y-4">
          <div className="w-16 h-16 border border-gold-500/30 flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-gold-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <p className="text-center text-sm text-white/50">{t('kyc.verifyDesc')}</p>
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full bg-gold-500 text-black font-bold text-sm uppercase tracking-wider py-3 hover:bg-gold-400 transition disabled:opacity-50"
          >
            {loading ? '...' : t('kyc.startVerification')}
          </button>
        </div>
      )}

      {/* PENDING */}
      {status === 'PENDING' && !sdkToken && (
        <div className="card text-center space-y-4">
          <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="text-lg font-bold">{t('kyc.pending')}</h3>
          <p className="text-sm text-white/40">{t('kyc.pendingDesc')}</p>
        </div>
      )}

      {/* APPROVED */}
      {status === 'APPROVED' && (
        <div className="card text-center space-y-4">
          <div className="w-16 h-16 border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-emerald-400">{t('kyc.approved')}</h3>
          <p className="text-sm text-white/40">{t('kyc.approvedDesc')}</p>
        </div>
      )}

      {/* REJECTED */}
      {status === 'REJECTED' && !sdkToken && (
        <div className="card space-y-4">
          <div className="w-16 h-16 border border-red-500/30 bg-red-500/10 flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-red-400 text-center">{t('kyc.rejected')}</h3>
          {rejectionReason && (
            <p className="text-sm text-white/40 text-center">
              {t('kyc.rejectedReason', { reason: rejectionReason })}
            </p>
          )}
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full border border-white/20 text-white font-bold text-sm uppercase tracking-wider py-3 hover:border-white/40 transition disabled:opacity-50"
          >
            {loading ? '...' : t('kyc.tryAgain')}
          </button>
        </div>
      )}

      {/* EXPIRED */}
      {status === 'EXPIRED' && !sdkToken && (
        <div className="card space-y-4 text-center">
          <h3 className="text-lg font-bold text-yellow-400">{t('kyc.title')}</h3>
          <p className="text-sm text-white/40">{t('kyc.verifyDesc')}</p>
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full bg-gold-500 text-black font-bold text-sm uppercase tracking-wider py-3 hover:bg-gold-400 transition disabled:opacity-50"
          >
            {loading ? '...' : t('kyc.startVerification')}
          </button>
        </div>
      )}
    </div>
  );
}
