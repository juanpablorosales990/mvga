import { Module } from '@nestjs/common';
import { GrantsController } from './grants.controller';
import { GrantsService } from './grants.service';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [AuthModule, WalletModule],
  controllers: [GrantsController],
  providers: [GrantsService],
  exports: [GrantsService],
})
export class GrantsModule {}
