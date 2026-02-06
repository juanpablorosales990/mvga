import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { NonceDto, VerifyDto } from './auth.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('nonce')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Request a nonce for wallet signature authentication' })
  getNonce(@Body() dto: NonceDto) {
    return this.authService.generateNonce(dto.walletAddress);
  }

  @Post('verify')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify wallet signature and receive JWT' })
  async verify(@Body() dto: VerifyDto) {
    return this.authService.verify(dto.walletAddress, dto.signature);
  }
}
