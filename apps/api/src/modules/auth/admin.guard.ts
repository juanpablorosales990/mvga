import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { ROLES_KEY } from './roles.decorator';

// Valid roles — enforced at guard level since Prisma stores role as String
const VALID_ROLES = ['USER', 'ADMIN'] as const;

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly adminWalletWhitelist: string[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService
  ) {
    // Optional hardcoded admin wallet whitelist from env (comma-separated)
    const whitelist = this.config.get<string>('ADMIN_WALLET_WHITELIST', '');
    this.adminWalletWhitelist = whitelist ? whitelist.split(',').map((w) => w.trim()) : [];
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Default to requiring ADMIN if no @Roles() decorator is present
    const roles = requiredRoles ?? ['ADMIN'];

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.wallet) {
      throw new ForbiddenException('Authentication required');
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { walletAddress: user.wallet },
      select: { role: true },
    });

    if (!dbUser || !roles.includes(dbUser.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // Validate role is a known value (defense against DB tampering)
    if (!(VALID_ROLES as readonly string[]).includes(dbUser.role)) {
      throw new ForbiddenException('Invalid role');
    }

    // If admin wallet whitelist is configured, enforce it for ADMIN role
    if (
      roles.includes('ADMIN') &&
      this.adminWalletWhitelist.length > 0 &&
      !this.adminWalletWhitelist.includes(user.wallet)
    ) {
      throw new ForbiddenException('Wallet not authorized for admin access');
    }

    return true;
  }
}
