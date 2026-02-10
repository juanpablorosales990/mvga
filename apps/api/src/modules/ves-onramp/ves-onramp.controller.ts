import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { VesOnrampService } from './ves-onramp.service';
import {
  CreateVesOfferDto,
  CreateVesOrderDto,
  ConfirmLockDto,
  DisputeOrderDto,
  ResolveDisputeDto,
} from './ves-onramp.dto';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/auth.decorator';

@ApiTags('VES On-Ramp')
@Controller('ves-onramp')
export class VesOnrampController {
  constructor(private readonly vesOnrampService: VesOnrampService) {}

  // ============ OFFERS ============

  @Get('offers')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'List active LP offers (sorted by best rate)' })
  async getOffers() {
    return this.vesOnrampService.getOffers();
  }

  @Post('offers')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new LP offer' })
  async createOffer(@Body() dto: CreateVesOfferDto, @CurrentUser('wallet') wallet: string) {
    return this.vesOnrampService.createOffer(dto, wallet);
  }

  @Delete('offers/:id')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate an LP offer' })
  async deactivateOffer(@Param('id') id: string, @CurrentUser('wallet') wallet: string) {
    return this.vesOnrampService.deactivateOffer(id, wallet);
  }

  // ============ ORDERS ============

  @Post('orders')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an order (pick an offer + enter VES amount)' })
  async createOrder(@Body() dto: CreateVesOrderDto, @CurrentUser('wallet') wallet: string) {
    return this.vesOnrampService.createOrder(dto.offerId, dto, wallet);
  }

  @Get('orders')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user order history' })
  async getUserOrders(@CurrentUser('wallet') wallet: string) {
    return this.vesOnrampService.getUserOrders(wallet);
  }

  @Get('orders/:id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order details' })
  async getOrder(@Param('id') id: string, @CurrentUser('wallet') wallet: string) {
    return this.vesOnrampService.getOrderDetails(id, wallet);
  }

  // ============ ESCROW ============

  @Post('orders/:id/lock')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get escrow lock params (LP action)' })
  async getEscrowLockParams(@Param('id') id: string, @CurrentUser('wallet') wallet: string) {
    return this.vesOnrampService.getEscrowLockParams(id, wallet);
  }

  @Post('orders/:id/confirm-lock')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm escrow lock with tx signature (LP action)' })
  async confirmEscrowLock(
    @Param('id') id: string,
    @Body() dto: ConfirmLockDto,
    @CurrentUser('wallet') wallet: string
  ) {
    return this.vesOnrampService.confirmEscrowLock(id, dto.signature, wallet);
  }

  // ============ PAYMENT FLOW ============

  @Patch('orders/:id/paid')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark VES as sent via Pago Movil (buyer action)' })
  async markPaid(@Param('id') id: string, @CurrentUser('wallet') wallet: string) {
    return this.vesOnrampService.markPaid(id, wallet);
  }

  @Patch('orders/:id/confirm')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm VES receipt and release escrow (LP action)' })
  async confirmReceipt(@Param('id') id: string, @CurrentUser('wallet') wallet: string) {
    return this.vesOnrampService.confirmReceipt(id, wallet);
  }

  @Post('orders/:id/confirm-release')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm on-chain escrow release (LP action)' })
  async confirmOnChainRelease(
    @Param('id') id: string,
    @Body() dto: ConfirmLockDto,
    @CurrentUser('wallet') wallet: string
  ) {
    return this.vesOnrampService.confirmOnChainRelease(id, dto.signature, wallet);
  }

  // ============ DISPUTES ============

  @Post('orders/:id/dispute')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Open a dispute' })
  async openDispute(
    @Param('id') id: string,
    @Body() dto: DisputeOrderDto,
    @CurrentUser('wallet') wallet: string
  ) {
    return this.vesOnrampService.openDispute(id, wallet, dto.reason);
  }

  @Post('orders/:id/resolve')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(AuthGuard, AdminGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resolve a dispute (admin only)' })
  async resolveDispute(
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
    @CurrentUser('wallet') wallet: string
  ) {
    return this.vesOnrampService.resolveDispute(id, dto.resolution, wallet, dto.notes);
  }
}
