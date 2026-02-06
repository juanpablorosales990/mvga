import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { TransactionLoggerService } from '../../common/transaction-logger.service';
import { SolanaService } from '../wallet/solana.service';
import { Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createBurnInstruction } from '@solana/spl-token';

const MVGA_DECIMALS = 9;

@Injectable()
export class BurnService {
  private readonly logger = new Logger(BurnService.name);
  private treasuryKeypair: Keypair | null = null;
  private mvgaMint: PublicKey;

  constructor(
    private readonly prisma: PrismaService,
    private readonly txLogger: TransactionLoggerService,
    private readonly solana: SolanaService,
    private readonly config: ConfigService
  ) {
    this.mvgaMint = new PublicKey(
      this.config.get('MVGA_TOKEN_MINT', 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh')
    );

    const treasuryKeypairStr = this.config.get<string>('TREASURY_KEYPAIR');
    if (treasuryKeypairStr) {
      try {
        const decoded = Buffer.from(treasuryKeypairStr, 'base64');
        this.treasuryKeypair = Keypair.fromSecretKey(
          new Uint8Array(JSON.parse(decoded.toString()))
        );
        this.logger.log('Burn service: treasury keypair loaded');
      } catch (e) {
        this.logger.error(`TREASURY_KEYPAIR invalid for burn service: ${(e as Error).message}`);
      }
    } else {
      this.logger.warn('TREASURY_KEYPAIR not set — burns disabled');
    }
  }

  /**
   * Execute an SPL token burn from the treasury's ATA
   */
  async executeBurn(amount: bigint, source: 'WEEKLY' | 'MANUAL'): Promise<string> {
    if (!this.treasuryKeypair) {
      throw new Error('Treasury keypair not configured — cannot burn');
    }

    if (amount <= 0n) {
      throw new Error('Burn amount must be positive');
    }

    const connection = this.solana.getConnection();
    const treasuryAta = await getAssociatedTokenAddress(
      this.mvgaMint,
      this.treasuryKeypair.publicKey
    );

    const tx = new Transaction().add(
      createBurnInstruction(treasuryAta, this.mvgaMint, this.treasuryKeypair.publicKey, amount)
    );

    const signature = await sendAndConfirmTransaction(connection, tx, [this.treasuryKeypair]);

    // Record in database
    await this.prisma.tokenBurn.create({
      data: {
        amount,
        signature,
        source,
      },
    });

    // Log the transaction
    await this.txLogger.log({
      walletAddress: this.treasuryKeypair.publicKey.toBase58(),
      type: 'BURN',
      signature,
      amount: Number(amount) / 10 ** MVGA_DECIMALS,
      token: 'MVGA',
    });
    await this.txLogger.confirm(signature);

    this.logger.log(
      `Burned ${Number(amount) / 10 ** MVGA_DECIMALS} MVGA (${source}) — tx: ${signature}`
    );

    return signature;
  }

  /**
   * Get burn statistics
   */
  async getBurnStats() {
    const [aggregation, count, lastBurn] = await Promise.all([
      this.prisma.tokenBurn.aggregate({
        _sum: { amount: true },
      }),
      this.prisma.tokenBurn.count(),
      this.prisma.tokenBurn.findFirst({
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalBurned = Number(aggregation._sum.amount ?? BigInt(0)) / 10 ** MVGA_DECIMALS;

    return {
      totalBurned,
      burnCount: count,
      lastBurnAt: lastBurn?.createdAt?.toISOString() ?? null,
      lastBurnAmount: lastBurn ? Number(lastBurn.amount) / 10 ** MVGA_DECIMALS : 0,
      lastBurnTx: lastBurn?.signature ?? null,
      supplyReduction: (totalBurned / 1_000_000_000) * 100, // % of total supply
    };
  }

  /**
   * Get burn history
   */
  async getBurnHistory(limit = 10) {
    const burns = await this.prisma.tokenBurn.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return burns.map((b) => ({
      id: b.id,
      amount: Number(b.amount) / 10 ** MVGA_DECIMALS,
      signature: b.signature,
      source: b.source,
      createdAt: b.createdAt.toISOString(),
    }));
  }
}
