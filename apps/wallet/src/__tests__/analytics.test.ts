import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { track, registerTransport, AnalyticsEvents } from '../lib/analytics';

describe('analytics', () => {
  const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = fetchSpy;
    fetchSpy.mockClear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends event to API endpoint', () => {
    track(AnalyticsEvents.SEND_COMPLETED, { token: 'USDC', amount: 10 });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/analytics/event'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          event: 'send_completed',
          properties: { token: 'USDC', amount: 10 },
        }),
      })
    );
  });

  it('sends event without properties', () => {
    track(AnalyticsEvents.WALLET_CREATED);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/analytics/event'),
      expect.objectContaining({
        body: JSON.stringify({ event: 'wallet_created' }),
      })
    );
  });

  it('does not throw when fetch fails', () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    expect(() => track(AnalyticsEvents.QR_SCANNED)).not.toThrow();
  });

  it('calls registered transports', () => {
    const spy = vi.fn();
    registerTransport(spy);

    track(AnalyticsEvents.DEPOSIT_STARTED, { method: 'paypal' });

    expect(spy).toHaveBeenCalledWith('deposit_started', { method: 'paypal' });
  });

  it('does not throw when transport fails', () => {
    registerTransport(() => {
      throw new Error('transport broken');
    });

    expect(() => track(AnalyticsEvents.KYC_STARTED)).not.toThrow();
  });

  it('exports all expected event names', () => {
    expect(AnalyticsEvents.WALLET_CREATED).toBe('wallet_created');
    expect(AnalyticsEvents.EXPORT_PDF).toBe('export_pdf');
    expect(AnalyticsEvents.TOPUP_COMPLETED).toBe('topup_completed');
    expect(AnalyticsEvents.GIFTCARD_PURCHASED).toBe('giftcard_purchased');
    expect(AnalyticsEvents.CITIZEN_CARD_SHARED).toBe('citizen_card_shared');
    expect(AnalyticsEvents.VES_ONRAMP_STARTED).toBe('ves_onramp_started');
    expect(AnalyticsEvents.VES_ONRAMP_COMPLETED).toBe('ves_onramp_completed');
    expect(AnalyticsEvents.SUPPORT_CHAT_OPENED).toBe('support_chat_opened');
    expect(AnalyticsEvents.SUPPORT_ESCALATED).toBe('support_escalated');
    expect(Object.keys(AnalyticsEvents).length).toBe(23);
  });
});
