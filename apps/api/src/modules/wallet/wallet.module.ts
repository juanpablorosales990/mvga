import { Module, forwardRef } from '@nestjs/common';
import { SwapModule } from '../swap/swap.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { SolanaService } from './solana.service';

@Module({
  imports: [forwardRef(() => SwapModule)],
  controllers: [WalletController],
  providers: [WalletService, SolanaService],
  exports: [WalletService, SolanaService],
})
export class WalletModule {}
