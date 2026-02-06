import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './common/prisma.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { StakingModule } from './modules/staking/staking.module';
import { SwapModule } from './modules/swap/swap.module';
import { P2PModule } from './modules/p2p/p2p.module';
import { GrantsModule } from './modules/grants/grants.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { AuthModule } from './modules/auth/auth.module';
import { TreasuryModule } from './modules/treasury/treasury.module';
import { BurnModule } from './modules/burn/burn.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { BankingModule } from './modules/banking/banking.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    WalletModule,
    StakingModule,
    SwapModule,
    P2PModule,
    GrantsModule,
    ReferralsModule,
    TreasuryModule,
    BurnModule,
    MetricsModule,
    BankingModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
