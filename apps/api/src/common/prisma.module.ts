import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TransactionLoggerService } from './transaction-logger.service';
import { CronLockService } from './cron-lock.service';

@Global()
@Module({
  providers: [PrismaService, TransactionLoggerService, CronLockService],
  exports: [PrismaService, TransactionLoggerService, CronLockService],
})
export class PrismaModule {}
