import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { SwapService } from '../swap/swap.service';
import { VesRateService } from './ves-rate.service';
import { AlertStatus, PriceAlertType, AlertCondition, VesRateType } from '@prisma/client';

const MAX_ALERTS_PER_USER = 20;

const TOKEN_MINTS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  MVGA: 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh',
};

@Injectable()
export class PriceAlertsService {
  private readonly logger = new Logger(PriceAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly swapService: SwapService,
    private readonly vesRateService: VesRateService
  ) {}

  async createAlert(
    walletAddress: string,
    dto: {
      alertType: string;
      token?: string;
      vesRateType?: string;
      condition: string;
      targetPrice: number;
    }
  ) {
    // Validate type-specific fields
    if (dto.alertType === 'TOKEN_PRICE' && !dto.token) {
      throw new BadRequestException('token is required for TOKEN_PRICE alerts');
    }
    if (dto.alertType === 'VES_RATE' && !dto.vesRateType) {
      throw new BadRequestException('vesRateType is required for VES_RATE alerts');
    }

    // Enforce per-user limit
    const count = await this.prisma.priceAlert.count({
      where: { walletAddress, status: { not: AlertStatus.DISABLED } },
    });
    if (count >= MAX_ALERTS_PER_USER) {
      throw new BadRequestException(`Maximum ${MAX_ALERTS_PER_USER} active alerts allowed`);
    }

    return this.prisma.priceAlert.create({
      data: {
        walletAddress,
        alertType: dto.alertType as PriceAlertType,
        token: dto.alertType === 'TOKEN_PRICE' ? dto.token : null,
        vesRateType: dto.alertType === 'VES_RATE' ? (dto.vesRateType as VesRateType) : null,
        condition: dto.condition as AlertCondition,
        targetPrice: dto.targetPrice,
      },
    });
  }

