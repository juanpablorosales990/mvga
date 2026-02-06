import { Module } from '@nestjs/common';
import { SwapController } from './swap.controller';
import { SwapService } from './swap.service';
import { AuthModule } from '../auth/auth.module';
import { TiersModule } from '../tiers/tiers.module';

@Module({
  imports: [AuthModule, TiersModule],
  controllers: [SwapController],
  providers: [SwapService],
  exports: [SwapService],
})
export class SwapModule {}
