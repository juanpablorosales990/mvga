import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OfframpService } from './offramp.service';

const WALLET = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const OTHER_WALLET = '9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsX';
const PAYOUT_ID = 'payout-123';
const AIRTM_PAYOUT_ID = 'airtm-pay-456';
const EMAIL = 'maria@example.com';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

function mockPayout(overrides: Record<string, unknown> = {}) {
  return {
    id: PAYOUT_ID,
    walletAddress: WALLET,
    recipientEmail: EMAIL,
    amountUsd: 50,
    description: 'Test payout',
    status: 'PENDING',
    airtmPayoutId: AIRTM_PAYOUT_ID,
    airtmCode: 'REF-001',
    errorMessage: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('OfframpService', () => {
  let service: OfframpService;
  let prisma: any;
  let config: any;

  beforeEach(() => {
    prisma = {
      payout: {
        create: jest.fn().mockResolvedValue(mockPayout()),
        findUnique: jest.fn().mockResolvedValue(mockPayout()),
        findMany: jest.fn().mockResolvedValue([mockPayout()]),
        update: jest.fn().mockResolvedValue(mockPayout()),
      },
    };

    config = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          AIRTM_SANDBOX: 'true',
          AIRTM_API_KEY: 'test-key',
          AIRTM_API_SECRET: 'test-secret',
        };
        return map[key];
      }),
    };

    // Default mock: successful Airtm response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ id: AIRTM_PAYOUT_ID, code: 'REF-001', status: 'created', amount: 50 }),
    });

    service = new OfframpService(prisma, config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── createPayout ──────────────────────────────────────────────────

  describe('createPayout', () => {
    it('creates DB record and calls Airtm API', async () => {
      const result = await service.createPayout(WALLET, EMAIL, 50, 'Test');

      expect(prisma.payout.create).toHaveBeenCalledWith({
        data: {
          walletAddress: WALLET,
          recipientEmail: EMAIL,
          amountUsd: 50,
          description: 'Test',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://payments.static-stg.tests.airtm.org/payouts',
        expect.objectContaining({ method: 'POST' })
      );

      expect(result.airtmPayoutId).toBe(AIRTM_PAYOUT_ID);
      expect(result.status).toBe('PENDING');
    });

    it('marks payout as FAILED if Airtm API fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve('API error') });

      await expect(service.createPayout(WALLET, EMAIL, 50)).rejects.toThrow(BadRequestException);

      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: PAYOUT_ID },
        data: expect.objectContaining({ status: 'FAILED' }),
      });
    });

    it('uses correct sandbox base URL', async () => {
      await service.createPayout(WALLET, EMAIL, 50);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('payments.static-stg.tests.airtm.org'),
        expect.any(Object)
      );
    });

    it('sends Basic Auth header', async () => {
      await service.createPayout(WALLET, EMAIL, 50);

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers;
      const expected = 'Basic ' + Buffer.from('test-key:test-secret').toString('base64');
      expect(headers.Authorization).toBe(expected);
    });

    it('throws if Airtm not configured', async () => {
      config.get = jest.fn(() => undefined);
      service = new OfframpService(prisma, config);

      await expect(service.createPayout(WALLET, EMAIL, 50)).rejects.toThrow('Airtm not configured');
    });
  });

  // ── commitPayout ──────────────────────────────────────────────────

  describe('commitPayout', () => {
    it('commits a pending payout', async () => {
      const result = await service.commitPayout(WALLET, PAYOUT_ID);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/payouts/${AIRTM_PAYOUT_ID}/commit`),
        expect.objectContaining({ method: 'POST' })
      );

      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: PAYOUT_ID },
        data: { status: 'COMMITTED' },
      });

      expect(result.status).toBe('COMMITTED');
    });

    it('rejects if payout not found', async () => {
      prisma.payout.findUnique.mockResolvedValue(null);

      await expect(service.commitPayout(WALLET, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('rejects if wallet does not match', async () => {
      await expect(service.commitPayout(OTHER_WALLET, PAYOUT_ID)).rejects.toThrow(
        NotFoundException
      );
    });

    it('rejects if payout is not PENDING', async () => {
      prisma.payout.findUnique.mockResolvedValue(mockPayout({ status: 'COMMITTED' }));

      await expect(service.commitPayout(WALLET, PAYOUT_ID)).rejects.toThrow(BadRequestException);
    });

    it('rejects if no Airtm ID', async () => {
      prisma.payout.findUnique.mockResolvedValue(mockPayout({ airtmPayoutId: null }));

      await expect(service.commitPayout(WALLET, PAYOUT_ID)).rejects.toThrow(BadRequestException);
    });

    it('marks as FAILED if Airtm commit fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve('Commit error') });

      await expect(service.commitPayout(WALLET, PAYOUT_ID)).rejects.toThrow(BadRequestException);

      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: PAYOUT_ID },
        data: expect.objectContaining({ status: 'FAILED' }),
      });
    });
  });

  // ── createOneStepPayout ───────────────────────────────────────────

  describe('createOneStepPayout', () => {
    it('creates and commits in one call', async () => {
      const result = await service.createOneStepPayout(WALLET, EMAIL, 100, 'Quick send');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/payouts/one-step'),
        expect.objectContaining({ method: 'POST' })
      );

      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: PAYOUT_ID },
        data: expect.objectContaining({
          airtmPayoutId: AIRTM_PAYOUT_ID,
          status: 'COMMITTED',
        }),
      });

      expect(result.status).toBe('COMMITTED');
    });

    it('marks as FAILED if one-step API fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve('Error') });

      await expect(service.createOneStepPayout(WALLET, EMAIL, 50)).rejects.toThrow(
        BadRequestException
      );

      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: PAYOUT_ID },
        data: expect.objectContaining({ status: 'FAILED' }),
      });
    });
  });

  // ── cancelPayout ──────────────────────────────────────────────────

  describe('cancelPayout', () => {
    it('cancels a PENDING payout', async () => {
      const result = await service.cancelPayout(WALLET, PAYOUT_ID);

      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: PAYOUT_ID },
        data: { status: 'CANCELLED' },
      });

      expect(result.status).toBe('CANCELLED');
    });

    it('cancels a COMMITTED payout', async () => {
      prisma.payout.findUnique.mockResolvedValue(mockPayout({ status: 'COMMITTED' }));

      const result = await service.cancelPayout(WALLET, PAYOUT_ID);
      expect(result.status).toBe('CANCELLED');
    });

    it('calls Airtm cancel API if airtmPayoutId exists', async () => {
      await service.cancelPayout(WALLET, PAYOUT_ID);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/payouts/cancel'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('still cancels locally if Airtm cancel fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve('Error') });

      // Should not throw — cancel is best-effort on Airtm side
      const result = await service.cancelPayout(WALLET, PAYOUT_ID);
      expect(result.status).toBe('CANCELLED');
    });

    it('rejects if payout not found', async () => {
      prisma.payout.findUnique.mockResolvedValue(null);

      await expect(service.cancelPayout(WALLET, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('rejects if wallet does not match', async () => {
      await expect(service.cancelPayout(OTHER_WALLET, PAYOUT_ID)).rejects.toThrow(
        NotFoundException
      );
    });

    it('rejects if payout is COMPLETED', async () => {
      prisma.payout.findUnique.mockResolvedValue(mockPayout({ status: 'COMPLETED' }));

      await expect(service.cancelPayout(WALLET, PAYOUT_ID)).rejects.toThrow(BadRequestException);
    });

    it('rejects if payout is FAILED', async () => {
      prisma.payout.findUnique.mockResolvedValue(mockPayout({ status: 'FAILED' }));

      await expect(service.cancelPayout(WALLET, PAYOUT_ID)).rejects.toThrow(BadRequestException);
    });
  });

  // ── getPayoutStatus ───────────────────────────────────────────────

  describe('getPayoutStatus', () => {
    it('returns cached status for completed payout', async () => {
      prisma.payout.findUnique.mockResolvedValue(mockPayout({ status: 'COMPLETED' }));

      const result = await service.getPayoutStatus(WALLET, PAYOUT_ID);

      expect(result.status).toBe('COMPLETED');
      // Should NOT call Airtm API for terminal status
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('checks Airtm for pending payout and updates status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'completed' }),
      });

      const result = await service.getPayoutStatus(WALLET, PAYOUT_ID);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/payouts/event/${AIRTM_PAYOUT_ID}`),
        expect.any(Object)
      );

      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: PAYOUT_ID },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      });

      expect(result.status).toBe('COMPLETED');
    });

    it('returns cached status if Airtm check fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve('Error') });

      const result = await service.getPayoutStatus(WALLET, PAYOUT_ID);
      expect(result.status).toBe('PENDING');
    });

    it('rejects if payout not found', async () => {
      prisma.payout.findUnique.mockResolvedValue(null);

      await expect(service.getPayoutStatus(WALLET, 'nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });

    it('rejects if wallet does not match', async () => {
      await expect(service.getPayoutStatus(OTHER_WALLET, PAYOUT_ID)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // ── getPayouts ────────────────────────────────────────────────────

  describe('getPayouts', () => {
    it('returns payouts for wallet', async () => {
      const result = await service.getPayouts(WALLET);

      expect(prisma.payout.findMany).toHaveBeenCalledWith({
        where: { walletAddress: WALLET },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      expect(result).toHaveLength(1);
    });
  });

  // ── getBalance ────────────────────────────────────────────────────

  describe('getBalance', () => {
    it('calls Airtm partner balance endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ balance: 5000, currency: 'USD' }),
      });

      const result = await service.getBalance();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/partner/balance'),
        expect.any(Object)
      );

      expect(result).toEqual({ balance: 5000, currency: 'USD' });
    });
  });
});
