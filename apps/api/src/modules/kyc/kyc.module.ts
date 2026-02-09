import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { SumsubAdapter } from './sumsub.adapter';
import { PersonaAdapter } from './persona.adapter';
import { KycGuard } from './kyc.guard';

@Module({
  imports: [AuthModule],
  controllers: [KycController],
  providers: [KycService, SumsubAdapter, PersonaAdapter, KycGuard],
  exports: [KycService, KycGuard],
})
export class KycModule {}
