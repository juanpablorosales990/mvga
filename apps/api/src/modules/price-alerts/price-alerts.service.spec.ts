import { PriceAlertsService } from './price-alerts.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

const mockPrisma = {
  priceAlert: {
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockSwapService = {
  getMultipleTokenPrices: jest.fn(),
};

const mockVesRateService = {
  getAllRates: jest.fn(),
};

describe('PriceAlertsService', () => {
  let service: PriceAlertsService;

  beforeEach(() => {
    service = new PriceAlertsService(
      mockPrisma as any,
      mockSwapService as any,
      mockVesRateService as any
    );
    jest.clearAllMocks();
  });

  describe('createAlert', () => {
    it('creates a token price alert', async () => {
      mockPrisma.priceAlert.count.mockResolvedValue(0);
      mockPrisma.priceAlert.create.mockResolvedValue({
        id: 'alert-1',
        alertType: 'TOKEN_PRICE',
        token: 'SOL',
        condition: 'ABOVE',
        targetPrice: 200,
      });

      const result = await service.createAlert('wallet1', {
        alertType: 'TOKEN_PRICE',
        token: 'SOL',
        condition: 'ABOVE',
        targetPrice: 200,
      });

      expect(result.alertType).toBe('TOKEN_PRICE');
      expect(result.token).toBe('SOL');
      expect(mockPrisma.priceAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          walletAddress: 'wallet1',
          alertType: 'TOKEN_PRICE',
          token: 'SOL',
          vesRateType: null,
          condition: 'ABOVE',
          targetPrice: 200,
        }),
      });
    });

    it('creates a VES rate alert', async () => {
      mockPrisma.priceAlert.count.mockResolvedValue(0);
      mockPrisma.priceAlert.create.mockResolvedValue({
        id: 'alert-2',
        alertType: 'VES_RATE',
        vesRateType: 'PARALLEL_MARKET',
        condition: 'ABOVE',
        targetPrice: 550,
      });

      const result = await service.createAlert('wallet1', {
        alertType: 'VES_RATE',
        vesRateType: 'PARALLEL_MARKET',
        condition: 'ABOVE',
        targetPrice: 550,
      });

      expect(result.alertType).toBe('VES_RATE');
      expect(mockPrisma.priceAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          token: null,
          vesRateType: 'PARALLEL_MARKET',
        }),
      });
    });

    it('rejects TOKEN_PRICE without token', async () => {
      await expect(
        service.createAlert('wallet1', {
          alertType: 'TOKEN_PRICE',
          condition: 'ABOVE',
          targetPrice: 200,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects VES_RATE without vesRateType', async () => {
      await expect(
        service.createAlert('wallet1', {
          alertType: 'VES_RATE',
          condition: 'BELOW',
          targetPrice: 400,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when max alerts reached', async () => {
      mockPrisma.priceAlert.count.mockResolvedValue(20);

      await expect(
        service.createAlert('wallet1', {
          alertType: 'TOKEN_PRICE',
          token: 'SOL',
          condition: 'ABOVE',
          targetPrice: 200,
        })
      ).rejects.toThrow('Maximum 20 active alerts allowed');
    });
  });

  describe('listAlerts', () => {
    it('returns user alerts ordered by createdAt desc', async () => {
      const mockAlerts = [
        { id: '2', walletAddress: 'wallet1', createdAt: new Date('2026-02-12') },
        { id: '1', walletAddress: 'wallet1', createdAt: new Date('2026-02-11') },
      ];
      mockPrisma.priceAlert.findMany.mockResolvedValue(mockAlerts);

      const result = await service.listAlerts('wallet1');
      expect(result).toEqual(mockAlerts);
      expect(mockPrisma.priceAlert.findMany).toHaveBeenCalledWith({
        where: { walletAddress: 'wallet1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('updateAlert', () => {
    it('updates alert status', async () => {
      mockPrisma.priceAlert.findUnique.mockResolvedValue({
        id: 'alert-1',
        walletAddress: 'wallet1',
      });
      mockPrisma.priceAlert.update.mockResolvedValue({
        id: 'alert-1',
        status: 'DISABLED',
      });

      const result = await service.updateAlert('alert-1', 'wallet1', { status: 'DISABLED' });
      expect(result.status).toBe('DISABLED');
    });

    it('forbids updating another user alert', async () => {
      mockPrisma.priceAlert.findUnique.mockResolvedValue({
        id: 'alert-1',
        walletAddress: 'other-wallet',
      });

      await expect(
        service.updateAlert('alert-1', 'wallet1', { status: 'DISABLED' })
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteAlert', () => {
    it('deletes own alert', async () => {
      mockPrisma.priceAlert.findUnique.mockResolvedValue({
        id: 'alert-1',
        walletAddress: 'wallet1',
      });
      mockPrisma.priceAlert.delete.mockResolvedValue({});

      const result = await service.deleteAlert('alert-1', 'wallet1');
      expect(result.success).toBe(true);
    });

    it('forbids deleting another user alert', async () => {
      mockPrisma.priceAlert.findUnique.mockResolvedValue({
        id: 'alert-1',
        walletAddress: 'other-wallet',
      });

      await expect(service.deleteAlert('alert-1', 'wallet1')).rejects.toThrow(ForbiddenException);
    });

    it('rejects non-existent alert', async () => {
      mockPrisma.priceAlert.findUnique.mockResolvedValue(null);

      await expect(service.deleteAlert('nope', 'wallet1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCurrentPrices', () => {
    it('returns token prices and VES rates', async () => {
      mockSwapService.getMultipleTokenPrices.mockResolvedValue({
        So11111111111111111111111111111111111111112: 162.5,
        EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 1.0,
        Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 1.0,
        DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh: 0.001,
      });
      mockVesRateService.getAllRates.mockResolvedValue({
        official: 388.74,
        parallel: 546.05,
      });

      const result = await service.getCurrentPrices();
      expect(result.tokens.SOL).toBe(162.5);
      expect(result.tokens.USDC).toBe(1.0);
      expect(result.ves.official).toBe(388.74);
      expect(result.ves.parallel).toBe(546.05);
    });
  });

  describe('getTriggeredAlertEvents', () => {
    it('triggers ABOVE alert when price crosses threshold', async () => {
      mockPrisma.priceAlert.findMany.mockResolvedValue([
        {
          id: 'alert-1',
          walletAddress: 'wallet1',
          alertType: 'TOKEN_PRICE',
          token: 'SOL',
          vesRateType: null,
          condition: 'ABOVE',
          targetPrice: 160,
          status: 'ACTIVE',
          cooldownUntil: null,
        },
      ]);
      mockSwapService.getMultipleTokenPrices.mockResolvedValue({
        So11111111111111111111111111111111111111112: 162.5,
      });
      mockVesRateService.getAllRates.mockResolvedValue({ official: 388, parallel: 546 });
      mockPrisma.priceAlert.update.mockResolvedValue({});

      const events = await service.getTriggeredAlertEvents();
      expect(events).toHaveLength(1);
      expect(events[0].currentPrice).toBe(162.5);
      expect(events[0].walletAddress).toBe('wallet1');
      expect(mockPrisma.priceAlert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'alert-1' },
          data: expect.objectContaining({
            triggerCount: { increment: 1 },
          }),
        })
      );
    });

    it('triggers VES rate alert when rate crosses threshold', async () => {
      mockPrisma.priceAlert.findMany.mockResolvedValue([
        {
          id: 'alert-2',
          walletAddress: 'wallet1',
          alertType: 'VES_RATE',
          token: null,
          vesRateType: 'PARALLEL_MARKET',
          condition: 'ABOVE',
          targetPrice: 545,
          status: 'ACTIVE',
          cooldownUntil: null,
        },
      ]);
      mockSwapService.getMultipleTokenPrices.mockResolvedValue({});
      mockVesRateService.getAllRates.mockResolvedValue({ official: 388, parallel: 546 });
      mockPrisma.priceAlert.update.mockResolvedValue({});

      const events = await service.getTriggeredAlertEvents();
      expect(events).toHaveLength(1);
      expect(events[0].currentPrice).toBe(546);
      expect(events[0].vesRateType).toBe('PARALLEL_MARKET');
    });

    it('skips alerts in cooldown', async () => {
      mockPrisma.priceAlert.findMany.mockResolvedValue([]); // Prisma WHERE filters these out

      const events = await service.getTriggeredAlertEvents();
      expect(events).toHaveLength(0);
    });

    it('does not trigger BELOW alert when price is above target', async () => {
      mockPrisma.priceAlert.findMany.mockResolvedValue([
        {
          id: 'alert-3',
          walletAddress: 'wallet1',
          alertType: 'TOKEN_PRICE',
          token: 'SOL',
          vesRateType: null,
          condition: 'BELOW',
          targetPrice: 150,
          status: 'ACTIVE',
          cooldownUntil: null,
        },
      ]);
      mockSwapService.getMultipleTokenPrices.mockResolvedValue({
        So11111111111111111111111111111111111111112: 162.5,
      });
      mockVesRateService.getAllRates.mockResolvedValue({ official: 388, parallel: 546 });

      const events = await service.getTriggeredAlertEvents();
      expect(events).toHaveLength(0);
    });
  });
});
