import { Module } from '@nestjs/common';
import { PriceAlertsController } from './price-alerts.controller';
import { PriceAlertsService } from './price-alerts.service';
import { PriceAlertsCronService } from './price-alerts-cron.service';
import { VesRateService } from './ves-rate.service';
import { AuthModule } from '../auth/auth.module';
import { SwapModule } from '../swap/swap.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, SwapModule, NotificationsModule],
  controllers: [PriceAlertsController],
  providers: [PriceAlertsService, PriceAlertsCronService, VesRateService],
  exports: [PriceAlertsService, VesRateService],
})
export class PriceAlertsModule {}
