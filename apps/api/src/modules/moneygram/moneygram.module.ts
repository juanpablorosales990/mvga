import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { KycModule } from '../kyc/kyc.module';
import { MoneygramController } from './moneygram.controller';
import { MoneygramService } from './moneygram.service';
import { StellarAdapter } from './stellar.adapter';
import { AllbridgeAdapter } from './allbridge.adapter';

@Module({
  imports: [ConfigModule, AuthModule, KycModule],
  controllers: [MoneygramController],
  providers: [MoneygramService, StellarAdapter, AllbridgeAdapter],
  exports: [MoneygramService],
})
export class MoneygramModule {}
