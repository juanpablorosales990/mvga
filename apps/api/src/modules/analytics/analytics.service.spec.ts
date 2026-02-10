/* eslint-disable @typescript-eslint/no-explicit-any */
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      analyticsEvent: {
        create: jest.fn().mockResolvedValue({ id: 'evt-1' }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };
    service = new AnalyticsService(mockPrisma);
  });

  describe('track', () => {
    it('creates an event with wallet and properties', async () => {
      await service.track('send_completed', 'wallet123', { token: 'USDC', amount: 10 });

      expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledWith({
        data: {
          event: 'send_completed',
          walletAddress: 'wallet123',
          properties: { token: 'USDC', amount: 10 },
        },
      });
    });

    it('creates an event without wallet or properties', async () => {
      await service.track('page_view');

      expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledWith({
        data: {
          event: 'page_view',
          walletAddress: null,
          properties: undefined,
        },
      });
    });

    it('does not throw on prisma error', async () => {
      mockPrisma.analyticsEvent.create.mockRejectedValue(new Error('DB down'));

      await expect(service.track('broken_event')).resolves.toBeUndefined();
    });
  });

  describe('getEventCounts', () => {
    it('groups events by name', async () => {
      mockPrisma.analyticsEvent.groupBy.mockResolvedValue([
        { event: 'send_completed', _count: { event: 5 } },
        { event: 'deposit_started', _count: { event: 3 } },
      ]);

      const result = await service.getEventCounts();
      expect(result).toHaveLength(2);
      expect(mockPrisma.analyticsEvent.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['event'],
          where: {},
        })
      );
    });

    it('filters by date when since is provided', async () => {
      const since = new Date('2026-01-01');
      await service.getEventCounts(since);

      expect(mockPrisma.analyticsEvent.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { createdAt: { gte: since } },
        })
      );
    });
  });
});
