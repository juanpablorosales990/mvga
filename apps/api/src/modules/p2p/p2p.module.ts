import { Module } from '@nestjs/common';
import { P2PController } from './p2p.controller';
import { P2PService } from './p2p.service';
import { P2PTimeoutService } from './p2p-timeout.service';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [AuthModule, WalletModule],
  controllers: [P2PController],
  providers: [P2PService, P2PTimeoutService],
  exports: [P2PService],
})
export class P2PModule {}
