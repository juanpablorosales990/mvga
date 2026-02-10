import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { AnalyticsService } from './analytics.service';
import { TrackEventDto } from './dto/track-event.dto';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('event')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  async trackEvent(@CurrentUser('wallet') wallet: string, @Body() dto: TrackEventDto) {
    await this.analytics.track(dto.event, wallet, dto.properties);
  }
}
