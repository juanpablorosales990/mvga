import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @ApiOperation({ summary: 'Get latest protocol metrics' })
  getLatestMetrics() {
    return this.metricsService.getLatestMetrics();
  }

  @Get('history')
  @ApiOperation({ summary: 'Get metrics history for charts' })
  getMetricsHistory(@Query('period') period?: string) {
    const validPeriods = ['24h', '7d', '30d'] as const;
    const p = validPeriods.includes(period as any) ? (period as '24h' | '7d' | '30d') : '7d';
    return this.metricsService.getMetricsHistory(p);
  }
}
