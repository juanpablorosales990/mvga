import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../wallet/wallet.module';
import { GiftCardController } from './giftcard.controller';
import { GiftCardService } from './giftcard.service';
import { BitrefillAdapter } from './bitrefill.adapter';

@Module({
  imports: [ConfigModule, AuthModule, WalletModule],
  controllers: [GiftCardController],
  providers: [GiftCardService, BitrefillAdapter],
})
export class GiftCardModule {}
