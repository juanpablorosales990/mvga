import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PriceAlertsService } from './price-alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';

@ApiTags('Price Alerts')
@Controller('price-alerts')
export class PriceAlertsController {
  constructor(private readonly priceAlertsService: PriceAlertsService) {}

  @Get('rates')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Get current token prices and VES rates' })
  async getCurrentPrices() {
    return this.priceAlertsService.getCurrentPrices();
  }

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List user price alerts' })
  async listAlerts(@CurrentUser('wallet') wallet: string) {
    return this.priceAlertsService.listAlerts(wallet);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a price alert' })
  async createAlert(@Body() dto: CreateAlertDto, @CurrentUser('wallet') wallet: string) {
    return this.priceAlertsService.createAlert(wallet, dto);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a price alert' })
  async updateAlert(
    @Param('id') id: string,
    @Body() dto: UpdateAlertDto,
    @CurrentUser('wallet') wallet: string
  ) {
    return this.priceAlertsService.updateAlert(id, wallet, dto);
  }

  @Delete(':id')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a price alert' })
  async deleteAlert(@Param('id') id: string, @CurrentUser('wallet') wallet: string) {
    return this.priceAlertsService.deleteAlert(id, wallet);
  }
}
