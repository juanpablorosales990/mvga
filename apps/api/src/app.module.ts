import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WalletModule } from './modules/wallet/wallet.module';
import { StakingModule } from './modules/staking/staking.module';
import { SwapModule } from './modules/swap/swap.module';
import { P2PModule } from './modules/p2p/p2p.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    WalletModule,
    StakingModule,
    SwapModule,
    P2PModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
