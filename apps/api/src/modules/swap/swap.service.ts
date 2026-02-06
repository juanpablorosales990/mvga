import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { TiersService } from '../tiers/tiers.service';

// Platform fee: 0.1% (10 basis points) - goes to treasury for community distribution
const PLATFORM_FEE_BPS = 10;

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

export interface SwapQuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
}

export interface SwapExecuteRequest {
  quoteResponse: JupiterQuote;
  userPublicKey: string;
}

@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);
  private readonly JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6';
  private readonly feeAccount: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tiersService: TiersService
  ) {
    // Fee account receives platform fees from Jupiter swaps
    this.feeAccount = this.config.get(
      'TREASURY_WALLET',
      'HWRFGiMDWNvPHo5ZLV1MJEDjDNFVDJ8KJMDXcJjLVGa8'
    );
    this.MVGA_DEFAULT_PRICE = parseFloat(this.config.get('MVGA_DEFAULT_PRICE', '0.001'));
  }

  // Common token mints
  readonly TOKENS = {
    SOL: 'So11111111111111111111111111111111111111112',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  };

  async getQuote(request: SwapQuoteRequest): Promise<JupiterQuote> {
    const { inputMint, outputMint, amount, slippageBps: rawSlippage = 50 } = request;
    const slippageBps = Math.min(Math.max(rawSlippage, 1), 500); // Cap at 5%

    if (inputMint === outputMint) {
      throw new BadRequestException('Input and output tokens cannot be the same');
    }

    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    try {
      const url = new URL(`${this.JUPITER_QUOTE_API}/quote`);
      url.searchParams.set('inputMint', inputMint);
      url.searchParams.set('outputMint', outputMint);
      url.searchParams.set('amount', amount.toString());
      url.searchParams.set('slippageBps', slippageBps.toString());
      // Add platform fee (0.1%) - goes to treasury for community distribution
      url.searchParams.set('platformFeeBps', PLATFORM_FEE_BPS.toString());

      const response = await fetch(url.toString());

      if (!response.ok) {
        const error = await response.text();
        throw new BadRequestException(`Jupiter API error: ${error}`);
      }

      const quote = await response.json();
      return quote;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Failed to get quote: ${(error as Error).message}`);
    }
  }

  async getSwapTransaction(request: SwapExecuteRequest): Promise<{ swapTransaction: string }> {
    const { quoteResponse, userPublicKey } = request;

    try {
      const response = await fetch(`${this.JUPITER_QUOTE_API}/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto',
          // Platform fee account - receives 0.1% of swaps for community treasury
          feeAccount: this.feeAccount,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new BadRequestException(`Jupiter swap error: ${error}`);
      }

      const result = await response.json();
      return { swapTransaction: result.swapTransaction };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        `Failed to create swap transaction: ${(error as Error).message}`
      );
    }
  }

  // Price cache: mint → { price, timestamp }
  private priceCache = new Map<string, { price: number; timestamp: number }>();
  private readonly PRICE_CACHE_TTL = 30_000; // 30 seconds
  private readonly MVGA_MINT = 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh';
  private readonly MVGA_DEFAULT_PRICE: number;

  async getTokenPrice(mint: string): Promise<number> {
    const prices = await this.getMultipleTokenPrices([mint]);
    return prices[mint] || 0;
  }

  async getMvgaPrice(): Promise<number> {
    const prices = await this.getMultipleTokenPrices([this.MVGA_MINT]);
    return prices[this.MVGA_MINT] || this.MVGA_DEFAULT_PRICE;
  }

  async getMultipleTokenPrices(mints: string[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};
    const now = Date.now();

    // Check cache first, collect uncached mints
    const uncached: string[] = [];
    for (const mint of mints) {
      const cached = this.priceCache.get(mint);
      if (cached && now - cached.timestamp < this.PRICE_CACHE_TTL) {
        prices[mint] = cached.price;
      } else {
        uncached.push(mint);
      }
    }

    if (uncached.length === 0) return prices;

    // Fetch all uncached prices from DexScreener in one call
    try {
      const response = await fetch(
        `https://api.dexscreener.com/tokens/v1/solana/${uncached.join(',')}`
      );
      if (response.ok) {
        const pairs = await response.json();
        if (Array.isArray(pairs)) {
          for (const pair of pairs) {
            const mint = pair.baseToken?.address;
            const price = parseFloat(pair.priceUsd ?? '0');
            if (mint && price > 0 && uncached.includes(mint) && !prices[mint]) {
              prices[mint] = price;
              this.priceCache.set(mint, { price, timestamp: now });
            }
          }
        }
      }
    } catch {
      this.logger.warn('DexScreener price fetch failed');
    }

    // Fallback: MVGA uses configurable default if not found on DexScreener
    if (uncached.includes(this.MVGA_MINT) && !prices[this.MVGA_MINT]) {
      prices[this.MVGA_MINT] = this.MVGA_DEFAULT_PRICE;
      this.priceCache.set(this.MVGA_MINT, { price: this.MVGA_DEFAULT_PRICE, timestamp: now });
    }

    return prices;
  }

  /**
   * Record a completed swap for fee tracking with tier-based discounts and cashback
   * Called by frontend after successful swap transaction
   */
  async recordSwap(params: {
    walletAddress: string;
    signature: string;
    inputMint: string;
    outputMint: string;
    inputAmount: string;
    outputAmount: string;
  }) {
    const { walletAddress, signature, inputAmount, inputMint } = params;

    // Calculate base platform fee (0.1% of input amount)
    const inputAmountNum = BigInt(inputAmount);
    const baseFeeAmount = (inputAmountNum * BigInt(PLATFORM_FEE_BPS)) / BigInt(10000);

    // Get tier-based benefits
    const { tier } = await this.tiersService.getUserTier(walletAddress);
    const feeDiscount = tier.feeDiscount; // 0 to 1.0
    const cashbackRate = tier.cashbackRate; // 0 to 0.02

    // Apply fee discount (Diamond gets 100% discount = zero fees)
    const discountBps = Math.round(feeDiscount * PLATFORM_FEE_BPS);
    const effectiveFeeBps = PLATFORM_FEE_BPS - discountBps;
    const feeAmount =
      effectiveFeeBps > 0 ? (inputAmountNum * BigInt(effectiveFeeBps)) / BigInt(10000) : BigInt(0);

    // Calculate cashback amount (percentage of input amount)
    const cashbackBps = Math.round(cashbackRate * 10000);
    const cashbackAmount =
      cashbackBps > 0 ? (inputAmountNum * BigInt(cashbackBps)) / BigInt(10000) : BigInt(0);

    // Determine token for fee (use input token)
    const token = this.getTokenSymbol(inputMint);

    // Record fee for treasury distribution
    await this.prisma.feeCollection.create({
      data: {
        source: 'SWAP',
        amount: feeAmount,
        token,
        signature,
        relatedTx: signature,
        relatedType: 'swap',
      },
    });

    this.logger.log(
      `Swap fee recorded: ${feeAmount} ${token} (tier: ${tier.name}, discount: ${feeDiscount * 100}%, cashback: ${cashbackAmount} ${token}) from ${signature}`
    );

    return {
      success: true,
      feeAmount: feeAmount.toString(),
      baseFeeAmount: baseFeeAmount.toString(),
      cashbackAmount: cashbackAmount.toString(),
      token,
      tier: tier.name,
      feeDiscount: feeDiscount * 100,
      cashbackRate: cashbackRate * 100,
    };
  }

  /**
   * Get fee details for a wallet address with tier benefits applied
   */
  async getFeeDetails(walletAddress?: string) {
    const base = {
      platformFeeBps: PLATFORM_FEE_BPS,
      platformFeePercent: PLATFORM_FEE_BPS / 100,
    };

    if (!walletAddress) {
      return {
        ...base,
        effectiveFeeBps: PLATFORM_FEE_BPS,
        effectiveFeePercent: PLATFORM_FEE_BPS / 100,
        tier: 'Bronze',
        feeDiscount: 0,
        cashbackRate: 0,
      };
    }

    const { tier } = await this.tiersService.getUserTier(walletAddress);
    const discountBps = Math.round(tier.feeDiscount * PLATFORM_FEE_BPS);
    const effectiveFeeBps = PLATFORM_FEE_BPS - discountBps;

    return {
      ...base,
      effectiveFeeBps,
      effectiveFeePercent: effectiveFeeBps / 100,
      tier: tier.name,
      feeDiscount: tier.feeDiscount * 100,
      cashbackRate: tier.cashbackRate * 100,
    };
  }

  /**
   * Get token symbol from mint address
   */
  private getTokenSymbol(mint: string): string {
    const mintToSymbol: Record<string, string> = {
      So11111111111111111111111111111111111111112: 'SOL',
      EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC',
      Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'USDT',
      DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh: 'MVGA',
    };
    return mintToSymbol[mint] || 'UNKNOWN';
  }
}
