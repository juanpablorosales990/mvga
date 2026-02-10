import { Module } from '@nestjs/common';
import { VesOnrampController } from './ves-onramp.controller';
import { VesOnrampService } from './ves-onramp.service';
import { VesOnrampTimeoutService } from './ves-onramp-timeout.service';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [AuthModule, WalletModule],
  controllers: [VesOnrampController],
  providers: [VesOnrampService, VesOnrampTimeoutService],
  exports: [VesOnrampService],
})
export class VesOnrampModule {}
