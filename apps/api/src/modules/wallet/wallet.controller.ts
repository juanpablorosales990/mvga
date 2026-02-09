import { Controller, Get, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { WalletService } from './wallet.service';
import { TransactionLoggerService } from '../../common/transaction-logger.service';
import { ParseSolanaAddressPipe } from '../../common/validators/solana-address.validator';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';

@ApiTags('Wallet')
@Throttle({ default: { ttl: 60000, limit: 30 } })
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly txLogger: TransactionLoggerService
  ) {}

  @Get(':address/balances')
  @ApiOperation({ summary: 'Get token balances for a wallet address' })
  @ApiParam({ name: 'address', description: 'Solana wallet address' })
  async getBalances(@Param('address', ParseSolanaAddressPipe) address: string) {
    return this.walletService.getBalances(address);
  }

  @Get(':address/transactions')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get transaction history for a wallet address' })
  @ApiParam({ name: 'address', description: 'Solana wallet address' })
  async getTransactions(
    @Param('address', ParseSolanaAddressPipe) address: string,
    @CurrentUser('wallet') wallet: string
  ) {
    if (address !== wallet) {
      throw new ForbiddenException("Cannot view other users' transactions");
    }
    return this.walletService.getTransactions(address);
  }

  @Get('prices')
  @ApiOperation({ summary: 'Get current token prices' })
  async getPrices() {
    return this.walletService.getPrices();
  }

  @Get(':address/transaction-log')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get MVGA transaction log (staking, escrow, etc.)' })
  @ApiParam({ name: 'address', description: 'Solana wallet address' })
  async getTransactionLog(
    @Param('address', ParseSolanaAddressPipe) address: string,
    @CurrentUser('wallet') wallet: string
  ) {
    if (address !== wallet) {
      throw new ForbiddenException("Cannot view other users' transaction log");
    }
    return this.txLogger.getByWallet(address);
  }
}
