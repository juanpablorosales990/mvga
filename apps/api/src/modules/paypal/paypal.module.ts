import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { PayPalController } from './paypal.controller';
import { PayPalService } from './paypal.service';
import { PayPalAdapter } from './paypal.adapter';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [PayPalController],
  providers: [PayPalService, PayPalAdapter],
  exports: [PayPalService],
})
export class PayPalModule {}
