import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SwapService, SwapQuoteRequest, SwapExecuteRequest } from './swap.service';
import { QuoteDto, SwapDto } from './swap.dto';

@ApiTags('Swap')
@Controller('swap')
export class SwapController {
  constructor(private readonly swapService: SwapService) {}

  @Post('quote')
  @ApiOperation({ summary: 'Get swap quote from Jupiter' })
  async getQuote(@Body() dto: QuoteDto) {
    return this.swapService.getQuote(dto);
  }

  @Post('transaction')
  @ApiOperation({ summary: 'Get swap transaction to sign' })
  async getSwapTransaction(@Body() dto: SwapDto) {
    return this.swapService.getSwapTransaction(dto);
  }

  @Get('price')
  @ApiOperation({ summary: 'Get token price' })
  @ApiQuery({ name: 'mint', description: 'Token mint address' })
  async getPrice(@Query('mint') mint: string) {
    const price = await this.swapService.getTokenPrice(mint);
    return { mint, price };
  }

  @Get('prices')
  @ApiOperation({ summary: 'Get multiple token prices' })
  @ApiQuery({ name: 'mints', description: 'Comma-separated token mint addresses' })
  async getPrices(@Query('mints') mints: string) {
    const mintArray = mints.split(',').map((m) => m.trim());
    const prices = await this.swapService.getMultipleTokenPrices(mintArray);
    return prices;
  }

  @Get('tokens')
  @ApiOperation({ summary: 'Get supported token list' })
  getTokens() {
    return {
      SOL: {
        mint: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
      },
      USDC: {
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
      },
      USDT: {
        mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 6,
      },
      MVGA: {
        mint: 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh',
        symbol: 'MVGA',
        name: 'Make Venezuela Great Again',
        decimals: 9,
      },
    };
  }
}
