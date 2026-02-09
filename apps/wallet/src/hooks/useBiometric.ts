import { useState, useEffect, useCallback } from 'react';
import { isNative } from '../utils/platform';

const BIOMETRIC_KEY = 'mvga-biometric-credential';
const BIOMETRIC_ENABLED_KEY = 'mvga-biometric-enabled';
const ENCRYPTED_PW_KEY = 'mvga-biometric-pw';

interface StoredCredential {
  credentialId: string;
}

/**
 * Biometric authentication hook.
 *
 * Native (iOS/Android): Uses @aparajita/capacitor-biometric-auth for Face ID /
 * Touch ID / fingerprint, with @capacitor/preferences for secure storage.
 *
 * Web: Uses WebAuthn platform authenticators + AES-GCM encryption in localStorage.
 */
export function useBiometric() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isNative) {
      checkNativeAvailability().then(setIsAvailable);
      getNativePreference(BIOMETRIC_ENABLED_KEY).then((v) => setIsEnabled(v === 'true'));
    } else {
      checkWebAvailability().then(setIsAvailable);
      setIsEnabled(localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true');
    }
  }, []);

  const register = useCallback(
    async (password: string): Promise<boolean> => {
      if (!isAvailable) return false;
      setIsLoading(true);

      try {
        if (isNative) {
          return await registerNative(password, setIsEnabled);
        }
        return await registerWeb(password, setIsEnabled);
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
      if (isNative) {
        return await authenticateNative();
      }
      return await authenticateWeb();
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled]);

  const disable = useCallback(async () => {
    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key: ENCRYPTED_PW_KEY });
      await Preferences.remove({ key: BIOMETRIC_ENABLED_KEY });
    } else {
      localStorage.removeItem(BIOMETRIC_KEY);
      localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
      localStorage.removeItem(ENCRYPTED_PW_KEY);
    }
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

// ---------------------------------------------------------------------------
// Native path (Capacitor)
// ---------------------------------------------------------------------------

async function checkNativeAvailability(): Promise<boolean> {
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    const result = await BiometricAuth.checkBiometry();
    return result.isAvailable;
  } catch {
    return false;
  }
}

async function getNativePreference(key: string): Promise<string | null> {
  try {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key });
    return value;
  } catch {
    return null;
  }
}

async function registerNative(
  password: string,
  setIsEnabled: (v: boolean) => void
): Promise<boolean> {
  const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
  const { Preferences } = await import('@capacitor/preferences');

  // Verify biometric first
  await BiometricAuth.authenticate({ reason: 'Enable biometric unlock' });

  // Store password in OS-encrypted Preferences
  await Preferences.set({ key: ENCRYPTED_PW_KEY, value: password });
  await Preferences.set({ key: BIOMETRIC_ENABLED_KEY, value: 'true' });
  setIsEnabled(true);
  return true;
}

async function authenticateNative(): Promise<string | null> {
  const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
  const { Preferences } = await import('@capacitor/preferences');

  const { value: enabled } = await Preferences.get({ key: BIOMETRIC_ENABLED_KEY });
  if (enabled !== 'true') return null;

  // Prompt biometric
  await BiometricAuth.authenticate({ reason: 'Unlock your wallet' });

  // Retrieve password
  const { value } = await Preferences.get({ key: ENCRYPTED_PW_KEY });
  return value;
}

// ---------------------------------------------------------------------------
// Web path (WebAuthn + AES-GCM)
// ---------------------------------------------------------------------------

async function checkWebAvailability(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!window.PublicKeyCredential) return false;

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

async function registerWeb(password: string, setIsEnabled: (v: boolean) => void): Promise<boolean> {
  const secret = crypto.getRandomValues(new Uint8Array(32));
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
        id: secret,
        name: 'mvga-wallet-user',
        displayName: 'MVGA Wallet',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
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

  const stored: StoredCredential = {
    credentialId: bufferToBase64(credential.rawId),
  };

  localStorage.setItem(BIOMETRIC_KEY, JSON.stringify(stored));
  localStorage.setItem(ENCRYPTED_PW_KEY, encryptedPw);
  localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
  setIsEnabled(true);
  return true;
}

async function authenticateWeb(): Promise<string | null> {
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
  if (response.userHandle) {
    const secret = new Uint8Array(response.userHandle);
    return await decryptPassword(encryptedPw, secret);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Crypto helpers (web path only)
// ---------------------------------------------------------------------------

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
