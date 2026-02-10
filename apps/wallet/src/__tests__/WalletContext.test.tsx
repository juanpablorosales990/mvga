import { describe, it, expect, beforeEach } from 'vitest';
import { Keypair } from '@solana/web3.js';
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

// Test the wallet lifecycle logic that WalletContext orchestrates, without React.
// We exercise the same encrypt/decrypt/derive flows the context uses.

const STORAGE_KEY = 'mvga-encrypted-keypair';
const PASSWORD = 'test-password-123';

interface EncryptedWalletV2 {
  version: 2;
  salt: string;
  keypair_iv: string;
  keypair_ct: string;
  mnemonic_iv: string;
  mnemonic_ct: string;
  derivationPath: string;
  createdVia: 'mnemonic';
}

function isV2(data: unknown): data is EncryptedWalletV2 {
  return (
    typeof data === 'object' && data !== null && (data as Record<string, unknown>).version === 2
  );
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

describe('WalletContext - createWallet flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a mnemonic, derives a keypair, and encrypts V2 data', async () => {
    const mnemonic = createMnemonic();
    const words = mnemonic.split(' ');
    expect(words).toHaveLength(12);

    const kp = deriveKeypairFromMnemonic(mnemonic, 0);
    expect(kp.publicKey.toBase58()).toBeTruthy();

    const {
      salt,
      iv: keypairIv,
      ciphertext: keypairCt,
    } = await encryptKeypair(kp.secretKey, PASSWORD);
    const { iv: mnemonicIv, ciphertext: mnemonicCt } = await encryptData(
      new TextEncoder().encode(mnemonic),
      PASSWORD,
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

    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(raw.version).toBe(2);
    expect(raw.salt).toBeDefined();
    expect(raw.keypair_ct).toBeDefined();
    expect(raw.mnemonic_ct).toBeDefined();
    expect(raw.createdVia).toBe('mnemonic');
  });
});

