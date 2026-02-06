import { Module } from '@nestjs/common';
import { BankingController } from './banking.controller';
import { BankingService } from './banking.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [BankingController],
  providers: [BankingService],
})
export class BankingModule {}
