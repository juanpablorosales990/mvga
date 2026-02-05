import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TransactionLoggerService } from './transaction-logger.service';

@Global()
@Module({
  providers: [PrismaService, TransactionLoggerService],
  exports: [PrismaService, TransactionLoggerService],
})
export class PrismaModule {}
