import { Module } from '@nestjs/common';
import { StakingController } from './staking.controller';
import { StakingService } from './staking.service';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [StakingController],
  providers: [StakingService],
})
export class StakingModule {}
