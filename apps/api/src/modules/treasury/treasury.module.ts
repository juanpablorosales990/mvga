import { Module } from '@nestjs/common';
import { TreasuryService } from './treasury.service';
import { TreasuryController } from './treasury.controller';
import { WalletModule } from '../wallet/wallet.module';
import { BurnModule } from '../burn/burn.module';
import { StakingModule } from '../staking/staking.module';

@Module({
  imports: [WalletModule, BurnModule, StakingModule],
  controllers: [TreasuryController],
  providers: [TreasuryService],
  exports: [TreasuryService],
})
export class TreasuryModule {}
