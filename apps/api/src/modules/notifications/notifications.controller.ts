import { Controller, Post, Delete, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { SubscribeDto, UnsubscribeDto } from './dto/subscribe.dto';
import { UpdatePreferencesDto } from './dto/preferences.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('subscribe')
  @UseGuards(AuthGuard)
  async subscribe(@Body() dto: SubscribeDto, @CurrentUser('wallet') wallet: string) {
    await this.notificationsService.subscribe({ ...dto, walletAddress: wallet });
    return { ok: true };
  }

  @Delete('subscribe')
  @UseGuards(AuthGuard)
  async unsubscribe(@Body() dto: UnsubscribeDto) {
    await this.notificationsService.unsubscribe(dto.endpoint);
    return { ok: true };
  }

  @Get('preferences')
  @UseGuards(AuthGuard)
  async getPreferences(@CurrentUser('wallet') wallet: string) {
    return this.notificationsService.getPreferences(wallet);
  }

  @Put('preferences')
  @UseGuards(AuthGuard)
  async updatePreferences(
    @CurrentUser('wallet') wallet: string,
    @Body() dto: UpdatePreferencesDto
  ) {
    return this.notificationsService.updatePreferences(wallet, dto);
  }
}
