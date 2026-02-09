import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { PersonaAdapter } from './persona.adapter';
import { KycGuard } from './kyc.guard';

@Module({
  imports: [AuthModule],
  controllers: [KycController],
  providers: [KycService, PersonaAdapter, KycGuard],
  exports: [KycService, KycGuard],
})
export class KycModule {}
