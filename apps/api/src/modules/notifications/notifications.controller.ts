import { Controller, Post, Delete, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { SubscribeDto, UnsubscribeDto } from './dto/subscribe.dto';
import { UpdatePreferencesDto } from './dto/preferences.dto';
import { AuthGuard } from '../auth/auth.guard';
import { ParseSolanaAddressPipe } from '../../common/validators/solana-address.validator';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('subscribe')
  @UseGuards(AuthGuard)
  async subscribe(@Body() dto: SubscribeDto) {
    await this.notificationsService.subscribe(dto);
    return { ok: true };
  }

  @Delete('subscribe')
  @UseGuards(AuthGuard)
  async unsubscribe(@Body() dto: UnsubscribeDto) {
    await this.notificationsService.unsubscribe(dto.endpoint);
    return { ok: true };
  }

  @Get('preferences/:wallet')
  async getPreferences(@Param('wallet', ParseSolanaAddressPipe) wallet: string) {
    return this.notificationsService.getPreferences(wallet);
  }

  @Put('preferences/:wallet')
  @UseGuards(AuthGuard)
  async updatePreferences(
    @Param('wallet', ParseSolanaAddressPipe) wallet: string,
    @Body() dto: UpdatePreferencesDto
  ) {
    return this.notificationsService.updatePreferences(wallet, dto);
  }
}
