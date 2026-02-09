import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { OfframpController } from './offramp.controller';
import { OfframpService } from './offramp.service';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [OfframpController],
  providers: [OfframpService],
})
export class OfframpModule {}
