import { Module } from '@nestjs/common';
import { BurnService } from './burn.service';
import { BurnController } from './burn.controller';
import { PrismaModule } from '../../common/prisma.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [PrismaModule, WalletModule],
  controllers: [BurnController],
  providers: [BurnService],
  exports: [BurnService],
})
export class BurnModule {}
