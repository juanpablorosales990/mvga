/**
 * Keypair encryption using Web Crypto API (PBKDF2 + AES-256-GCM).
 * No external dependencies — uses browser-native crypto only.
 */

export interface EncryptedKeypair {
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptKeypair(
  secretKey: Uint8Array,
  password: string
): Promise<EncryptedKeypair> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    secretKey as BufferSource
  );

  return {
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptKeypair(
  encrypted: EncryptedKeypair,
  password: string
): Promise<Uint8Array> {
  const salt = fromBase64(encrypted.salt);
  const iv = fromBase64(encrypted.iv);
  const ciphertext = fromBase64(encrypted.ciphertext);
  const key = await deriveKey(password, salt);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource
  );

  return new Uint8Array(plaintext);
}

/**
 * Encrypt arbitrary data using a pre-existing salt (for V2 multi-field storage).
 * Returns { iv, ciphertext } as base64 strings. Caller must store the salt separately.
 */
export async function encryptData(
  data: Uint8Array,
  password: string,
  saltBase64: string
): Promise<{ iv: string; ciphertext: string }> {
  const salt = fromBase64(saltBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    data as BufferSource
  );

  return {
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ct)),
  };
}

/**
 * Decrypt data encrypted with encryptData, given iv/ciphertext/salt as base64.
 */
export async function decryptData(
  ciphertextBase64: string,
  ivBase64: string,
  saltBase64: string,
  password: string
): Promise<Uint8Array> {
  const salt = fromBase64(saltBase64);
  const iv = fromBase64(ivBase64);
  const ciphertext = fromBase64(ciphertextBase64);
  const key = await deriveKey(password, salt);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource
  );

  return new Uint8Array(plaintext);
}
