import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../common/prisma.service';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector
  ) {}

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

    return true;
  }
}
