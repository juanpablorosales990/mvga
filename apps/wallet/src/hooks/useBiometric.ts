import { useState, useEffect, useCallback } from 'react';

const BIOMETRIC_KEY = 'mvga-biometric-credential';
const BIOMETRIC_ENABLED_KEY = 'mvga-biometric-enabled';
const ENCRYPTED_PW_KEY = 'mvga-biometric-pw';

interface StoredCredential {
  credentialId: string;
}

/**
 * WebAuthn biometric authentication hook.
 * Uses platform authenticators (Face ID, Touch ID, Windows Hello, Android biometrics).
 *
 * Flow:
 * 1. User enables biometric in Settings (registers a credential)
 * 2. On LockScreen, user taps "Unlock with biometric" (asserts the credential)
 * 3. If assertion succeeds, we decrypt and return the stored password
 *
 * Security: The password is encrypted with AES-GCM using a key derived from a
 * random secret, then stored in localStorage. The secret is stored in the
 * WebAuthn credential's userHandle, which requires biometric verification to access.
 * This avoids storing the raw password in userHandle (which the spec warns against).
 */
export function useBiometric() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkAvailability().then(setIsAvailable);
    setIsEnabled(localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true');
  }, []);

  const register = useCallback(
    async (password: string): Promise<boolean> => {
      if (!isAvailable) return false;
      setIsLoading(true);

      try {
        // Generate a random secret to encrypt the password
        const secret = crypto.getRandomValues(new Uint8Array(32));

        // Encrypt the password with the secret
        const encryptedPw = await encryptPassword(password, secret);

        const challenge = crypto.getRandomValues(new Uint8Array(32));

        const credential = (await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: {
              name: 'MVGA Wallet',
              id: window.location.hostname,
            },
            user: {
              // Store the encryption secret in userHandle (non-sensitive random bytes)
              id: secret,
              name: 'mvga-wallet-user',
              displayName: 'MVGA Wallet',
            },
            pubKeyCredParams: [
              { type: 'public-key', alg: -7 }, // ES256
              { type: 'public-key', alg: -257 }, // RS256
            ],
            authenticatorSelection: {
              authenticatorAttachment: 'platform',
              userVerification: 'required',
              residentKey: 'required',
              requireResidentKey: true,
            },
            timeout: 60000,
          },
        })) as PublicKeyCredential | null;

        if (!credential) return false;

        // Store credential ID for future assertions
        const stored: StoredCredential = {
          credentialId: bufferToBase64(credential.rawId),
        };

        localStorage.setItem(BIOMETRIC_KEY, JSON.stringify(stored));
        localStorage.setItem(ENCRYPTED_PW_KEY, encryptedPw);
        localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
        setIsEnabled(true);

        return true;
      } catch (error) {
        console.error('Biometric registration failed:', error);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [isAvailable]
  );

  const authenticate = useCallback(async (): Promise<string | null> => {
    if (!isEnabled) return null;
    setIsLoading(true);

    try {
      const storedStr = localStorage.getItem(BIOMETRIC_KEY);
      const encryptedPw = localStorage.getItem(ENCRYPTED_PW_KEY);
      if (!storedStr || !encryptedPw) return null;

      const stored: StoredCredential = JSON.parse(storedStr);
      const challenge = crypto.getRandomValues(new Uint8Array(32));

      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [
            {
              type: 'public-key',
              id: base64ToBuffer(stored.credentialId),
              transports: ['internal'],
            },
          ],
          userVerification: 'required',
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;

      if (!assertion) return null;

      const response = assertion.response as AuthenticatorAssertionResponse;

      // The userHandle contains the encryption secret
      if (response.userHandle) {
        const secret = new Uint8Array(response.userHandle);
        return await decryptPassword(encryptedPw, secret);
      }

      return null;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled]);

  const disable = useCallback(() => {
    localStorage.removeItem(BIOMETRIC_KEY);
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    localStorage.removeItem(ENCRYPTED_PW_KEY);
    // Note: The WebAuthn credential remains on the platform authenticator.
    // The spec does not provide a way to delete it programmatically.
    // The encrypted password in localStorage is removed, so even if the
    // credential is triggered, the decryption target no longer exists.
    setIsEnabled(false);
  }, []);

  return {
    isAvailable,
    isEnabled,
    isLoading,
    register,
    authenticate,
    disable,
  };
}

async function checkAvailability(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!window.PublicKeyCredential) return false;

  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function encryptPassword(password: string, secret: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', secret.buffer as ArrayBuffer, 'AES-GCM', false, [
    'encrypt',
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(password);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  // Store as iv:ciphertext in base64
  return bufferToBase64(iv.buffer as ArrayBuffer) + ':' + bufferToBase64(ciphertext);
}

async function decryptPassword(encrypted: string, secret: Uint8Array): Promise<string | null> {
  try {
    const [ivB64, ctB64] = encrypted.split(':');
    const iv = new Uint8Array(base64ToBuffer(ivB64));
    const ciphertext = base64ToBuffer(ctB64);
    const key = await crypto.subtle.importKey(
      'raw',
      secret.buffer as ArrayBuffer,
      'AES-GCM',
      false,
      ['decrypt']
    );
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}
