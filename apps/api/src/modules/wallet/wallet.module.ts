import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SwapModule } from '../swap/swap.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { SolanaService } from './solana.service';

@Module({
  imports: [AuthModule, forwardRef(() => SwapModule)],
  controllers: [WalletController],
  providers: [WalletService, SolanaService],
  exports: [WalletService, SolanaService],
})
export class WalletModule {}
