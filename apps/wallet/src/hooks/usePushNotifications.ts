import { useState, useEffect, useCallback } from 'react';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { useAuth } from './useAuth';
import { API_URL, VAPID_PUBLIC_KEY } from '../config';
import { isNative } from '../utils/platform';

type Permission = NotificationPermission | 'unsupported';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { connected, publicKey } = useSelfCustodyWallet();
  const { isAuthenticated } = useAuth();
  const [permission, setPermission] = useState<Permission>(() => {
    if (isNative) return 'default'; // Will check via Capacitor
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const isSupported =
    isNative || ('PushManager' in window && 'serviceWorker' in navigator && !!VAPID_PUBLIC_KEY);

  // Check existing subscription on mount
  useEffect(() => {
    if (!isSupported) return;

    if (isNative) {
      checkNativeSubscription().then(setIsSubscribed);
    } else {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(!!sub);
        });
      });
    }
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !connected || !publicKey || !isAuthenticated) return;
    setLoading(true);

    try {
      if (isNative) {
        await subscribeNative(publicKey.toBase58());
      } else {
        await subscribeWeb(publicKey.toBase58());
      }
      setPermission('granted');
      setIsSubscribed(true);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Push subscription failed:', err);
    } finally {
      setLoading(false);
    }
  }, [isSupported, connected, publicKey, isAuthenticated]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported || !isAuthenticated) return;
    setLoading(true);

    try {
      if (isNative) {
        await unsubscribeNative();
      } else {
        await unsubscribeWeb();
      }
      setIsSubscribed(false);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Push unsubscribe failed:', err);
    } finally {
      setLoading(false);
    }
  }, [isSupported, isAuthenticated]);

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    subscribe,
    unsubscribe,
  };
}

// ---------------------------------------------------------------------------
// Native path (Capacitor Push Notifications — APNs / FCM)
// ---------------------------------------------------------------------------

async function checkNativeSubscription(): Promise<boolean> {
  try {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key: 'mvga-push-token' });
    return !!value;
  } catch {
    return false;
  }
}

async function subscribeNative(walletAddress: string): Promise<void> {
  const { PushNotifications } = await import('@capacitor/push-notifications');
  const { Preferences } = await import('@capacitor/preferences');

  let permStatus = await PushNotifications.checkPermissions();
  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions();
  }
  if (permStatus.receive !== 'granted') {
    throw new Error('Push notification permission denied');
  }

  // Register returns token via listener
  const tokenPromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Push registration timeout')), 10000);
    PushNotifications.addListener('registration', (token) => {
      clearTimeout(timeout);
      resolve(token.value);
    });
    PushNotifications.addListener('registrationError', (err) => {
      clearTimeout(timeout);
      reject(new Error(err.error));
    });
  });

  await PushNotifications.register();
  const token = await tokenPromise;

  // Send native token to backend
  await fetch(`${API_URL}/notifications/subscribe`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress,
      endpoint: `native:${token}`,
      p256dh: '',
      auth: '',
      userAgent: `MVGA-Native/${navigator.userAgent}`,
    }),
  });

  await Preferences.set({ key: 'mvga-push-token', value: token });
}

async function unsubscribeNative(): Promise<void> {
  const { PushNotifications } = await import('@capacitor/push-notifications');
  const { Preferences } = await import('@capacitor/preferences');

  const { value: token } = await Preferences.get({ key: 'mvga-push-token' });
  if (token) {
    await fetch(`${API_URL}/notifications/subscribe`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: `native:${token}` }),
    });
  }

  await PushNotifications.removeAllListeners();
  await Preferences.remove({ key: 'mvga-push-token' });
}

// ---------------------------------------------------------------------------
// Web path (Service Worker + VAPID)
// ---------------------------------------------------------------------------

async function subscribeWeb(walletAddress: string): Promise<void> {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notification permission denied');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    });
  }

  const keys = sub.toJSON().keys ?? {};

  await fetch(`${API_URL}/notifications/subscribe`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress,
      endpoint: sub.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: navigator.userAgent,
    }),
  });
}

async function unsubscribeWeb(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();

  if (sub) {
    await fetch(`${API_URL}/notifications/subscribe`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  }
}
