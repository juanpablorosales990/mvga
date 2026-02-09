/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException } from '@nestjs/common';
import { TopUpService } from './topup.service';

describe('TopUpService', () => {
  let service: TopUpService;
  let mockPrisma: any;
  let mockConfig: any;

  beforeEach(() => {
    mockPrisma = {
      topUp: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };

    mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'RELOADLY_SANDBOX') return 'true';
        if (key === 'RELOADLY_CLIENT_ID') return 'test-client-id';
        if (key === 'RELOADLY_CLIENT_SECRET') return 'test-secret';
        return undefined;
      }),
    };

    service = new TopUpService(mockPrisma, mockConfig);
  });

  describe('getAccessToken (via getOperators)', () => {
    it('authenticates with Reloadly and caches token', async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'token123', expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ operatorId: 1, name: 'Movistar' }]),
        });
      global.fetch = mockFetch;

      const result = await service.getOperators('VE');
      expect(result).toEqual([{ operatorId: 1, name: 'Movistar' }]);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Auth call
      const authBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(authBody.client_id).toBe('test-client-id');
      expect(authBody.grant_type).toBe('client_credentials');
    });

    it('throws when Reloadly credentials missing', async () => {
      mockConfig.get = jest.fn(() => undefined);
      service = new TopUpService(mockPrisma, mockConfig);

      // First fetch call will try to auth and fail with missing creds
      await expect(service.getOperators('VE')).rejects.toThrow(BadRequestException);
    });

    it('uses cached token on subsequent calls', async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'tok', expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });
      global.fetch = mockFetch;

      await service.getOperators('VE');
      await service.getOperators('CO');
      // Auth only called once (first call), subsequent calls use cache
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 auth + 2 GET
    });
  });

  describe('topUp', () => {
    it('creates pending record then updates on success', async () => {
      mockPrisma.topUp.create.mockResolvedValue({ id: 'topup-1' });
      mockPrisma.topUp.update.mockResolvedValue({});

      // Set cached token to skip auth
      (service as any).token = { accessToken: 'tok', expiresAt: Date.now() + 600_000 };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            transactionId: 'reloadly-tx-1',
            operatorName: 'Movistar',
            deliveredAmount: 100,
            deliveredAmountCurrencyCode: 'VES',
          }),
      });

      const result = await service.topUp('wallet1', '+584121234567', 'VE', 1, 2);
      expect(result.status).toBe('SUCCESSFUL');
      expect(result.deliveredCurrency).toBe('VES');
      expect(mockPrisma.topUp.create).toHaveBeenCalled();
      expect(mockPrisma.topUp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUCCESSFUL' }),
        })
      );
    });

    it('marks as FAILED on reloadly error', async () => {
      mockPrisma.topUp.create.mockResolvedValue({ id: 'topup-2' });
      mockPrisma.topUp.update.mockResolvedValue({});

      (service as any).token = { accessToken: 'tok', expiresAt: Date.now() + 600_000 };
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Insufficient balance'),
      });

      await expect(service.topUp('wallet1', '+58412', 'VE', 1, 2)).rejects.toThrow(
        BadRequestException
      );
      expect(mockPrisma.topUp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        })
      );
    });
  });

  describe('getHistory', () => {
    it('returns topups for wallet', async () => {
      mockPrisma.topUp.findMany.mockResolvedValue([
        { id: '1', recipientPhone: '+58', status: 'SUCCESSFUL' },
      ]);

      const result = await service.getHistory('wallet1');
      expect(result).toHaveLength(1);
      expect(mockPrisma.topUp.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'wallet1' } })
      );
    });
  });

  describe('getBalance', () => {
    it('fetches Reloadly account balance', async () => {
      (service as any).token = { accessToken: 'tok', expiresAt: Date.now() + 600_000 };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ balance: 998.5, currency: 'USD' }),
      });

      const result = await service.getBalance();
      expect(result).toEqual({ balance: 998.5, currency: 'USD' });
    });
  });
});
