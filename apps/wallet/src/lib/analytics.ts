import { API_URL } from '../config';

/** All tracked event names — add new events here */
export const AnalyticsEvents = {
  WALLET_CREATED: 'wallet_created',
  BIOMETRIC_ENABLED: 'biometric_enabled',
  PROFILE_SETUP: 'profile_setup',
  SEND_COMPLETED: 'send_completed',
  QR_SCANNED: 'qr_scanned',
  DEPOSIT_STARTED: 'deposit_started',
  P2P_OFFER_CREATED: 'p2p_offer_created',
  KYC_STARTED: 'kyc_started',
  KYC_COMPLETED: 'kyc_completed',
  CARD_ACTIVATED: 'card_activated',
  EXPORT_CSV: 'export_csv',
  EXPORT_PDF: 'export_pdf',
  REFERRAL_LINK_COPIED: 'referral_link_copied',
  REFERRAL_SHARED: 'referral_shared',
  STAKE_COMPLETED: 'stake_completed',
  OFFRAMP_STARTED: 'offramp_started',
  TOPUP_COMPLETED: 'topup_completed',
  GIFTCARD_PURCHASED: 'giftcard_purchased',
  CITIZEN_CARD_SHARED: 'citizen_card_shared',
} as const;

export type AnalyticsEvent = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

type Transport = (event: string, properties?: Record<string, unknown>) => void;

const transports: Transport[] = [];

/** Register an external transport (e.g. PostHog, Amplitude) */
export function registerTransport(fn: Transport) {
  transports.push(fn);
}

/** Fire-and-forget event tracking — never throws, never blocks UI */
export function track(event: AnalyticsEvent, properties?: Record<string, unknown>) {
  // Dev console transport
  if (import.meta.env.DEV) {
    console.debug(`[analytics] ${event}`, properties || '');
  }

  // API transport — fire and forget
  try {
    fetch(`${API_URL}/analytics/event`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, properties }),
    }).catch(() => {});
  } catch {
    // Silently ignore — analytics should never break the app
  }

  // External transports
  for (const transport of transports) {
    try {
      transport(event, properties);
    } catch {
      // Silently ignore
    }
  }
}
