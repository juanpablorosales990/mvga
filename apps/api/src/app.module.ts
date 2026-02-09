import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
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
import { TiersModule } from './modules/tiers/tiers.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SavingsModule } from './modules/savings/savings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { TopUpModule } from './modules/topup/topup.module';
import { OnrampModule } from './modules/onramp/onramp.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { OfframpModule } from './modules/offramp/offramp.module';
import { KycModule } from './modules/kyc/kyc.module';
import { PayPalModule } from './modules/paypal/paypal.module';
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
    EventEmitterModule.forRoot(),
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
    TiersModule,
    NotificationsModule,
    SavingsModule,
    PaymentsModule,
    TopUpModule,
    OnrampModule,
    SchedulerModule,
    OfframpModule,
    KycModule,
    PayPalModule,
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
