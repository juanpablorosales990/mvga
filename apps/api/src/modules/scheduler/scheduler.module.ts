import { Module, forwardRef } from '@nestjs/common';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { SchedulerCronService } from './scheduler-cron.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SwapModule } from '../swap/swap.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [AuthModule, NotificationsModule, SwapModule, forwardRef(() => WalletModule)],
  controllers: [SchedulerController],
  providers: [SchedulerService, SchedulerCronService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
