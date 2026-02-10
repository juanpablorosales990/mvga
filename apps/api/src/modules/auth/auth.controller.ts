import { Controller, Post, Get, Put, Body, Param, Res, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { NonceDto, VerifyDto, UpdateProfileDto } from './auth.dto';

const COOKIE_NAME = 'mvga_auth';
const IS_PROD = process.env.NODE_ENV === 'production';

function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/api',
    maxAge: 24 * 60 * 60 * 1000,
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
    return { authenticated: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get current auth status and profile' })
  async me(@Req() req: Request) {
    const user = (req as Request & { user: { id: string; wallet: string } }).user;
    const profile = await this.authService.getProfile(user.id);
    return {
      authenticated: true,
      wallet: user.wallet,
      email: profile?.email ?? null,
      displayName: profile?.displayName ?? null,
      username: profile?.username ?? null,
    };
  }

  @Put('profile')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Update user profile (email, display name, username)' })
  async updateProfile(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    const user = (req as Request & { user: { id: string } }).user;
    return this.authService.updateProfile(user.id, dto);
  }

  @Get('check-username/:username')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Check if a username is available' })
  async checkUsername(@Param('username') username: string) {
    return this.authService.checkUsername(username);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Clear auth cookie' })
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'lax',
      path: '/api',
    });
    return { authenticated: false };
  }
}
