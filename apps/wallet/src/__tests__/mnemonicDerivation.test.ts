import { describe, it, expect } from 'vitest';
import {
  createMnemonic,
  isValidMnemonic,
  deriveKeypairFromMnemonic,
  getDerivationPath,
} from '../lib/mnemonicDerivation';

describe('mnemonicDerivation', () => {
  describe('createMnemonic', () => {
    it('generates a 12-word mnemonic', () => {
      const mnemonic = createMnemonic();
      const words = mnemonic.split(' ');
      expect(words).toHaveLength(12);
    });

    it('generates a valid BIP39 mnemonic', () => {
      const mnemonic = createMnemonic();
      expect(isValidMnemonic(mnemonic)).toBe(true);
    });

    it('generates different mnemonics each time', () => {
      const m1 = createMnemonic();
      const m2 = createMnemonic();
      expect(m1).not.toBe(m2);
    });
  });

  describe('isValidMnemonic', () => {
    it('returns true for a valid mnemonic', () => {
      const mnemonic = createMnemonic();
      expect(isValidMnemonic(mnemonic)).toBe(true);
    });

    it('returns false for random words', () => {
      expect(isValidMnemonic('foo bar baz qux hello world one two three four five six')).toBe(
        false
      );
    });

    it('returns false for empty string', () => {
      expect(isValidMnemonic('')).toBe(false);
    });

    it('returns false for wrong word count', () => {
      const mnemonic = createMnemonic();
      const shortMnemonic = mnemonic.split(' ').slice(0, 8).join(' ');
      expect(isValidMnemonic(shortMnemonic)).toBe(false);
    });
  });

  describe('deriveKeypairFromMnemonic', () => {
    // Known test mnemonic — DO NOT use in production
    const testMnemonic = createMnemonic();

    it('derives a valid Solana keypair', () => {
      const kp = deriveKeypairFromMnemonic(testMnemonic);
      expect(kp.publicKey).toBeDefined();
      expect(kp.secretKey).toHaveLength(64);
    });

    it('derives the same keypair from the same mnemonic', () => {
      const kp1 = deriveKeypairFromMnemonic(testMnemonic, 0);
      const kp2 = deriveKeypairFromMnemonic(testMnemonic, 0);
      expect(kp1.publicKey.toBase58()).toBe(kp2.publicKey.toBase58());
    });

    it('derives different keypairs for different account indices', () => {
      const kp0 = deriveKeypairFromMnemonic(testMnemonic, 0);
      const kp1 = deriveKeypairFromMnemonic(testMnemonic, 1);
      expect(kp0.publicKey.toBase58()).not.toBe(kp1.publicKey.toBase58());
    });

    it('derives different keypairs for different mnemonics', () => {
      const otherMnemonic = createMnemonic();
      const kp1 = deriveKeypairFromMnemonic(testMnemonic, 0);
      const kp2 = deriveKeypairFromMnemonic(otherMnemonic, 0);
      expect(kp1.publicKey.toBase58()).not.toBe(kp2.publicKey.toBase58());
    });

    it('defaults to account index 0', () => {
      const kpDefault = deriveKeypairFromMnemonic(testMnemonic);
      const kpExplicit = deriveKeypairFromMnemonic(testMnemonic, 0);
      expect(kpDefault.publicKey.toBase58()).toBe(kpExplicit.publicKey.toBase58());
    });
  });

  describe('getDerivationPath', () => {
    it('returns Phantom-compatible path for index 0', () => {
      expect(getDerivationPath(0)).toBe("m/44'/501'/0'/0'");
    });

    it('returns correct path for other indices', () => {
      expect(getDerivationPath(1)).toBe("m/44'/501'/1'/0'");
      expect(getDerivationPath(5)).toBe("m/44'/501'/5'/0'");
    });

    it('defaults to index 0', () => {
      expect(getDerivationPath()).toBe("m/44'/501'/0'/0'");
    });
  });
});
