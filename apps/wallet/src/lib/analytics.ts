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
  VES_ONRAMP_STARTED: 'ves_onramp_started',
  VES_ONRAMP_COMPLETED: 'ves_onramp_completed',
  SUPPORT_CHAT_OPENED: 'support_chat_opened',
  SUPPORT_ESCALATED: 'support_escalated',
  // Social payments (Phase 1)
  USERNAME_LOOKUP: 'username_lookup',
  CITIZEN_LOOKUP: 'citizen_lookup',
  SEND_TO_USERNAME: 'send_to_username',
  CONTACTS_SYNCED: 'contacts_synced',
  // Social payments (Phase 2)
  REQUEST_SENT: 'request_sent',
  REQUEST_PAID: 'request_paid',
  REQUEST_DECLINED: 'request_declined',
  REQUEST_PAGE_VIEWED: 'request_page_viewed',
  INBOX_VIEWED: 'inbox_viewed',
  // Social payments (Phase 3 — Splits)
  SPLIT_CREATED: 'split_created',
  SPLIT_VIEWED: 'split_viewed',
  SPLIT_CANCELLED: 'split_cancelled',
  // Transaction receipts
  RECEIPT_SHARED: 'receipt_shared',
  RECEIPT_DOWNLOADED: 'receipt_downloaded',
  // VES Off-Ramp
  VES_OFFRAMP_STARTED: 'ves_offramp_started',
  VES_OFFRAMP_COMPLETED: 'ves_offramp_completed',
  // Onboarding wizard
  WIZARD_COMPLETED: 'wizard_completed',
  WIZARD_SKIPPED: 'wizard_skipped',
  // Cross-chain bridge
  BRIDGE_TRON_OPENED: 'bridge_tron_opened',
  // Payment links
  PAYMENT_LINK_CREATED: 'payment_link_created',
  PAYMENT_LINK_CANCELLED: 'payment_link_cancelled',
  // Remittance
  REMITTANCE_STARTED: 'remittance_started',
  REMITTANCE_METHOD_SELECTED: 'remittance_method_selected',
  // Merchant
  MERCHANT_STORE_CREATED: 'merchant_store_created',
  MERCHANT_PRODUCT_ADDED: 'merchant_product_added',
  MERCHANT_CHECKOUT_CREATED: 'merchant_checkout_created',
  MERCHANT_ORDER_PAID: 'merchant_order_paid',
  MERCHANT_QR_SHARED: 'merchant_qr_shared',
  MERCHANT_INVOICE_CREATED: 'merchant_invoice_created',
  MERCHANT_INVOICE_SENT: 'merchant_invoice_sent',
  MERCHANT_STOREFRONT_VIEWED: 'merchant_storefront_viewed',
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
