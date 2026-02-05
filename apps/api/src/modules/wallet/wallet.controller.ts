import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { TransactionLoggerService } from '../../common/transaction-logger.service';
import { ParseSolanaAddressPipe } from '../../common/validators/solana-address.validator';

@ApiTags('Wallet')
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
  @ApiOperation({ summary: 'Get transaction history for a wallet address' })
  @ApiParam({ name: 'address', description: 'Solana wallet address' })
  async getTransactions(@Param('address', ParseSolanaAddressPipe) address: string) {
    return this.walletService.getTransactions(address);
  }

  @Get('prices')
  @ApiOperation({ summary: 'Get current token prices' })
  async getPrices() {
    return this.walletService.getPrices();
  }

  @Get(':address/transaction-log')
  @ApiOperation({ summary: 'Get MVGA transaction log (staking, escrow, etc.)' })
  @ApiParam({ name: 'address', description: 'Solana wallet address' })
  async getTransactionLog(@Param('address', ParseSolanaAddressPipe) address: string) {
    return this.txLogger.getByWallet(address);
  }
}
