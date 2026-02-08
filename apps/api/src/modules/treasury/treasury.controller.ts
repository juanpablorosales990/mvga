import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { TreasuryService } from './treasury.service';
import { TreasuryStatsResponseDto, DistributionHistoryDto } from './treasury.dto';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Treasury')
@Controller('treasury')
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}

  /**
   * Get treasury statistics for transparency dashboard
   * Public endpoint - anyone can see how funds are distributed
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get treasury statistics' })
  @ApiResponse({ status: 200, type: TreasuryStatsResponseDto })
  async getStats() {
    return this.treasuryService.getTreasuryStats();
  }

  /**
   * Get distribution history
   * Public endpoint - shows all past distributions
   */
  @Get('distributions')
  @ApiOperation({ summary: 'Get distribution history' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, type: [DistributionHistoryDto] })
  async getDistributions(@Query('limit') limit?: number) {
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
    return this.treasuryService.getDistributionHistory(safeLimit);
  }

  /**
   * Get protocol health metrics
   * Shows key metrics about the self-sustaining protocol
   */
  @Get('health')
  @ApiOperation({ summary: 'Get protocol health metrics' })
  async getProtocolHealth() {
    const stats = await this.treasuryService.getTreasuryStats();
    const distributions = await this.treasuryService.getDistributionHistory(4);

    // Calculate 4-week trend
    const recentDistributions = distributions.filter((d) => d.status === 'COMPLETED');
    const avgDistribution =
      recentDistributions.length > 0
        ? recentDistributions.reduce((sum, d) => sum + d.totalAmount, 0) /
          recentDistributions.length
        : 0;

    return {
      isHealthy: stats.mainBalance > 0 || stats.pendingDistribution > 0,
      metrics: {
        currentReserves:
          stats.mainBalance + stats.liquidityBalance + stats.stakingBalance + stats.grantsBalance,
        pendingRevenue: stats.pendingDistribution,
        avgWeeklyDistribution: avgDistribution,
        totalDistributedAllTime: stats.totalDistributed,
      },
      allocation: {
        liquidity: {
          percent: stats.distributionBreakdown.liquidityPercent,
          purpose: 'Adds liquidity to Raydium pool, strengthening MVGA price floor',
        },
        staking: {
          percent: stats.distributionBreakdown.stakingPercent,
          purpose: 'Rewards MVGA stakers with sustainable APY',
        },
        grants: {
          percent: stats.distributionBreakdown.grantsPercent,
          purpose: 'Funds Venezuelan businesses through community-voted grants',
        },
      },
      upcomingDistribution: {
        scheduledAt: stats.nextDistributionAt,
        estimatedAmount: stats.pendingDistribution,
      },
      transparency: {
        message: '100% of protocol revenue flows back to the community. Zero funds go to founders.',
        wallets: {
          liquidity: 'HWRFGiMDWNvPHo5ZLV1MJEDjDNFVDJ8KJMDXcJjLVGa8',
          staking: 'GNhLCjqThNJAJAdDYvRTr2EfWyGXAFUymaPuKaL1duEh',
          grants: '9oeQpF87vYz1LmHDBqx1xvGsFxbRVJXmgNvRFYg3e8AQ',
        },
        verifyOnSolscan: 'https://solscan.io/account/{address}',
      },
    };
  }

  /**
   * Trigger manual distribution (admin only)
   * Protected by auth + admin guard - requires ADMIN role
   */
  @Post('distribute')
  @UseGuards(AuthGuard, AdminGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trigger manual distribution (admin)' })
  async triggerDistribution() {
    return this.treasuryService.triggerManualDistribution();
  }
}
