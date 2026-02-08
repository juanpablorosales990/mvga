import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { TopUpController } from './topup.controller';
import { TopUpService } from './topup.service';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [TopUpController],
  providers: [TopUpService],
})
export class TopUpModule {}
