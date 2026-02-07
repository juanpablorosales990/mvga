import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma.service';
import { TransactionLoggerService } from '../../common/transaction-logger.service';
import { SolanaService } from '../wallet/solana.service';
import { Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';

const MVGA_DECIMALS = 9;
const BONUS_AMOUNT = 100; // 100 MVGA per referral

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);
  private treasuryKeypair: Keypair | null = null;
  private mintPubkey: PublicKey;

  constructor(
    private readonly prisma: PrismaService,
    private readonly txLogger: TransactionLoggerService,
    private readonly solana: SolanaService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.mintPubkey = new PublicKey(
      this.config.get('MVGA_TOKEN_MINT', 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh')
    );

    const treasuryKeypairStr = this.config.get<string>('TREASURY_WALLET_KEYPAIR');
    if (treasuryKeypairStr) {
      try {
        const decoded = Buffer.from(treasuryKeypairStr, 'base64');
        this.treasuryKeypair = Keypair.fromSecretKey(
          new Uint8Array(JSON.parse(decoded.toString()))
        );
        this.logger.log('Treasury keypair loaded for referral bonuses');
      } catch (e) {
        this.logger.warn(`TREASURY_WALLET_KEYPAIR invalid: ${(e as Error).message}`);
      }
    } else {
      this.logger.warn('TREASURY_WALLET_KEYPAIR not set — referral bonuses will be unavailable');
    }
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async getOrCreateCode(walletAddress: string) {
    const existing = await this.prisma.referralCode.findUnique({
      where: { walletAddress },
    });

    if (existing) {
      return { code: existing.code };
    }

    // Generate unique code
    let code: string;
    let attempts = 0;
    do {
      code = this.generateCode();
      const taken = await this.prisma.referralCode.findUnique({ where: { code } });
      if (!taken) break;
      attempts++;
    } while (attempts < 10);

    const referralCode = await this.prisma.referralCode.create({
      data: { walletAddress, code },
    });

    return { code: referralCode.code };
  }

  async claimReferral(refereeAddress: string, code: string) {
    // Validate code exists
    const referralCode = await this.prisma.referralCode.findUnique({
      where: { code },
    });

    if (!referralCode) {
      throw new BadRequestException('Invalid referral code');
    }

    // Can't refer yourself
    if (referralCode.walletAddress === refereeAddress) {
      throw new BadRequestException('Cannot use your own referral code');
    }

    // Check if referee already claimed
    const existingClaim = await this.prisma.referral.findUnique({
      where: { refereeAddress },
    });

    if (existingClaim) {
      throw new BadRequestException('Referral already claimed');
    }

    // Create referral record
    const referral = await this.prisma.referral.create({
      data: {
        referrerAddress: referralCode.walletAddress,
        refereeAddress,
        codeId: referralCode.id,
        amount: BONUS_AMOUNT,
      },
    });

    // Try to auto-pay bonus
    if (this.treasuryKeypair) {
      try {
        await this.payBonus(referral.id, referralCode.walletAddress, refereeAddress);
      } catch (e) {
        this.logger.error(`Failed to pay referral bonus: ${(e as Error).message}`);
        // Referral is recorded; bonus can be retried later
      }
    }

    return {
      referralId: referral.id,
      bonusPaid: referral.bonusPaid,
      amount: BONUS_AMOUNT,
    };
  }

  private async payBonus(referralId: string, referrerAddress: string, refereeAddress: string) {
    if (!this.treasuryKeypair) return;

    const connection = this.solana.getConnection();
    const rawAmount = BigInt(BONUS_AMOUNT * 10 ** MVGA_DECIMALS);

    const referrerPubkey = new PublicKey(referrerAddress);
    const refereePubkey = new PublicKey(refereeAddress);
    const treasuryAta = await getAssociatedTokenAddress(
      this.mintPubkey,
      this.treasuryKeypair.publicKey
    );
    const referrerAta = await getAssociatedTokenAddress(this.mintPubkey, referrerPubkey);
    const refereeAta = await getAssociatedTokenAddress(this.mintPubkey, refereePubkey);

    const tx = new Transaction();

    // Create ATAs if needed
    for (const [pubkey, ata] of [
      [referrerPubkey, referrerAta],
      [refereePubkey, refereeAta],
    ] as [PublicKey, PublicKey][]) {
      try {
        await getAccount(connection, ata);
      } catch {
        tx.add(
          createAssociatedTokenAccountInstruction(
            this.treasuryKeypair.publicKey,
            ata,
            pubkey,
            this.mintPubkey
          )
        );
      }
    }

    // Transfer to referrer
    tx.add(
      createTransferInstruction(treasuryAta, referrerAta, this.treasuryKeypair.publicKey, rawAmount)
    );
    // Transfer to referee
    tx.add(
      createTransferInstruction(treasuryAta, refereeAta, this.treasuryKeypair.publicKey, rawAmount)
    );

    const sig = await sendAndConfirmTransaction(connection, tx, [this.treasuryKeypair]);

    // Update referral record
    await this.prisma.referral.update({
      where: { id: referralId },
      data: {
        bonusPaid: true,
        bonusTxReferrer: sig,
        bonusTxReferee: sig,
      },
    });

    // Log transactions
    await this.txLogger.log({
      walletAddress: referrerAddress,
      type: 'REFERRAL_BONUS',
      signature: sig,
      amount: BONUS_AMOUNT,
      token: 'MVGA',
    });
    await this.txLogger.confirm(sig);

    this.logger.log(
      `Referral bonus paid: ${BONUS_AMOUNT} MVGA each to ${referrerAddress} and ${refereeAddress}`
    );

    this.eventEmitter.emit('referral.bonus.paid', {
      walletAddress: referrerAddress,
      amount: BONUS_AMOUNT,
    });
    this.eventEmitter.emit('referral.bonus.paid', {
      walletAddress: refereeAddress,
      amount: BONUS_AMOUNT,
    });
  }

  async getStats(walletAddress: string) {
    const referralCode = await this.prisma.referralCode.findUnique({
      where: { walletAddress },
      include: { referrals: true },
    });

    if (!referralCode) {
      return { code: null, totalReferrals: 0, totalEarned: 0, referrals: [] };
    }

    const paidReferrals = referralCode.referrals.filter((r) => r.bonusPaid);

    return {
      code: referralCode.code,
      totalReferrals: referralCode.referrals.length,
      totalEarned: paidReferrals.length * BONUS_AMOUNT,
      referrals: referralCode.referrals.map((r) => ({
        refereeAddress: r.refereeAddress.slice(0, 4) + '...' + r.refereeAddress.slice(-4),
        bonusPaid: r.bonusPaid,
        amount: r.amount,
        createdAt: r.createdAt,
      })),
    };
  }
}
