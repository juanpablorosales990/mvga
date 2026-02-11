import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CronLockService } from '../../common/cron-lock.service';
import { PriceAlertsService } from './price-alerts.service';

@Injectable()
export class PriceAlertsCronService {
  private readonly logger = new Logger(PriceAlertsCronService.name);

  constructor(
    private readonly cronLock: CronLockService,
    private readonly priceAlertsService: PriceAlertsService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  @Cron('*/5 * * * *') // Every 5 minutes
  async checkPriceAlerts() {
    const lockId = await this.cronLock.acquireLock('check-price-alerts', 240_000);
    if (!lockId) {
      this.logger.debug('Price alerts: another instance holds the lock');
      return;
    }

    try {
      const events = await this.priceAlertsService.getTriggeredAlertEvents();

      for (const event of events) {
        this.eventEmitter.emit('price.alert.triggered', event);
      }

      if (events.length > 0) {
        this.logger.log(`Triggered ${events.length} price alert(s)`);
      }
    } catch (err) {
      this.logger.error('Error checking price alerts:', err);
    } finally {
      await this.cronLock.releaseLock(lockId);
    }
  }
}
