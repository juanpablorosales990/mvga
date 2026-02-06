import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';

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
    private readonly config: ConfigService
  ) {
    // Fee account receives platform fees from Jupiter swaps
    this.feeAccount = this.config.get(
      'TREASURY_WALLET',
      'HWRFGiMDWNvPHo5ZLV1MJEDjDNFVDJ8KJMDXcJjLVGa8'
    );
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

  // MVGA price via DexScreener (reads from Raydium CPMM pool)
  private mvgaPriceCache: { price: number; timestamp: number } | null = null;
  private readonly MVGA_POOL = '9KuzsCCCSeuF15hwBDz6FguqLR2hbgJkmaAZikrTDu1y';

  async getMvgaPrice(): Promise<number> {
    if (this.mvgaPriceCache && Date.now() - this.mvgaPriceCache.timestamp < 60_000) {
      return this.mvgaPriceCache.price;
    }

    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/pairs/solana/${this.MVGA_POOL}`
      );
      if (!response.ok) return this.mvgaPriceCache?.price ?? 0.001;

      const data = await response.json();
      const price = parseFloat(data.pairs?.[0]?.priceUsd ?? '0');
      if (price > 0) {
        this.mvgaPriceCache = { price, timestamp: Date.now() };
        return price;
      }
      return this.mvgaPriceCache?.price ?? 0.001;
    } catch {
      return this.mvgaPriceCache?.price ?? 0.001;
    }
  }

  // Map Solana mint addresses to CoinGecko IDs
  private readonly COINGECKO_IDS: Record<string, string> = {
    So11111111111111111111111111111111111111112: 'solana',
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'usd-coin',
    Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'tether',
  };

  async getTokenPrice(mint: string): Promise<number> {
    const prices = await this.getMultipleTokenPrices([mint]);
    return prices[mint] || 0;
  }

  async getMultipleTokenPrices(mints: string[]): Promise<Record<string, number>> {
    try {
      // Map mints to CoinGecko IDs
      const geckoIds = mints.map((m) => this.COINGECKO_IDS[m]).filter(Boolean);

      if (geckoIds.length === 0) return {};

      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${geckoIds.join(',')}&vs_currencies=usd`
      );

      if (!response.ok) return {};

      const data = await response.json();
      const prices: Record<string, number> = {};

      for (const mint of mints) {
        const geckoId = this.COINGECKO_IDS[mint];
        if (geckoId && data[geckoId]?.usd) {
          prices[mint] = data[geckoId].usd;
        }
      }

      return prices;
    } catch {
      return {};
    }
  }

  /**
   * Record a completed swap for fee tracking
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
    const { signature, inputAmount, inputMint } = params;

    // Calculate platform fee (0.1% of input amount)
    const inputAmountNum = BigInt(inputAmount);
    const feeAmount = (inputAmountNum * BigInt(PLATFORM_FEE_BPS)) / BigInt(10000);

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

    this.logger.log(`Swap fee recorded: ${feeAmount} ${token} from ${signature}`);

    return { success: true, feeAmount: feeAmount.toString(), token };
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
