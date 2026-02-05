import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma.service';
import * as nacl from 'tweetnacl';
import * as bs58 from 'bs58';

@Injectable()
export class AuthService {
  // In-memory nonce store with TTL (5 minutes)
  private nonces = new Map<string, { nonce: string; expiresAt: number }>();

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  generateNonce(walletAddress: string): { nonce: string; message: string } {
    const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const message = `Sign this message to authenticate with MVGA.\n\nWallet: ${walletAddress}\nNonce: ${nonce}`;

    this.nonces.set(walletAddress, {
      nonce,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    return { nonce, message };
  }

  async verify(
    walletAddress: string,
    signature: string,
  ): Promise<{ accessToken: string }> {
    const stored = this.nonces.get(walletAddress);
    if (!stored) {
      throw new UnauthorizedException('No nonce found. Request a nonce first.');
    }

    if (Date.now() > stored.expiresAt) {
      this.nonces.delete(walletAddress);
      throw new UnauthorizedException('Nonce expired. Request a new one.');
    }

    const message = `Sign this message to authenticate with MVGA.\n\nWallet: ${walletAddress}\nNonce: ${stored.nonce}`;
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.default.decode(signature);
    const publicKeyBytes = bs58.default.decode(walletAddress);

    const verified = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes,
    );

    if (!verified) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Clean up nonce
    this.nonces.delete(walletAddress);

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
