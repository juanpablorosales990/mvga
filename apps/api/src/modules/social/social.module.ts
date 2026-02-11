import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SocialController],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}
