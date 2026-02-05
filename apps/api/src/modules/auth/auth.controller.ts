import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('nonce')
  @ApiOperation({ summary: 'Request a nonce for wallet signature authentication' })
  getNonce(@Body() body: { walletAddress: string }) {
    return this.authService.generateNonce(body.walletAddress);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify wallet signature and receive JWT' })
  async verify(@Body() body: { walletAddress: string; signature: string }) {
    return this.authService.verify(body.walletAddress, body.signature);
  }
}
