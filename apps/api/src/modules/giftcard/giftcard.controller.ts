import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { GiftCardService } from './giftcard.service';
import { GetProductsDto, PurchaseGiftCardDto } from './giftcard.dto';

@ApiTags('GiftCard')
@Controller('giftcard')
export class GiftCardController {
  constructor(private readonly giftCardService: GiftCardService) {}

  @Get('status')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  getStatus() {
    return this.giftCardService.getStatus();
  }

  @Get('products')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async getProducts(@Query() dto: GetProductsDto) {
    return this.giftCardService.getProducts(dto.category);
  }

  @Post('purchase')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async purchase(@CurrentUser('wallet') wallet: string, @Body() dto: PurchaseGiftCardDto) {
    return this.giftCardService.purchase(wallet, dto.productId, dto.amount, dto.paymentSignature);
  }

  @Get('order/:id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async getOrder(@CurrentUser('wallet') wallet: string, @Param('id') id: string) {
    return this.giftCardService.getOrder(wallet, id);
  }

  @Get('history')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async getHistory(@CurrentUser('wallet') wallet: string) {
    return this.giftCardService.getHistory(wallet);
  }
}
