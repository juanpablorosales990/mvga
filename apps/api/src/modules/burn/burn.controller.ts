import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BurnService } from './burn.service';

@ApiTags('burn')
@Controller('burn')
export class BurnController {
  constructor(private readonly burnService: BurnService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get token burn statistics' })
  getBurnStats() {
    return this.burnService.getBurnStats();
  }

  @Get('history')
  @ApiOperation({ summary: 'Get burn transaction history' })
  getBurnHistory(@Query('limit') limit?: string) {
    return this.burnService.getBurnHistory(limit ? parseInt(limit, 10) : 10);
  }
}
