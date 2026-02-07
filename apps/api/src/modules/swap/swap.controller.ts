import { Controller, Post, Body, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { SwapService } from './swap.service';
import { QuoteDto, SwapDto, RecordSwapDto } from './swap.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';

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
  @ApiQuery({ name: 'mints', description: 'Comma-separated token mint addresses', required: true })
  async getPrices(@Query('mints') mints: string) {
    if (!mints) {
      throw new BadRequestException('mints query parameter is required');
    }
    const mintArray = mints
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    if (mintArray.length === 0) {
      throw new BadRequestException('At least one mint address is required');
    }
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

  @Post('record')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record completed swap for fee tracking' })
  async recordSwap(@Body() dto: RecordSwapDto, @CurrentUser('wallet') wallet: string) {
    dto.walletAddress = wallet;
    return this.swapService.recordSwap(dto);
  }

  @Get('fee-info')
  @ApiOperation({ summary: 'Get platform fee information with optional tier benefits' })
  @ApiQuery({
    name: 'wallet',
    description: 'Wallet address for tier-based fee calculation',
    required: false,
  })
  async getFeeInfo(@Query('wallet') wallet?: string) {
    const feeDetails = await this.swapService.getFeeDetails(wallet);
    return {
      ...feeDetails,
      message: '0.1% of each swap goes to the MVGA community treasury',
      distribution: {
        liquidity: '40% - Strengthens MVGA price floor',
        staking: '40% - Rewards for MVGA stakers',
        grants: '20% - Funds Venezuelan businesses',
      },
    };
  }
}
