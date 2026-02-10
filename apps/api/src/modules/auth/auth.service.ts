import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { CronLockService } from '../../common/cron-lock.service';
import * as nacl from 'tweetnacl';
import * as bs58 from 'bs58';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly cronLockService: CronLockService
  ) {}

  @Cron('*/5 * * * *')
  async cleanupExpiredNonces() {
    const lockId = await this.cronLockService.acquireLock('nonce-cleanup', 60_000);
    if (!lockId) return;

    try {
      const result = await this.prisma.authNonce.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            // AuthNonce doesn't have updatedAt; createdAt is sufficient for pruning
            // old used nonces (they're single-use anyway).
            { used: true, createdAt: { lt: new Date(Date.now() - 60_000) } },
          ],
        },
      });
      if (result.count > 0) {
        this.logger.debug(`Cleaned up ${result.count} expired/used nonces`);
      }
    } finally {
      await this.cronLockService.releaseLock(lockId);
    }
  }

  async generateNonce(walletAddress: string): Promise<{ nonce: string; message: string }> {
    const nonce = crypto.randomBytes(32).toString('hex');
    const message = `Sign this message to authenticate with MVGA.\n\nWallet: ${walletAddress}\nNonce: ${nonce}`;

    // Upsert — replaces any existing nonce for this wallet
    await this.prisma.authNonce.upsert({
      where: { walletAddress },
      update: {
        nonce,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        used: false,
      },
      create: {
        walletAddress,
        nonce,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    return { nonce, message };
  }

  async verify(walletAddress: string, signature: string): Promise<{ accessToken: string }> {
    // Atomically claim the nonce (prevents TOCTOU race — concurrent requests
    // both reading used=false before either marks it used)
    const claimed = await this.prisma.authNonce.updateMany({
      where: { walletAddress, used: false, expiresAt: { gt: new Date() } },
      data: { used: true },
    });

    if (claimed.count === 0) {
      // Could be: no nonce, already used, or expired — check which
      const stored = await this.prisma.authNonce.findUnique({
        where: { walletAddress },
      });
      if (!stored) {
        throw new UnauthorizedException('No nonce found. Request a nonce first.');
      }
      if (stored.used) {
        throw new UnauthorizedException('Nonce already used. Request a new one.');
      }
      await this.prisma.authNonce.delete({ where: { id: stored.id } });
      throw new UnauthorizedException('Nonce expired. Request a new one.');
    }

    // Nonce is now atomically claimed — fetch it for signature verification
    const stored = await this.prisma.authNonce.findUnique({
      where: { walletAddress },
    });

    const message = `Sign this message to authenticate with MVGA.\n\nWallet: ${walletAddress}\nNonce: ${stored!.nonce}`;
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.default.decode(signature);
    const publicKeyBytes = bs58.default.decode(walletAddress);

    const verified = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

    if (!verified) {
      // Nonce stays consumed — user must request a fresh nonce to retry
      throw new UnauthorizedException('Invalid signature');
    }

    // Upsert user in database
    const user = await this.prisma.user.upsert({
      where: { walletAddress },
      update: {},
      create: { walletAddress },
    });

    const accessToken = this.jwt.sign({
      sub: user.id,
      wallet: walletAddress,
    });

    return { accessToken };
  }

  validateToken(token: string) {
    try {
      return this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true, email: true, displayName: true, username: true },
    });
    return user;
  }

  async updateProfile(
    userId: string,
    dto: { email?: string; displayName?: string; username?: string }
  ) {
    try {
      const data: Record<string, string> = {};
      if (dto.email !== undefined) data.email = dto.email;
      if (dto.displayName !== undefined) data.displayName = dto.displayName;
      if (dto.username !== undefined) data.username = dto.username.toLowerCase();

      const user = await this.prisma.user.update({
        where: { id: userId },
        data,
        select: { walletAddress: true, email: true, displayName: true, username: true },
      });
      return user;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = (e.meta?.target as string[]) ?? [];
        if (target.includes('email')) {
          throw new ConflictException('Email already in use');
        }
        if (target.includes('username')) {
          throw new ConflictException('Username already taken');
        }
        throw new ConflictException('Value already in use');
      }
      throw e;
    }
  }

  async checkUsername(username: string): Promise<{ available: boolean }> {
    const existing = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true },
    });
    return { available: !existing };
  }
}
