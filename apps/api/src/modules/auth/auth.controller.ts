import { Controller, Post, Get, Body, Res, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { NonceDto, VerifyDto } from './auth.dto';

const COOKIE_NAME = 'mvga_auth';
const IS_PROD = process.env.NODE_ENV === 'production';

function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    // All MVGA properties are under the same "site" (mvga.io), so we don't need SameSite=None.
    // Using Lax reduces CSRF risk while still allowing normal same-site API calls from app.mvga.io -> api.mvga.io.
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24h — matches JWT expiry
  });
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('nonce')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Request a nonce for wallet signature authentication' })
  async getNonce(@Body() dto: NonceDto) {
    return this.authService.generateNonce(dto.walletAddress);
  }

  @Post('verify')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify wallet signature and receive JWT (sets httpOnly cookie)' })
  async verify(@Body() dto: VerifyDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken } = await this.authService.verify(dto.walletAddress, dto.signature);
    setAuthCookie(res, accessToken);
    // Return empty success — token is in httpOnly cookie, not exposed to JS
    return { authenticated: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Check current auth status' })
  async me(@Req() req: Request) {
    const user = (req as Request & { user: { wallet: string } }).user;
    return { authenticated: true, wallet: user.wallet };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Clear auth cookie' })
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'lax',
      path: '/',
    });
    return { authenticated: false };
  }
}
