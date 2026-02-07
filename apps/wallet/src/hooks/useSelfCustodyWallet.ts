/**
 * Drop-in replacement for `useWallet()` from @solana/wallet-adapter-react.
 * Same interface shape so pages need minimal changes.
 */
export { useSelfCustodyWallet } from '../contexts/WalletContext';
