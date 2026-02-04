import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { WalletService } from './wallet.service';

@ApiTags('Wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get(':address/balances')
  @ApiOperation({ summary: 'Get token balances for a wallet address' })
  @ApiParam({ name: 'address', description: 'Solana wallet address' })
  async getBalances(@Param('address') address: string) {
    return this.walletService.getBalances(address);
  }

  @Get(':address/transactions')
  @ApiOperation({ summary: 'Get transaction history for a wallet address' })
  @ApiParam({ name: 'address', description: 'Solana wallet address' })
  async getTransactions(@Param('address') address: string) {
    return this.walletService.getTransactions(address);
  }

  @Get('prices')
  @ApiOperation({ summary: 'Get current token prices' })
  async getPrices() {
    return this.walletService.getPrices();
  }
}
