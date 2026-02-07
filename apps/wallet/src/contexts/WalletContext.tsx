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
import {
  encryptKeypair,
  decryptKeypair,
  encryptData,
  decryptData,
  type EncryptedKeypair,
} from '../lib/keypairEncryption';
import {
  createMnemonic,
  isValidMnemonic,
  deriveKeypairFromMnemonic,
  getDerivationPath,
} from '../lib/mnemonicDerivation';
import { useWalletStore } from '../stores/walletStore';

export type WalletState = 'NO_WALLET' | 'LOCKED' | 'UNLOCKED';

interface WalletContextValue {
  walletState: WalletState;
  connected: boolean;
  publicKey: PublicKey | null;
  keypair: Keypair | null;
  hasMnemonic: boolean;
  pendingOnboarding: boolean;

  createWallet: (password: string) => Promise<string[]>;
  completeOnboarding: () => void;
  importWallet: (secretKeyBase58: string, password: string) => Promise<void>;
  importFromMnemonic: (words: string[], password: string) => Promise<void>;
  importFromSecretKey: (secretKeyBase58: string, password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  lock: () => void;
  deleteWallet: () => void;
  exportSecretKey: (password: string) => Promise<string>;
  exportMnemonic: (password: string) => Promise<string[] | null>;

  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  sendTransaction: (
    tx: Transaction | VersionedTransaction,
    connection: Connection
  ) => Promise<string>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const STORAGE_KEY = 'mvga-encrypted-keypair';
const AUTO_LOCK_MS = 15 * 60 * 1000;

// V2 storage with mnemonic support
interface EncryptedWalletV2 {
  version: 2;
  salt: string;
  keypair_iv: string;
  keypair_ct: string;
  mnemonic_iv: string;
  mnemonic_ct: string;
  derivationPath: string;
  createdVia: 'mnemonic' | 'import_mnemonic' | 'import_key';
}

function isV2(data: unknown): data is EncryptedWalletV2 {
  return (
    typeof data === 'object' && data !== null && (data as Record<string, unknown>).version === 2
  );
}

export function SelfCustodyWalletProvider({ children }: { children: ReactNode }) {
  const [walletState, setWalletState] = useState<WalletState>('NO_WALLET');
  const [keypair, setKeypair] = useState<Keypair | null>(null);
  const [hasMnemonic, setHasMnemonic] = useState(false);
  const [pendingOnboarding, setPendingOnboarding] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const storeSetPublicKey = useWalletStore((s) => s.setPublicKey);
  const storeSetConnected = useWalletStore((s) => s.setConnected);
  const storeDisconnect = useWalletStore((s) => s.disconnect);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setWalletState(stored ? 'LOCKED' : 'NO_WALLET');
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

  const createWallet = useCallback(async (password: string): Promise<string[]> => {
    const mnemonic = createMnemonic();
    const words = mnemonic.split(' ');
    const kp = deriveKeypairFromMnemonic(mnemonic, 0);

    const {
      salt,
      iv: keypairIv,
      ciphertext: keypairCt,
    } = await encryptKeypair(kp.secretKey, password);
    const { iv: mnemonicIv, ciphertext: mnemonicCt } = await encryptData(
      new TextEncoder().encode(mnemonic),
      password,
      salt
    );

    const stored: EncryptedWalletV2 = {
      version: 2,
      salt,
      keypair_iv: keypairIv,
      keypair_ct: keypairCt,
      mnemonic_iv: mnemonicIv,
      mnemonic_ct: mnemonicCt,
      derivationPath: getDerivationPath(0),
      createdVia: 'mnemonic',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    // Store keypair in memory but keep state as NO_WALLET so
    // OnboardingScreen stays rendered for mnemonic backup display.
    // completeOnboarding() transitions to UNLOCKED after confirmation.
    setKeypair(kp);
    setHasMnemonic(true);
    setPendingOnboarding(true);

    return words;
  }, []);

  const completeOnboarding = useCallback(() => {
    if (keypair) {
      setWalletState('UNLOCKED');
      setPendingOnboarding(false);
      storeSetPublicKey(keypair.publicKey.toBase58());
      storeSetConnected(true);
    }
  }, [keypair, storeSetPublicKey, storeSetConnected]);

  const importFromMnemonic = useCallback(
    async (words: string[], password: string): Promise<void> => {
      const mnemonic = words.join(' ').trim().toLowerCase();
      if (!isValidMnemonic(mnemonic)) {
        throw new Error('Invalid recovery phrase');
      }

      const kp = deriveKeypairFromMnemonic(mnemonic, 0);

      const {
        salt,
        iv: keypairIv,
        ciphertext: keypairCt,
      } = await encryptKeypair(kp.secretKey, password);
      const { iv: mnemonicIv, ciphertext: mnemonicCt } = await encryptData(
        new TextEncoder().encode(mnemonic),
        password,
        salt
      );

      const stored: EncryptedWalletV2 = {
        version: 2,
        salt,
        keypair_iv: keypairIv,
        keypair_ct: keypairCt,
        mnemonic_iv: mnemonicIv,
        mnemonic_ct: mnemonicCt,
        derivationPath: getDerivationPath(0),
        createdVia: 'import_mnemonic',
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

      setKeypair(kp);
      setHasMnemonic(true);
      setWalletState('UNLOCKED');
      storeSetPublicKey(kp.publicKey.toBase58());
      storeSetConnected(true);
    },
    [storeSetPublicKey, storeSetConnected]
  );

  const importFromSecretKey = useCallback(
    async (secretKeyBase58: string, password: string): Promise<void> => {
      const secretKey = bs58.decode(secretKeyBase58);
      if (secretKey.length !== 64) throw new Error('Invalid secret key length');

      const kp = Keypair.fromSecretKey(secretKey);
      const {
        salt,
        iv: keypairIv,
        ciphertext: keypairCt,
      } = await encryptKeypair(kp.secretKey, password);

      const stored: EncryptedWalletV2 = {
        version: 2,
        salt,
        keypair_iv: keypairIv,
        keypair_ct: keypairCt,
        mnemonic_iv: '',
        mnemonic_ct: '',
        derivationPath: '',
        createdVia: 'import_key',
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

      setKeypair(kp);
      setHasMnemonic(false);
      setWalletState('UNLOCKED');
      storeSetPublicKey(kp.publicKey.toBase58());
      storeSetConnected(true);
    },
    [storeSetPublicKey, storeSetConnected]
  );

  const importWallet = importFromSecretKey;

  const unlock = useCallback(
    async (password: string): Promise<void> => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) throw new Error('No wallet found');

      const data = JSON.parse(stored);
      let kp: Keypair;
      let mnemonicFlag = false;

      if (isV2(data)) {
        const secretKey = await decryptData(data.keypair_ct, data.keypair_iv, data.salt, password);
        kp = Keypair.fromSecretKey(secretKey);
        mnemonicFlag = data.createdVia !== 'import_key' && !!data.mnemonic_ct;
      } else {
        const encrypted: EncryptedKeypair = data;
        const secretKey = await decryptKeypair(encrypted, password);
        kp = Keypair.fromSecretKey(secretKey);
      }

      setKeypair(kp);
      setHasMnemonic(mnemonicFlag);
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
    setHasMnemonic(false);
    setWalletState('NO_WALLET');
    storeDisconnect();
  }, [storeDisconnect]);

  const exportSecretKey = useCallback(async (password: string): Promise<string> => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) throw new Error('No wallet found');

    const data = JSON.parse(stored);
    if (isV2(data)) {
      const secretKey = await decryptData(data.keypair_ct, data.keypair_iv, data.salt, password);
      return bs58.encode(secretKey);
    }
    const encrypted: EncryptedKeypair = data;
    const secretKey = await decryptKeypair(encrypted, password);
    return bs58.encode(secretKey);
  }, []);

  const exportMnemonic = useCallback(async (password: string): Promise<string[] | null> => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) throw new Error('No wallet found');

    const data = JSON.parse(stored);
    if (isV2(data) && data.mnemonic_ct) {
      const mnemonicBytes = await decryptData(
        data.mnemonic_ct,
        data.mnemonic_iv,
        data.salt,
        password
      );
      return new TextDecoder().decode(mnemonicBytes).split(' ');
    }
    return null;
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
        return connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
      }
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = tx.recentBlockhash || blockhash;
      tx.feePayer = tx.feePayer || keypair.publicKey;
      tx.sign(keypair);
      return connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
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
        hasMnemonic,
        pendingOnboarding,
        createWallet,
        completeOnboarding,
        importWallet,
        importFromMnemonic,
        importFromSecretKey,
        unlock,
        lock,
        deleteWallet,
        exportSecretKey,
        exportMnemonic,
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
