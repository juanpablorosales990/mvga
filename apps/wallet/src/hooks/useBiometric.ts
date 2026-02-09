import { useState, useEffect, useCallback } from 'react';

const BIOMETRIC_KEY = 'mvga-biometric-credential';
const BIOMETRIC_ENABLED_KEY = 'mvga-biometric-enabled';

interface StoredCredential {
  credentialId: string;
  publicKey: string;
}

/**
 * WebAuthn biometric authentication hook.
 * Uses platform authenticators (Face ID, Touch ID, Windows Hello, Android biometrics).
 *
 * Flow:
 * 1. User enables biometric in Settings (registers a credential)
 * 2. On LockScreen, user taps "Unlock with biometric" (asserts the credential)
 * 3. If assertion succeeds, we auto-fill the stored password and unlock
 *
 * The password is stored in the credential's userHandle (encrypted by the platform).
 * This is safe because the credential is hardware-bound and cannot be extracted.
 */
export function useBiometric() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if WebAuthn is available and platform authenticator exists
    checkAvailability().then(setIsAvailable);
    setIsEnabled(localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true');
  }, []);

  const register = useCallback(
    async (password: string): Promise<boolean> => {
      if (!isAvailable) return false;
      setIsLoading(true);

      try {
        // Generate a random challenge
        const challenge = crypto.getRandomValues(new Uint8Array(32));

        // Encode the password into the user ID so we can retrieve it on assertion
        const encoder = new TextEncoder();
        const userId = encoder.encode(password);

        const credential = (await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: {
              name: 'MVGA Wallet',
              id: window.location.hostname,
            },
            user: {
              id: userId,
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

        const response = credential.response as AuthenticatorAttestationResponse;

        // Store credential ID for future assertions
        const stored: StoredCredential = {
          credentialId: bufferToBase64(credential.rawId),
          publicKey: bufferToBase64(response.getPublicKey?.() || new ArrayBuffer(0)),
        };

        localStorage.setItem(BIOMETRIC_KEY, JSON.stringify(stored));
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
      if (!storedStr) return null;

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

      // The userHandle contains the password we stored during registration
      if (response.userHandle) {
        const decoder = new TextDecoder();
        return decoder.decode(response.userHandle);
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