describe('WalletContext - unlock flow', () => {
  let originalKeypair: Keypair;
  let originalMnemonic: string;

  beforeEach(async () => {
    localStorage.clear();

    originalMnemonic = createMnemonic();
    originalKeypair = deriveKeypairFromMnemonic(originalMnemonic, 0);

    const {
      salt,
      iv: keypairIv,
      ciphertext: keypairCt,
    } = await encryptKeypair(originalKeypair.secretKey, PASSWORD);
    const { iv: mnemonicIv, ciphertext: mnemonicCt } = await encryptData(
      new TextEncoder().encode(originalMnemonic),
      PASSWORD,
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
  });

  it('unlocks with correct password and recovers keypair', async () => {
    const raw = localStorage.getItem(STORAGE_KEY)!;
    const data = JSON.parse(raw);
    expect(isV2(data)).toBe(true);

    const secretKey = await decryptData(data.keypair_ct, data.keypair_iv, data.salt, PASSWORD);
    const kp = Keypair.fromSecretKey(secretKey);
    expect(kp.publicKey.toBase58()).toBe(originalKeypair.publicKey.toBase58());
  });

  it('fails to unlock with wrong password', async () => {
    const raw = localStorage.getItem(STORAGE_KEY)!;
    const data = JSON.parse(raw);

    await expect(
      decryptData(data.keypair_ct, data.keypair_iv, data.salt, 'wrong-password')
    ).rejects.toThrow();
  });
});

describe('WalletContext - mnemonic validation', () => {
  it('rejects invalid mnemonic', () => {
    expect(isValidMnemonic('invalid mnemonic phrase that is not bip39')).toBe(false);
  });
});

describe('WalletContext - exportMnemonic flow', () => {
  it('exports mnemonic from V2 storage', async () => {
    localStorage.clear();

    const mnemonic = createMnemonic();
    const kp = deriveKeypairFromMnemonic(mnemonic, 0);

    const {
      salt,
      iv: keypairIv,
      ciphertext: keypairCt,
    } = await encryptKeypair(kp.secretKey, PASSWORD);
    const { iv: mnemonicIv, ciphertext: mnemonicCt } = await encryptData(
      new TextEncoder().encode(mnemonic),
      PASSWORD,
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

    // Simulate exportMnemonic
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    if (isV2(data) && data.mnemonic_ct) {
      const mnemonicBytes = await decryptData(
        data.mnemonic_ct,
        data.mnemonic_iv,
        data.salt,
        PASSWORD
      );
      const words = new TextDecoder().decode(mnemonicBytes).split(' ');
      expect(words).toEqual(mnemonic.split(' '));
    } else {
      throw new Error('Expected V2 data');
    }
  });

  it('returns null when mnemonic_ct is empty', async () => {
    localStorage.clear();

    const kp = Keypair.generate();
    const {
      salt,
      iv: keypairIv,
      ciphertext: keypairCt,
    } = await encryptKeypair(kp.secretKey, PASSWORD);

    const stored: EncryptedWalletV2 = {
      version: 2,
      salt,
      keypair_iv: keypairIv,
      keypair_ct: keypairCt,
      mnemonic_iv: '',
      mnemonic_ct: '',
      derivationPath: '',
      createdVia: 'mnemonic',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const data = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    if (isV2(data) && data.mnemonic_ct) {
      throw new Error('Should not have mnemonic');
    } else {
      expect(data.mnemonic_ct).toBe('');
    }
  });
});

describe('WalletContext - exportSecretKey flow', () => {
  it('exports secret key as base58', async () => {
    localStorage.clear();

    const kp = Keypair.generate();
    const {
      salt,
      iv: keypairIv,
      ciphertext: keypairCt,
    } = await encryptKeypair(kp.secretKey, PASSWORD);

    const stored: EncryptedWalletV2 = {
      version: 2,
      salt,
      keypair_iv: keypairIv,
      keypair_ct: keypairCt,
      mnemonic_iv: '',
      mnemonic_ct: '',
      derivationPath: '',
      createdVia: 'mnemonic',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    // Simulate exportSecretKey
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    const secretKey = await decryptData(data.keypair_ct, data.keypair_iv, data.salt, PASSWORD);
    const exported = bs58.encode(secretKey);

    expect(exported).toBe(bs58.encode(kp.secretKey));
  });
});

describe('WalletContext - signMessage flow', () => {
  it('signs a message with ed25519', () => {
    const kp = Keypair.generate();
    const message = new Uint8Array(new TextEncoder().encode('hello MVGA'));
    const secretKey = new Uint8Array(kp.secretKey);
    const sig = nacl.sign.detached(message, secretKey);

    expect(sig.length).toBe(64);
    expect(nacl.sign.detached.verify(message, sig, new Uint8Array(kp.publicKey.toBytes()))).toBe(
      true
    );
  });

  it('different messages produce different signatures', () => {
    const kp = Keypair.generate();
    const secretKey = new Uint8Array(kp.secretKey);
    const sig1 = nacl.sign.detached(new Uint8Array(new TextEncoder().encode('msg1')), secretKey);
    const sig2 = nacl.sign.detached(new Uint8Array(new TextEncoder().encode('msg2')), secretKey);
    expect(bytesEqual(sig1, sig2)).toBe(false);
  });
});

describe('WalletContext - deleteWallet flow', () => {
  it('clears localStorage', async () => {
    localStorage.clear();

    const kp = Keypair.generate();
    const { salt, iv, ciphertext } = await encryptKeypair(kp.secretKey, PASSWORD);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ salt, iv, ct: ciphertext }));

    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    // Simulate deleteWallet
    localStorage.removeItem(STORAGE_KEY);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('WalletContext - V1 backward compatibility', () => {
  it('unlocks V1 (legacy EncryptedKeypair) format', async () => {
    localStorage.clear();

    const kp = Keypair.generate();
    const encrypted = await encryptKeypair(kp.secretKey, PASSWORD);

    // V1 format: just the EncryptedKeypair directly (no version field)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(encrypted));

    const data = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(isV2(data)).toBe(false);

    // Decrypt using V1 path
    const secretKey = await decryptKeypair(data as EncryptedKeypair, PASSWORD);
    const recovered = Keypair.fromSecretKey(secretKey);
    expect(recovered.publicKey.toBase58()).toBe(kp.publicKey.toBase58());
  });
});
