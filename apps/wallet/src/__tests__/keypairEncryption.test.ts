import { describe, it, expect } from 'vitest';
import { encryptKeypair, decryptKeypair, encryptData, decryptData } from '../lib/keypairEncryption';

// Helper: compare Uint8Arrays by value (avoids cross-realm constructor mismatch in jsdom)
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

describe('keypairEncryption', () => {
  const password = 'test-password-123!';
  const secretKey = new Uint8Array(64).fill(42);

  describe('encryptKeypair / decryptKeypair', () => {
    it('encrypts and decrypts a secret key round-trip', async () => {
      const encrypted = await encryptKeypair(secretKey, password);
      const decrypted = await decryptKeypair(encrypted, password);
      expect(bytesEqual(decrypted, secretKey)).toBe(true);
    });

    it('returns base64 strings for salt, iv, ciphertext', async () => {
      const encrypted = await encryptKeypair(secretKey, password);
      expect(typeof encrypted.salt).toBe('string');
      expect(typeof encrypted.iv).toBe('string');
      expect(typeof encrypted.ciphertext).toBe('string');
      // Base64 shouldn't contain raw binary
      expect(encrypted.salt.length).toBeGreaterThan(0);
      expect(encrypted.iv.length).toBeGreaterThan(0);
      expect(encrypted.ciphertext.length).toBeGreaterThan(0);
    });

    it('produces different ciphertext each time (random salt/iv)', async () => {
      const enc1 = await encryptKeypair(secretKey, password);
      const enc2 = await encryptKeypair(secretKey, password);
      expect(enc1.salt).not.toBe(enc2.salt);
      expect(enc1.iv).not.toBe(enc2.iv);
      expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
    });

    it('fails to decrypt with wrong password', async () => {
      const encrypted = await encryptKeypair(secretKey, password);
      await expect(decryptKeypair(encrypted, 'wrong-password')).rejects.toThrow();
    });

    it('fails to decrypt with tampered ciphertext', async () => {
      const encrypted = await encryptKeypair(secretKey, password);
      const tampered = { ...encrypted, ciphertext: encrypted.ciphertext.slice(0, -4) + 'AAAA' };
      await expect(decryptKeypair(tampered, password)).rejects.toThrow();
    });

    it('handles empty password', async () => {
      const encrypted = await encryptKeypair(secretKey, '');
      const decrypted = await decryptKeypair(encrypted, '');
      expect(bytesEqual(decrypted, secretKey)).toBe(true);
    });

    it('handles various key sizes', async () => {
      const smallKey = new Uint8Array(32).fill(1);
      const encrypted = await encryptKeypair(smallKey, password);
      const decrypted = await decryptKeypair(encrypted, password);
      expect(bytesEqual(decrypted, smallKey)).toBe(true);
    });
  });

  describe('encryptData / decryptData', () => {
    const data = new TextEncoder().encode('hello mnemonic phrase');
    const saltBase64 = btoa(String.fromCharCode(...new Uint8Array(16).fill(99)));

    it('encrypts and decrypts arbitrary data round-trip', async () => {
      const encrypted = await encryptData(data, password, saltBase64);
      const decrypted = await decryptData(encrypted.ciphertext, encrypted.iv, saltBase64, password);
      expect(bytesEqual(decrypted, data)).toBe(true);
    });

    it('produces different iv each time (same salt)', async () => {
      const enc1 = await encryptData(data, password, saltBase64);
      const enc2 = await encryptData(data, password, saltBase64);
      expect(enc1.iv).not.toBe(enc2.iv);
    });

    it('fails to decrypt with wrong password', async () => {
      const encrypted = await encryptData(data, password, saltBase64);
      await expect(
        decryptData(encrypted.ciphertext, encrypted.iv, saltBase64, 'wrong')
      ).rejects.toThrow();
    });

    it('fails to decrypt with wrong salt', async () => {
      const wrongSalt = btoa(String.fromCharCode(...new Uint8Array(16).fill(0)));
      const encrypted = await encryptData(data, password, saltBase64);
      await expect(
        decryptData(encrypted.ciphertext, encrypted.iv, wrongSalt, password)
      ).rejects.toThrow();
    });

    it('round-trips UTF-8 encoded text correctly', async () => {
      const utf8Data = new TextEncoder().encode('venezuelan bolívar — 🇻🇪');
      const encrypted = await encryptData(utf8Data, password, saltBase64);
      const decrypted = await decryptData(encrypted.ciphertext, encrypted.iv, saltBase64, password);
      const text = new TextDecoder().decode(decrypted);
      expect(text).toBe('venezuelan bolívar — 🇻🇪');
    });
  });
});
