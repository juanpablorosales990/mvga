import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // 1. Try httpOnly cookie first (primary auth method)
    const cookieToken = request.cookies?.['mvga_auth'];
    // 2. Fall back to Authorization header only in development (for Swagger testing)
    let headerToken: string | null = null;
    if (process.env.NODE_ENV !== 'production') {
      const authHeader = request.headers['authorization'];
      headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    }

    const token = cookieToken || headerToken;

    if (!token) {
      throw new UnauthorizedException('Missing authentication');
    }

    const payload = this.authService.validateToken(token);

    // Attach user info to request
    request.user = {
      id: payload.sub,
      wallet: payload.wallet,
    };

    return true;
  }
}
