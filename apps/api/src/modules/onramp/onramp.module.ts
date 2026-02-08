import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { OnrampController } from './onramp.controller';
import { OnrampService } from './onramp.service';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [OnrampController],
  providers: [OnrampService],
})
export class OnrampModule {}
