export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Known escrow wallet address — must match the API's ESCROW_WALLET_KEYPAIR public key.
// Used for client-side validation before sending funds to prevent API compromise attacks.
export const KNOWN_ESCROW_WALLET = import.meta.env.VITE_ESCROW_WALLET || '';

// VAPID public key for Web Push subscriptions (safe for client-side use)
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
