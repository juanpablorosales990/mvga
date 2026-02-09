/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException } from '@nestjs/common';
import { OnrampService } from './onramp.service';

describe('OnrampService', () => {
  let service: OnrampService;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'COINBASE_ONRAMP_SANDBOX') return 'true';
        if (key === 'CDP_API_KEY_ID') return 'test-key-id';
        if (key === 'CDP_API_KEY_SECRET') return 'test-key-secret';
        return undefined;
      }),
    };

    service = new OnrampService(mockConfig);
  });

  describe('createSession', () => {
    it('throws when CDP keys are not configured', async () => {
      mockConfig.get = jest.fn(() => undefined);
      service = new OnrampService(mockConfig);

      await expect(service.createSession('wallet123')).rejects.toThrow(BadRequestException);
    });

    it('calls Coinbase API with correct headers and body', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: 'session-token-123' }),
      });
      global.fetch = mockFetch;

      const result = await service.createSession('wallet123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.developer.coinbase.com/onramp/v1/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Api-Key': 'test-key-id',
            'X-Api-Secret': 'test-key-secret',
          }),
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.addresses.wallet123).toEqual(['solana']);
      expect(body.assets).toEqual(['USDC', 'SOL']);
      expect(result.sessionToken).toBe('session-token-123');
      expect(result.widgetUrl).toContain('pay-sandbox.coinbase.com');
    });

    it('throws BadRequestException on API failure', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(service.createSession('wallet123')).rejects.toThrow(BadRequestException);
    });

    it('uses sandbox widget URL when sandbox enabled', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: 'tok' }),
      });

      const result = await service.createSession('wallet123');
      expect(result.widgetUrl).toContain('pay-sandbox.coinbase.com');
    });
  });
});
