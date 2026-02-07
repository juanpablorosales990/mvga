import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { CronLockService } from '../../common/cron-lock.service';

const MVGA_DECIMALS = 9;

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cronLockService: CronLockService
  ) {}

  /**
   * Hourly snapshot of protocol metrics
   */
  @Cron('0 * * * *')
  async takeSnapshot() {
    const lockId = await this.cronLockService.acquireLock('metrics-snapshot', 120_000);
    if (!lockId) {
      this.logger.debug('Metrics snapshot: another instance holds the lock, skipping');
      return;
    }

    try {
      await this.runSnapshot();
    } finally {
      await this.cronLockService.releaseLock(lockId);
    }
  }

  private async runSnapshot() {
    this.logger.log('Taking hourly metrics snapshot...');

    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // TVL: staking + liquidity reserves (from TreasuryBalance)
      const [stakingAgg, latestBalance, totalBurnedAgg] = await Promise.all([
        this.prisma.stake.aggregate({
          where: { status: 'ACTIVE' },
          _sum: { amount: true },
        }),
        this.prisma.treasuryBalance.findFirst({
          orderBy: { snapshotAt: 'desc' },
        }),
        this.prisma.tokenBurn.aggregate({
          _sum: { amount: true },
        }),
      ]);

      const stakedAmount = stakingAgg._sum.amount ?? BigInt(0);
      const liquidityAmount = latestBalance?.liquidityWallet ?? BigInt(0);
      const tvl = stakedAmount + liquidityAmount;

      // 24h volume from transaction logs
      const volumeAgg = await this.prisma.transactionLog.aggregate({
        where: {
          createdAt: { gte: oneDayAgo },
          status: 'CONFIRMED',
        },
        _sum: { amount: true },
      });
      const volume24h = volumeAgg._sum.amount ?? BigInt(0);

      // 24h revenue from fee collections
      const revenueAgg = await this.prisma.feeCollection.aggregate({
        where: {
          createdAt: { gte: oneDayAgo },
        },
        _sum: { amount: true },
      });
      const revenue24h = revenueAgg._sum.amount ?? BigInt(0);

      // User counts
      const [totalUsers, activeUsersResult, totalStakersResult] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.transactionLog.groupBy({
          by: ['walletAddress'],
          where: { createdAt: { gte: oneDayAgo } },
        }),
        this.prisma.stake.groupBy({
          by: ['userId'],
          where: { status: 'ACTIVE' },
        }),
      ]);

      const totalBurned = totalBurnedAgg._sum.amount ?? BigInt(0);

      await this.prisma.metricsSnapshot.create({
        data: {
          tvl,
          volume24h,
          revenue24h,
          totalUsers,
          activeUsers: activeUsersResult.length,
          totalStakers: totalStakersResult.length,
          totalBurned,
        },
      });

      this.logger.log(
        `Snapshot: TVL=${Number(tvl) / 10 ** MVGA_DECIMALS}, Vol=${Number(volume24h) / 10 ** MVGA_DECIMALS}, Users=${totalUsers}`
      );
    } catch (error) {
      this.logger.error('Metrics snapshot failed:', error);
    }
  }

  /**
   * Get the latest metrics
   */
  async getLatestMetrics() {
    const snapshot = await this.prisma.metricsSnapshot.findFirst({
      orderBy: { snapshotAt: 'desc' },
    });

    if (!snapshot) {
      return {
        tvl: 0,
        volume24h: 0,
        revenue24h: 0,
        totalUsers: 0,
        activeUsers: 0,
        totalStakers: 0,
        totalBurned: 0,
        snapshotAt: null,
      };
    }

    return {
      tvl: Number(snapshot.tvl) / 10 ** MVGA_DECIMALS,
      volume24h: Number(snapshot.volume24h) / 10 ** MVGA_DECIMALS,
      revenue24h: Number(snapshot.revenue24h) / 10 ** MVGA_DECIMALS,
      totalUsers: snapshot.totalUsers,
      activeUsers: snapshot.activeUsers,
      totalStakers: snapshot.totalStakers,
      totalBurned: Number(snapshot.totalBurned) / 10 ** MVGA_DECIMALS,
      snapshotAt: snapshot.snapshotAt.toISOString(),
    };
  }

  /**
   * Get metrics history for charting
   */
  async getMetricsHistory(period: '24h' | '7d' | '30d' = '7d') {
    const now = new Date();
    const periodMs = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };

    const since = new Date(now.getTime() - periodMs[period]);

    const snapshots = await this.prisma.metricsSnapshot.findMany({
      where: { snapshotAt: { gte: since } },
      orderBy: { snapshotAt: 'asc' },
    });

    return snapshots.map((s) => ({
      tvl: Number(s.tvl) / 10 ** MVGA_DECIMALS,
      volume24h: Number(s.volume24h) / 10 ** MVGA_DECIMALS,
      revenue24h: Number(s.revenue24h) / 10 ** MVGA_DECIMALS,
      totalUsers: s.totalUsers,
      activeUsers: s.activeUsers,
      totalStakers: s.totalStakers,
      totalBurned: Number(s.totalBurned) / 10 ** MVGA_DECIMALS,
      snapshotAt: s.snapshotAt.toISOString(),
    }));
  }
}
