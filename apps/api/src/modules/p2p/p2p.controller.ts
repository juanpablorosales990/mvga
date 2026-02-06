import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { P2PService } from './p2p.service';
import { CreateOfferDto, AcceptOfferDto } from './dto/create-offer.dto';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/auth.decorator';

@ApiTags('P2P Exchange')
@Controller('p2p')
export class P2PController {
  constructor(private readonly p2pService: P2PService) {}

  // ============ OFFERS ============

  @Get('offers')
  @ApiOperation({ summary: 'List active P2P offers' })
  @ApiQuery({ name: 'type', required: false, enum: ['BUY', 'SELL'] })
  @ApiQuery({ name: 'cryptoCurrency', required: false, enum: ['USDC', 'MVGA'] })
  @ApiQuery({
    name: 'paymentMethod',
    required: false,
    enum: ['ZELLE', 'VENMO', 'PAYPAL', 'BANK_TRANSFER'],
  })
  async getOffers(
    @Query('type') type?: 'BUY' | 'SELL',
    @Query('cryptoCurrency') cryptoCurrency?: string,
    @Query('paymentMethod') paymentMethod?: string
  ) {
    return this.p2pService.getOffers({ type, cryptoCurrency, paymentMethod });
  }

  @Get('offers/:id')
  @ApiOperation({ summary: 'Get offer details' })
  async getOffer(@Param('id') id: string) {
    return this.p2pService.getOffer(id);
  }

  @Post('offers')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new P2P offer' })
  async createOffer(@Body() dto: CreateOfferDto, @CurrentUser('wallet') wallet: string) {
    dto.sellerAddress = wallet;
    return this.p2pService.createOffer(dto);
  }

  @Delete('offers/:id')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel an offer' })
  async cancelOffer(@Param('id') id: string, @CurrentUser('wallet') wallet: string) {
    await this.p2pService.cancelOffer(id, wallet);
    return { success: true, message: 'Offer cancelled' };
  }

  // ============ TRADES ============

  @Post('offers/:offerId/accept')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept an offer and start a trade' })
  async acceptOffer(
    @Param('offerId') offerId: string,
    @Body() dto: AcceptOfferDto,
    @CurrentUser('wallet') wallet: string
  ) {
    dto.buyerAddress = wallet;
    return this.p2pService.acceptOffer(offerId, dto);
  }

  @Get('trades/:id')
  @ApiOperation({ summary: 'Get trade details' })
  async getTrade(@Param('id') id: string) {
    return this.p2pService.getTrade(id);
  }

  @Get('users/:walletAddress/trades')
  @ApiOperation({ summary: 'Get user trade history' })
  async getUserTrades(@Param('walletAddress') walletAddress: string) {
    return this.p2pService.getUserTrades(walletAddress);
  }

  @Patch('trades/:id/paid')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark trade as paid (buyer action)' })
  async markAsPaid(
    @Param('id') id: string,
    @CurrentUser('wallet') wallet: string,
    @Body() body: { notes?: string }
  ) {
    return this.p2pService.updateTradeStatus(id, wallet, {
      status: 'PAID',
      notes: body.notes,
    });
  }

  @Patch('trades/:id/confirm')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm payment received and release escrow (seller action)' })
  async confirmTrade(@Param('id') id: string, @CurrentUser('wallet') wallet: string) {
    return this.p2pService.updateTradeStatus(id, wallet, { status: 'CONFIRMED' });
  }

  @Post('trades/:id/dispute')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Open a dispute' })
  async openDispute(
    @Param('id') id: string,
    @CurrentUser('wallet') wallet: string,
    @Body() body: { reason: string; evidence?: string }
  ) {
    return this.p2pService.updateTradeStatus(id, wallet, {
      status: 'DISPUTED',
      notes: body.reason,
    });
  }

  @Patch('trades/:id/cancel')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a trade (only if not yet paid)' })
  async cancelTrade(@Param('id') id: string, @CurrentUser('wallet') wallet: string) {
    return this.p2pService.updateTradeStatus(id, wallet, { status: 'CANCELLED' });
  }

  // ============ REPUTATION ============

  @Get('users/:walletAddress/reputation')
  @ApiOperation({ summary: 'Get user reputation' })
  async getReputation(@Param('walletAddress') walletAddress: string) {
    return this.p2pService.getReputation(walletAddress);
  }

  // ============ ESCROW ============

  @Post('trades/:id/lock-escrow')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get escrow info (returns treasury wallet for seller to transfer to)' })
  async lockEscrow(@Param('id') id: string) {
    return this.p2pService.lockEscrow(id);
  }

  @Post('trades/:id/confirm-escrow')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm escrow lock after seller signs the transfer' })
  async confirmEscrowLock(@Param('id') id: string, @Body() body: { signature: string }) {
    return this.p2pService.confirmEscrowLock(id, body.signature);
  }

  // ============ DISPUTE RESOLUTION ============

  @Post('trades/:id/resolve-dispute')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(AuthGuard, AdminGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resolve a dispute (admin only)' })
  async resolveDispute(
    @Param('id') id: string,
    @CurrentUser('wallet') wallet: string,
    @Body()
    body: {
      resolution: 'RELEASE_TO_BUYER' | 'REFUND_TO_SELLER';
      notes: string;
    }
  ) {
    return this.p2pService.resolveDispute(id, body.resolution, wallet, body.notes);
  }
}
