export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Known escrow wallet address — must match the API's ESCROW_WALLET_KEYPAIR public key.
// Used for client-side validation before sending funds to prevent API compromise attacks.
// Only used in legacy escrow mode.
export const KNOWN_ESCROW_WALLET = import.meta.env.VITE_ESCROW_WALLET || '';

// On-chain escrow program ID
export const ESCROW_PROGRAM_ID =
  import.meta.env.VITE_ESCROW_PROGRAM_ID || '6GXdYCDckUVEFBaQSgfQGX95gZSNN7FWN19vRDSyTJ5E';

// VAPID public key for Web Push subscriptions (safe for client-side use)
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
