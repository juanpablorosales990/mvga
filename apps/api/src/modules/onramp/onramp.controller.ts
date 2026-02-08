import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OnrampService } from './onramp.service';

@ApiTags('Onramp')
@Controller('onramp')
export class OnrampController {
  constructor(private readonly onrampService: OnrampService) {}

  @Post('session')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async createSession(@CurrentUser('wallet') wallet: string) {
    return this.onrampService.createSession(wallet);
  }
}
