import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { P2PService } from './p2p.service';
import { CreateOfferDto, AcceptOfferDto, UpdateTradeStatusDto } from './dto/create-offer.dto';

@ApiTags('P2P Exchange')
@Controller('p2p')
export class P2PController {
  constructor(private readonly p2pService: P2PService) {}

  // ============ OFFERS ============

  @Get('offers')
  @ApiOperation({ summary: 'List active P2P offers' })
  @ApiQuery({ name: 'type', required: false, enum: ['BUY', 'SELL'] })
  @ApiQuery({ name: 'cryptoCurrency', required: false, enum: ['USDC', 'MVGA'] })
  @ApiQuery({ name: 'paymentMethod', required: false, enum: ['ZELLE', 'VENMO', 'PAYPAL', 'BANK_TRANSFER'] })
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
  @ApiOperation({ summary: 'Create a new P2P offer' })
  async createOffer(@Body() dto: CreateOfferDto) {
    return this.p2pService.createOffer(dto);
  }

  @Delete('offers/:id')
  @ApiOperation({ summary: 'Cancel an offer' })
  @ApiHeader({ name: 'x-wallet-address', description: 'Wallet address of the seller' })
  async cancelOffer(
    @Param('id') id: string,
    @Headers('x-wallet-address') walletAddress: string
  ) {
    await this.p2pService.cancelOffer(id, walletAddress);
    return { success: true, message: 'Offer cancelled' };
  }

  // ============ TRADES ============

  @Post('offers/:offerId/accept')
  @ApiOperation({ summary: 'Accept an offer and start a trade' })
  async acceptOffer(@Param('offerId') offerId: string, @Body() dto: AcceptOfferDto) {
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
  @ApiOperation({ summary: 'Mark trade as paid (buyer action)' })
  @ApiHeader({ name: 'x-wallet-address', description: 'Wallet address of the buyer' })
  async markAsPaid(
    @Param('id') id: string,
    @Headers('x-wallet-address') walletAddress: string,
    @Body() body: { notes?: string }
  ) {
    return this.p2pService.updateTradeStatus(id, walletAddress, {
      status: 'PAID',
      notes: body.notes,
    });
  }

  @Patch('trades/:id/confirm')
  @ApiOperation({ summary: 'Confirm payment received and release escrow (seller action)' })
  @ApiHeader({ name: 'x-wallet-address', description: 'Wallet address of the seller' })
  async confirmTrade(
    @Param('id') id: string,
    @Headers('x-wallet-address') walletAddress: string
  ) {
    return this.p2pService.updateTradeStatus(id, walletAddress, { status: 'CONFIRMED' });
  }

  @Post('trades/:id/dispute')
  @ApiOperation({ summary: 'Open a dispute' })
  @ApiHeader({ name: 'x-wallet-address', description: 'Wallet address of the disputer' })
  async openDispute(
    @Param('id') id: string,
    @Headers('x-wallet-address') walletAddress: string,
    @Body() body: { reason: string; evidence?: string }
  ) {
    return this.p2pService.updateTradeStatus(id, walletAddress, {
      status: 'DISPUTED',
      notes: body.reason,
    });
  }

  @Patch('trades/:id/cancel')
  @ApiOperation({ summary: 'Cancel a trade (only if not yet paid)' })
  @ApiHeader({ name: 'x-wallet-address', description: 'Wallet address' })
  async cancelTrade(
    @Param('id') id: string,
    @Headers('x-wallet-address') walletAddress: string
  ) {
    return this.p2pService.updateTradeStatus(id, walletAddress, { status: 'CANCELLED' });
  }

  // ============ REPUTATION ============

  @Get('users/:walletAddress/reputation')
  @ApiOperation({ summary: 'Get user reputation' })
  async getReputation(@Param('walletAddress') walletAddress: string) {
    return this.p2pService.getReputation(walletAddress);
  }

  // ============ ESCROW ============

  @Post('trades/:id/lock-escrow')
  @ApiOperation({ summary: 'Lock funds in escrow' })
  async lockEscrow(@Param('id') id: string) {
    const escrowTx = await this.p2pService.lockEscrow(id);
    return { success: true, escrowTx };
  }
}
