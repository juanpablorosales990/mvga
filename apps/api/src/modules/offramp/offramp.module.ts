import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { KycModule } from '../kyc/kyc.module';
import { OfframpController } from './offramp.controller';
import { OfframpService } from './offramp.service';

@Module({
  imports: [ConfigModule, AuthModule, KycModule],
  controllers: [OfframpController],
  providers: [OfframpService],
})
export class OfframpModule {}
