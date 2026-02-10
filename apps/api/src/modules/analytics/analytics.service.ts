import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async track(event: string, walletAddress?: string, properties?: Record<string, unknown>) {
    try {
      await this.prisma.analyticsEvent.create({
        data: { event, walletAddress: walletAddress || null, properties: properties || undefined },
      });
    } catch (err) {
      this.logger.warn(`Failed to track event "${event}": ${err}`);
    }
  }

  async getEventCounts(since?: Date) {
    const where = since ? { createdAt: { gte: since } } : {};
    return this.prisma.analyticsEvent.groupBy({
      by: ['event'],
      where,
      _count: { event: true },
      orderBy: { _count: { event: 'desc' } },
    });
  }
}
