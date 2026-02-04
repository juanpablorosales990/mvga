import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { SolanaService } from './solana.service';

@Module({
  controllers: [WalletController],
  providers: [WalletService, SolanaService],
  exports: [WalletService, SolanaService],
})
export class WalletModule {}
