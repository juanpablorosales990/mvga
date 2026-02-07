import { Module, forwardRef } from '@nestjs/common';
import { SwapController } from './swap.controller';
import { SwapService } from './swap.service';
import { AuthModule } from '../auth/auth.module';
import { TiersModule } from '../tiers/tiers.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [AuthModule, TiersModule, forwardRef(() => WalletModule)],
  controllers: [SwapController],
  providers: [SwapService],
  exports: [SwapService],
})
export class SwapModule {}