  async listAlerts(walletAddress: string) {
    return this.prisma.priceAlert.findMany({
      where: { walletAddress },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateAlert(
    id: string,
    walletAddress: string,
    dto: { status?: string; targetPrice?: number }
  ) {
    const alert = await this.prisma.priceAlert.findUnique({ where: { id } });
    if (!alert) throw new BadRequestException('Alert not found');
    if (alert.walletAddress !== walletAddress) throw new ForbiddenException('Not your alert');

    const data: Record<string, unknown> = {};
    if (dto.status) data.status = dto.status as AlertStatus;
    if (dto.targetPrice) data.targetPrice = dto.targetPrice;

    return this.prisma.priceAlert.update({ where: { id }, data });
  }

  async deleteAlert(id: string, walletAddress: string) {
    const alert = await this.prisma.priceAlert.findUnique({ where: { id } });
    if (!alert) throw new BadRequestException('Alert not found');
    if (alert.walletAddress !== walletAddress) throw new ForbiddenException('Not your alert');

    await this.prisma.priceAlert.delete({ where: { id } });
    return { success: true };
  }

  async getCurrentPrices() {
    const mints = Object.values(TOKEN_MINTS);
    const tokenPrices = await this.swapService.getMultipleTokenPrices(mints);
    const vesRates = await this.vesRateService.getAllRates();

    const prices: Record<string, number> = {};
    for (const [symbol, mint] of Object.entries(TOKEN_MINTS)) {
      prices[symbol] = tokenPrices[mint] || 0;
    }

    return {
      tokens: prices,
      ves: vesRates,
    };
  }

  /**
   * Used by the cron job to check and trigger alerts.
   */
  async checkAndTriggerAlerts(): Promise<number> {
    const now = new Date();
    const alerts = await this.prisma.priceAlert.findMany({
      where: {
        status: AlertStatus.ACTIVE,
        OR: [{ cooldownUntil: null }, { cooldownUntil: { lte: now } }],
      },
    });

    if (alerts.length === 0) return 0;

    // Batch fetch prices
    const mints = Object.values(TOKEN_MINTS);
    const [tokenPrices, vesRates] = await Promise.all([
      this.swapService.getMultipleTokenPrices(mints),
      this.vesRateService.getAllRates(),
    ]);

    let triggered = 0;

    for (const alert of alerts) {
      let currentPrice: number | null = null;

      if (alert.alertType === PriceAlertType.TOKEN_PRICE && alert.token) {
        const mint = TOKEN_MINTS[alert.token];
        currentPrice = mint ? tokenPrices[mint] || null : null;
      } else if (alert.alertType === PriceAlertType.VES_RATE && alert.vesRateType) {
        currentPrice =
          alert.vesRateType === VesRateType.BCV_OFFICIAL ? vesRates.official : vesRates.parallel;
      }

      if (currentPrice === null || currentPrice === 0) continue;

      const shouldTrigger =
        (alert.condition === AlertCondition.ABOVE && currentPrice >= alert.targetPrice) ||
        (alert.condition === AlertCondition.BELOW && currentPrice <= alert.targetPrice);

      if (!shouldTrigger) continue;

      // Update alert state
      await this.prisma.priceAlert.update({
        where: { id: alert.id },
        data: {
          lastTriggered: now,
          triggerCount: { increment: 1 },
          cooldownUntil: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour
        },
      });

      triggered++;

      // Return event data for notification handling (cron service emits the event)
      // We don't emit here to keep the service testable without EventEmitter
    }

    return triggered;
  }

  /**
   * Get alerts that need triggering — used by cron to emit events.
   */
  async getTriggeredAlertEvents(): Promise<
    Array<{
      walletAddress: string;
      alertType: string;
      token: string | null;
      vesRateType: string | null;
      condition: string;
      targetPrice: number;
      currentPrice: number;
    }>
  > {
    const now = new Date();
    const alerts = await this.prisma.priceAlert.findMany({
      where: {
        status: AlertStatus.ACTIVE,
        OR: [{ cooldownUntil: null }, { cooldownUntil: { lte: now } }],
      },
    });

    if (alerts.length === 0) return [];

    const mints = Object.values(TOKEN_MINTS);
    const [tokenPrices, vesRates] = await Promise.all([
      this.swapService.getMultipleTokenPrices(mints),
      this.vesRateService.getAllRates(),
    ]);

    const events: Array<{
      walletAddress: string;
      alertType: string;
      token: string | null;
      vesRateType: string | null;
      condition: string;
      targetPrice: number;
      currentPrice: number;
    }> = [];

    for (const alert of alerts) {
      let currentPrice: number | null = null;

      if (alert.alertType === PriceAlertType.TOKEN_PRICE && alert.token) {
        const mint = TOKEN_MINTS[alert.token];
        currentPrice = mint ? tokenPrices[mint] || null : null;
      } else if (alert.alertType === PriceAlertType.VES_RATE && alert.vesRateType) {
        currentPrice =
          alert.vesRateType === VesRateType.BCV_OFFICIAL ? vesRates.official : vesRates.parallel;
      }

      if (currentPrice === null || currentPrice === 0) continue;

      const shouldTrigger =
        (alert.condition === AlertCondition.ABOVE && currentPrice >= alert.targetPrice) ||
        (alert.condition === AlertCondition.BELOW && currentPrice <= alert.targetPrice);

      if (!shouldTrigger) continue;

      await this.prisma.priceAlert.update({
        where: { id: alert.id },
        data: {
          lastTriggered: now,
          triggerCount: { increment: 1 },
          cooldownUntil: new Date(now.getTime() + 60 * 60 * 1000),
        },
      });

      events.push({
        walletAddress: alert.walletAddress,
        alertType: alert.alertType,
        token: alert.token,
        vesRateType: alert.vesRateType,
        condition: alert.condition,
        targetPrice: alert.targetPrice,
        currentPrice,
      });
    }

    return events;
  }
}
