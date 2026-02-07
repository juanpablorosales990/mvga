import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
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
          OR: [{ expiresAt: { lt: new Date() } }, { used: true }],
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
    const stored = await this.prisma.authNonce.findUnique({
      where: { walletAddress },
    });

    if (!stored || stored.used) {
      throw new UnauthorizedException('No nonce found. Request a nonce first.');
    }

    if (new Date() > stored.expiresAt) {
      await this.prisma.authNonce.delete({ where: { id: stored.id } });
      throw new UnauthorizedException('Nonce expired. Request a new one.');
    }

    const message = `Sign this message to authenticate with MVGA.\n\nWallet: ${walletAddress}\nNonce: ${stored.nonce}`;
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.default.decode(signature);
    const publicKeyBytes = bs58.default.decode(walletAddress);

    const verified = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

    if (!verified) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Mark nonce as used (atomic — prevents replay)
    await this.prisma.authNonce.update({
      where: { id: stored.id },
      data: { used: true },
    });

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
}
