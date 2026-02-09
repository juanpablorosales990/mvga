import { Module } from '@nestjs/common';
import { BankingController } from './banking.controller';
import { BankingService } from './banking.service';
import { RainAdapter } from './rain.adapter';
import { AuthModule } from '../auth/auth.module';
import { KycModule } from '../kyc/kyc.module';

@Module({
  imports: [AuthModule, KycModule],
  controllers: [BankingController],
  providers: [BankingService, RainAdapter],
  exports: [BankingService],
})
export class BankingModule {}
