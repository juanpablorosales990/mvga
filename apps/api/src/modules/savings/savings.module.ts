import { Module } from '@nestjs/common';
import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';
import { KaminoAdapter } from './kamino.adapter';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [AuthModule, WalletModule],
  controllers: [SavingsController],
  providers: [SavingsService, KaminoAdapter],
  exports: [SavingsService],
})
export class SavingsModule {}
