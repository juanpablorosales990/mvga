import { useEffect, useRef } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { usePrices } from './usePrices';

/**
 * Checks price alerts against current prices and triggers notifications.
 * Should be mounted once in the app (e.g., in AuthProvider).
 */
export function usePriceAlerts() {
  const { prices } = usePrices();
  const priceAlerts = useWalletStore((s) => s.priceAlerts);
  const triggerPriceAlert = useWalletStore((s) => s.triggerPriceAlert);
  const checkedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!prices.sol) return; // Prices not loaded yet

    for (const alert of priceAlerts) {
      if (alert.triggered || checkedRef.current.has(alert.id)) continue;

      const tokenKey = alert.token.toLowerCase() as keyof typeof prices;
      const currentPrice = tokenKey in prices ? (prices[tokenKey] as number) : 0;
      if (currentPrice === 0) continue;

      const shouldTrigger =
        (alert.condition === 'above' && currentPrice >= alert.targetPrice) ||
        (alert.condition === 'below' && currentPrice <= alert.targetPrice);

      if (shouldTrigger) {
        checkedRef.current.add(alert.id);
        triggerPriceAlert(alert.id);

        // Show browser notification if permission granted
        if ('Notification' in window && Notification.permission === 'granted') {
          const direction = alert.condition === 'above' ? '\u2191' : '\u2193';
          new Notification(`${direction} ${alert.token} Price Alert`, {
            body: `${alert.token} is now $${currentPrice.toFixed(2)} (target: $${alert.targetPrice})`,
            icon: '/mvga-logo.png',
          });
        }
      }
    }
  }, [prices, priceAlerts, triggerPriceAlert]);
}
