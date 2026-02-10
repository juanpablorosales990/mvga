import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { SolanaService } from '../wallet/solana.service';
import { randomUUID } from 'crypto';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

interface ReloadlyToken {
  accessToken: string;
  expiresAt: number;
}

export interface ReloadlyOperator {
  operatorId: number;
  name: string;
  denominationType: string;
  minAmount: number | null;
  maxAmount: number | null;
  fixedAmounts: number[];
  suggestedAmounts: number[];
  country: { isoName: string; name: string };
}

@Injectable()
export class TopUpService {
  private readonly logger = new Logger(TopUpService.name);
  private token: ReloadlyToken | null = null;
  private readonly baseUrl: string;
  private readonly authUrl = 'https://auth.reloadly.com/oauth/token';

  private readonly USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  private readonly USDC_DECIMALS = 6;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly solana: SolanaService
  ) {
    const isSandbox = this.config.get('RELOADLY_SANDBOX') !== 'false';
    this.baseUrl = isSandbox
      ? 'https://topups-sandbox.reloadly.com'
      : 'https://topups.reloadly.com';
  }

  get isEnabled(): boolean {
    const clientId = this.config.get('RELOADLY_CLIENT_ID');
    const clientSecret = this.config.get('RELOADLY_CLIENT_SECRET');
    const treasuryWallet = this.config.get('TREASURY_WALLET');
    return Boolean(clientId && clientSecret && treasuryWallet);
  }

  getStatus() {
    const treasuryWallet = this.config.get<string>('TREASURY_WALLET');
    return {
      enabled: this.isEnabled,
      usdcMint: this.USDC_MINT.toBase58(),
      treasuryWallet: this.isEnabled ? treasuryWallet : undefined,
    };
  }

  private amountToRaw(amount: number): bigint {
    // Amount is validated by DTO; still defensively clamp and round.
    const factor = 10 ** this.USDC_DECIMALS;
    return BigInt(Math.round(amount * factor));
  }

  private async verifyTreasuryPayment(params: {
    signature: string;
    fromWallet: string;
    toTreasuryWallet: string;
    minAmountUsd: number;
  }) {
    const { signature, fromWallet, toTreasuryWallet, minAmountUsd } = params;

    const fromOwner = new PublicKey(fromWallet);
    const toOwner = new PublicKey(toTreasuryWallet);
    const expectedSource = await getAssociatedTokenAddress(this.USDC_MINT, fromOwner);
    const expectedDest = await getAssociatedTokenAddress(this.USDC_MINT, toOwner);
    const minRaw = this.amountToRaw(minAmountUsd);

    const conn = this.solana.getConnection();
    const tx = await conn.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
      throw new BadRequestException('Payment transaction not found');
    }
    if (tx.meta?.err) {
      throw new BadRequestException('Payment transaction failed');
    }

    const instructions = tx.transaction.message.instructions as Array<any>;
    let paidRaw = 0n;

    for (const ix of instructions) {
      if (ix?.program !== 'spl-token') continue;
      const parsed = ix?.parsed;
      const info = parsed?.info;
      if (!info) continue;

      const source = String(info.source || '');
      const destination = String(info.destination || '');
      const authority = info.authority ? String(info.authority) : '';
      const mint = info.mint ? String(info.mint) : '';

      // Ensure this is a USDC transfer from the user's ATA to the treasury ATA.
      if (source !== expectedSource.toBase58()) continue;
      if (destination !== expectedDest.toBase58()) continue;
      if (authority && authority !== fromOwner.toBase58()) continue;
      if (mint && mint !== this.USDC_MINT.toBase58()) continue;

      const rawStr =
        typeof info.amount === 'string'
          ? info.amount
          : typeof info?.tokenAmount?.amount === 'string'
            ? info.tokenAmount.amount
            : null;
      if (!rawStr) continue;

      try {
        paidRaw += BigInt(rawStr);
      } catch {
        // ignore malformed
      }
    }

    if (paidRaw < minRaw) {
      throw new BadRequestException('Insufficient payment amount');
    }

    return { paidRaw };
  }

  private tokenRefreshPromise: Promise<string> | null = null;

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5min buffer)
    if (this.token && this.token.expiresAt > Date.now() + 300_000) {
      return this.token.accessToken;
    }

    // Deduplicate concurrent token refresh requests
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    this.tokenRefreshPromise = this.refreshToken();
    try {
      return await this.tokenRefreshPromise;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  private async refreshToken(): Promise<string> {
    const clientId = this.config.get('RELOADLY_CLIENT_ID');
    const clientSecret = this.config.get('RELOADLY_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Reloadly not configured');
    }

    const isSandbox = this.config.get('RELOADLY_SANDBOX') !== 'false';
    const audience = isSandbox
      ? 'https://topups-sandbox.reloadly.com'
      : 'https://topups.reloadly.com';

    const res = await fetch(this.authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        audience,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Reloadly auth failed: ${err}`);
      throw new BadRequestException('Failed to authenticate with Reloadly');
    }

    const data = await res.json();
    this.token = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    this.logger.log('Reloadly token refreshed');
    return this.token.accessToken;
  }

  private async reloadlyGet(path: string) {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/com.reloadly.topups-v1+json',
      },
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Reloadly GET ${path} failed: ${err}`);
      throw new BadRequestException('Reloadly request failed');
    }

    return res.json();
  }

  private async reloadlyPost(path: string, body: Record<string, unknown>) {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/com.reloadly.topups-v1+json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Reloadly POST ${path} failed: ${err}`);
      throw new BadRequestException('Reloadly request failed');
    }

    return res.json();
  }

  /** Get all operators for a country */
  async getOperators(countryCode: string): Promise<ReloadlyOperator[]> {
    return this.reloadlyGet(`/operators/countries/${countryCode}`);
  }

  /** Auto-detect operator by phone number */
  async detectOperator(phone: string, countryCode: string): Promise<ReloadlyOperator> {
    return this.reloadlyGet(
      `/operators/auto-detect/phone/${phone}/countries/${countryCode}?suggestedAmounts=true`
    );
  }

  /** Execute a top-up */
  async topUp(
    walletAddress: string,
    phone: string,
    countryCode: string,
    operatorId: number,
    amountUsd: number,
    paymentSignature: string
  ) {
    if (!this.isEnabled) {
      throw new BadRequestException('Top-ups are not available');
    }

    const treasuryWallet = this.config.get<string>('TREASURY_WALLET');
    if (!treasuryWallet) {
      throw new BadRequestException('Treasury wallet not configured');
    }

    // Check idempotency FIRST to avoid redundant RPC calls.
    const customIdentifier = `mvga-usdc-${paymentSignature}`;
    const existing = await this.prisma.topUp.findFirst({
      where: { customIdentifier },
    });
    if (existing) {
      return {
        id: existing.id,
        status: existing.status,
        operatorName: existing.operatorName,
        amountUsd: existing.amountUsd,
        deliveredAmount: existing.deliveredAmount,
        deliveredCurrency: existing.deliveredCurrency,
        reloadlyTxId: existing.reloadlyTxId,
      };
    }

    await this.verifyTreasuryPayment({
      signature: paymentSignature,
      fromWallet: walletAddress,
      toTreasuryWallet: treasuryWallet,
      minAmountUsd: amountUsd,
    });

    // Create DB record first (PENDING)
    const topup = await this.prisma.topUp.create({
      data: {
        userId: walletAddress,
        recipientPhone: phone,
        countryCode,
        operatorId,
        operatorName: '', // Will be updated after Reloadly response
        amountUsd,
        customIdentifier,
      },
    });

    try {
      const result = await this.reloadlyPost('/topups', {
        operatorId,
        amount: amountUsd,
        useLocalAmount: false,
        customIdentifier,
        recipientPhone: {
          countryCode,
          number: phone,
        },
      });

      // Update with success data
      await this.prisma.topUp.update({
        where: { id: topup.id },
        data: {
          status: 'SUCCESSFUL',
          reloadlyTxId: String(result.transactionId),
          operatorName: result.operatorName || '',
          deliveredAmount: result.deliveredAmount,
          deliveredCurrency: result.deliveredAmountCurrencyCode,
        },
      });

      this.logger.log(
        `Top-up successful: ${amountUsd} USD → ${result.deliveredAmount} ${result.deliveredAmountCurrencyCode} to ${phone}`
      );

      return {
        id: topup.id,
        status: 'SUCCESSFUL',
        operatorName: result.operatorName,
        amountUsd,
        deliveredAmount: result.deliveredAmount,
        deliveredCurrency: result.deliveredAmountCurrencyCode,
        reloadlyTxId: result.transactionId,
      };
    } catch (error) {
      // Mark as failed
      await this.prisma.topUp.update({
        where: { id: topup.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /** Get top-up history for a user */
  async getHistory(walletAddress: string) {
    return this.prisma.topUp.findMany({
      where: { userId: walletAddress },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  /** Get Reloadly account balance */
  async getBalance() {
    return this.reloadlyGet('/accounts/balance');
  }
}
