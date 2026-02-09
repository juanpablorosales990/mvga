import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../wallet/wallet.module';
import { TopUpController } from './topup.controller';
import { TopUpService } from './topup.service';

@Module({
  imports: [ConfigModule, AuthModule, WalletModule],
  controllers: [TopUpController],
  providers: [TopUpService],
})
export class TopUpModule {}
