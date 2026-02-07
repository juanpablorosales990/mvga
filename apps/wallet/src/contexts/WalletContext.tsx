import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { Keypair, PublicKey, Transaction, VersionedTransaction, Connection } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { encryptKeypair, decryptKeypair, type EncryptedKeypair } from '../lib/keypairEncryption';
import { useWalletStore } from '../stores/walletStore';

export type WalletState = 'NO_WALLET' | 'LOCKED' | 'UNLOCKED';

interface WalletContextValue {
  // State
  walletState: WalletState;
  connected: boolean;
  publicKey: PublicKey | null;
  keypair: Keypair | null;

  // Wallet lifecycle
  createWallet: (password: string) => Promise<string>; // returns base58 secret key for backup
  importWallet: (secretKeyBase58: string, password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  lock: () => void;
  deleteWallet: () => void;
  exportSecretKey: (password: string) => Promise<string>;

  // Transaction signing (drop-in for wallet adapter)
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  sendTransaction: (
    tx: Transaction | VersionedTransaction,
    connection: Connection
  ) => Promise<string>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const STORAGE_KEY = 'mvga-encrypted-keypair';
const AUTO_LOCK_MS = 15 * 60 * 1000; // 15 minutes

export function SelfCustodyWalletProvider({ children }: { children: ReactNode }) {
  const [walletState, setWalletState] = useState<WalletState>('NO_WALLET');
  const [keypair, setKeypair] = useState<Keypair | null>(null);
  const lastActivityRef = useRef(Date.now());
  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const storeSetPublicKey = useWalletStore((s) => s.setPublicKey);
  const storeSetConnected = useWalletStore((s) => s.setConnected);
  const storeDisconnect = useWalletStore((s) => s.disconnect);

  // Check for existing encrypted keypair on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setWalletState('LOCKED');
    } else {
      setWalletState('NO_WALLET');
    }
  }, []);

  // Auto-lock timer
  useEffect(() => {
    if (walletState !== 'UNLOCKED') return;

    const resetActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('click', resetActivity);
    window.addEventListener('keydown', resetActivity);
    window.addEventListener('touchstart', resetActivity);

    lockTimerRef.current = setInterval(() => {
      if (Date.now() - lastActivityRef.current > AUTO_LOCK_MS) {
        lock();
      }
    }, 30000);

    return () => {
      window.removeEventListener('click', resetActivity);
      window.removeEventListener('keydown', resetActivity);
      window.removeEventListener('touchstart', resetActivity);
      if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    };
  }, [walletState]);

  const createWallet = useCallback(
    async (password: string): Promise<string> => {
      const kp = Keypair.generate();
      const encrypted = await encryptKeypair(kp.secretKey, password);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(encrypted));

      setKeypair(kp);
      setWalletState('UNLOCKED');
      storeSetPublicKey(kp.publicKey.toBase58());
      storeSetConnected(true);

      return bs58.encode(kp.secretKey);
    },
    [storeSetPublicKey, storeSetConnected]
  );

  const importWallet = useCallback(
    async (secretKeyBase58: string, password: string): Promise<void> => {
      const secretKey = bs58.decode(secretKeyBase58);
      if (secretKey.length !== 64) throw new Error('Invalid secret key length');

      const kp = Keypair.fromSecretKey(secretKey);
      const encrypted = await encryptKeypair(kp.secretKey, password);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(encrypted));

      setKeypair(kp);
      setWalletState('UNLOCKED');
      storeSetPublicKey(kp.publicKey.toBase58());
      storeSetConnected(true);
    },
    [storeSetPublicKey, storeSetConnected]
  );

  const unlock = useCallback(
    async (password: string): Promise<void> => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) throw new Error('No wallet found');

      const encrypted: EncryptedKeypair = JSON.parse(stored);
      const secretKey = await decryptKeypair(encrypted, password);
      const kp = Keypair.fromSecretKey(secretKey);

      setKeypair(kp);
      setWalletState('UNLOCKED');
      lastActivityRef.current = Date.now();
      storeSetPublicKey(kp.publicKey.toBase58());
      storeSetConnected(true);
    },
    [storeSetPublicKey, storeSetConnected]
  );

  const lock = useCallback(() => {
    setKeypair(null);
    setWalletState('LOCKED');
    storeSetConnected(false);
    if (lockTimerRef.current) clearInterval(lockTimerRef.current);
  }, [storeSetConnected]);

  const deleteWallet = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setKeypair(null);
    setWalletState('NO_WALLET');
    storeDisconnect();
  }, [storeDisconnect]);

  const exportSecretKey = useCallback(async (password: string): Promise<string> => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) throw new Error('No wallet found');

    const encrypted: EncryptedKeypair = JSON.parse(stored);
    const secretKey = await decryptKeypair(encrypted, password);
    return bs58.encode(secretKey);
  }, []);

  const signMessage = useCallback(
    async (message: Uint8Array): Promise<Uint8Array> => {
      if (!keypair) throw new Error('Wallet is locked');
      return nacl.sign.detached(message, keypair.secretKey);
    },
    [keypair]
  );

  const signTransaction = useCallback(
    async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
      if (!keypair) throw new Error('Wallet is locked');

      if (tx instanceof VersionedTransaction) {
        tx.sign([keypair]);
      } else {
        tx.sign(keypair);
      }
      return tx;
    },
    [keypair]
  );

  const sendTransaction = useCallback(
    async (tx: Transaction | VersionedTransaction, connection: Connection): Promise<string> => {
      if (!keypair) throw new Error('Wallet is locked');

      if (tx instanceof VersionedTransaction) {
        tx.sign([keypair]);
        const rawTx = tx.serialize();
        return connection.sendRawTransaction(rawTx, { skipPreflight: false });
      } else {
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = tx.recentBlockhash || blockhash;
        tx.feePayer = tx.feePayer || keypair.publicKey;
        tx.sign(keypair);
        const rawTx = tx.serialize();
        return connection.sendRawTransaction(rawTx, { skipPreflight: false });
      }
    },
    [keypair]
  );

  const connected = walletState === 'UNLOCKED' && !!keypair;
  const publicKey = keypair?.publicKey ?? null;

  return (
    <WalletContext.Provider
      value={{
        walletState,
        connected,
        publicKey,
        keypair,
        createWallet,
        importWallet,
        unlock,
        lock,
        deleteWallet,
        exportSecretKey,
        signMessage,
        signTransaction,
        sendTransaction,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useSelfCustodyWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useSelfCustodyWallet must be used within SelfCustodyWalletProvider');
  return ctx;
}
