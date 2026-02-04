import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateOfferDto, AcceptOfferDto, UpdateTradeStatusDto } from './dto/create-offer.dto';

export interface P2POffer {
  id: string;
  sellerAddress: string;
  type: 'BUY' | 'SELL';
  cryptoAmount: number;
  cryptoCurrency: 'USDC' | 'MVGA';
  paymentMethod: 'ZELLE' | 'VENMO' | 'PAYPAL' | 'BANK_TRANSFER';
  rate: number;
  minAmount: number;
  maxAmount: number;
  paymentInstructions?: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  createdAt: Date;
  availableAmount: number;
}

export interface P2PTrade {
  id: string;
  offerId: string;
  buyerAddress: string;
  sellerAddress: string;
  amount: number;
  cryptoAmount: number;
  cryptoCurrency: string;
  paymentMethod: string;
  status: 'PENDING' | 'ESCROW_LOCKED' | 'PAID' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED';
  escrowTx?: string;
  createdAt: Date;
  paidAt?: Date;
  completedAt?: Date;
}

export interface UserReputation {
  walletAddress: string;
  totalTrades: number;
  completedTrades: number;
  disputesLost: number;
  rating: number;
  avgResponseTime: number;
}

@Injectable()
export class P2PService {
  // In-memory storage for now - replace with database
  private offers: Map<string, P2POffer> = new Map();
  private trades: Map<string, P2PTrade> = new Map();
  private reputations: Map<string, UserReputation> = new Map();

  // Offer methods
  async createOffer(dto: CreateOfferDto): Promise<P2POffer> {
    if (dto.minAmount > dto.maxAmount) {
      throw new BadRequestException('Min amount cannot be greater than max amount');
    }

    const offer: P2POffer = {
      id: this.generateId(),
      sellerAddress: dto.sellerAddress,
      type: dto.type,
      cryptoAmount: dto.cryptoAmount,
      cryptoCurrency: dto.cryptoCurrency,
      paymentMethod: dto.paymentMethod,
      rate: dto.rate,
      minAmount: dto.minAmount,
      maxAmount: dto.maxAmount,
      paymentInstructions: dto.paymentInstructions,
      status: 'ACTIVE',
      createdAt: new Date(),
      availableAmount: dto.cryptoAmount,
    };

    this.offers.set(offer.id, offer);
    return offer;
  }

  async getOffers(filters?: {
    type?: 'BUY' | 'SELL';
    cryptoCurrency?: string;
    paymentMethod?: string;
    status?: string;
  }): Promise<P2POffer[]> {
    let offers = Array.from(this.offers.values());

    if (filters) {
      if (filters.type) {
        offers = offers.filter((o) => o.type === filters.type);
      }
      if (filters.cryptoCurrency) {
        offers = offers.filter((o) => o.cryptoCurrency === filters.cryptoCurrency);
      }
      if (filters.paymentMethod) {
        offers = offers.filter((o) => o.paymentMethod === filters.paymentMethod);
      }
      if (filters.status) {
        offers = offers.filter((o) => o.status === filters.status);
      } else {
        // Default to active offers
        offers = offers.filter((o) => o.status === 'ACTIVE');
      }
    }

    // Sort by rate (best rates first)
    return offers.sort((a, b) => b.rate - a.rate);
  }

  async getOffer(id: string): Promise<P2POffer> {
    const offer = this.offers.get(id);
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
    return offer;
  }

  async cancelOffer(id: string, walletAddress: string): Promise<void> {
    const offer = await this.getOffer(id);
    if (offer.sellerAddress !== walletAddress) {
      throw new BadRequestException('Only the seller can cancel this offer');
    }
    offer.status = 'CANCELLED';
    this.offers.set(id, offer);
  }

  // Trade methods
  async acceptOffer(offerId: string, dto: AcceptOfferDto): Promise<P2PTrade> {
    const offer = await this.getOffer(offerId);

    if (offer.status !== 'ACTIVE') {
      throw new BadRequestException('Offer is not active');
    }

    if (dto.amount < offer.minAmount || dto.amount > offer.maxAmount) {
      throw new BadRequestException(
        `Amount must be between ${offer.minAmount} and ${offer.maxAmount}`
      );
    }

    // Calculate crypto amount based on rate
    const cryptoAmount = dto.amount * offer.rate;
    if (cryptoAmount > offer.availableAmount) {
      throw new BadRequestException('Not enough available in offer');
    }

    const trade: P2PTrade = {
      id: this.generateId(),
      offerId,
      buyerAddress: dto.buyerAddress,
      sellerAddress: offer.sellerAddress,
      amount: dto.amount,
      cryptoAmount,
      cryptoCurrency: offer.cryptoCurrency,
      paymentMethod: offer.paymentMethod,
      status: 'PENDING',
      createdAt: new Date(),
    };

    // Update offer available amount
    offer.availableAmount -= cryptoAmount;
    if (offer.availableAmount <= 0) {
      offer.status = 'COMPLETED';
    }
    this.offers.set(offerId, offer);

    this.trades.set(trade.id, trade);
    return trade;
  }

  async getTrade(id: string): Promise<P2PTrade> {
    const trade = this.trades.get(id);
    if (!trade) {
      throw new NotFoundException('Trade not found');
    }
    return trade;
  }

  async getUserTrades(walletAddress: string): Promise<P2PTrade[]> {
    return Array.from(this.trades.values()).filter(
      (t) => t.buyerAddress === walletAddress || t.sellerAddress === walletAddress
    );
  }

  async updateTradeStatus(
    tradeId: string,
    walletAddress: string,
    dto: UpdateTradeStatusDto
  ): Promise<P2PTrade> {
    const trade = await this.getTrade(tradeId);

    // Validate permissions based on status update
    if (dto.status === 'PAID' && trade.buyerAddress !== walletAddress) {
      throw new BadRequestException('Only buyer can mark as paid');
    }

    if (dto.status === 'CONFIRMED' && trade.sellerAddress !== walletAddress) {
      throw new BadRequestException('Only seller can confirm receipt');
    }

    // Update status
    trade.status = dto.status === 'CONFIRMED' ? 'COMPLETED' : dto.status;

    if (dto.status === 'PAID') {
      trade.paidAt = new Date();
    }

    if (dto.status === 'CONFIRMED') {
      trade.completedAt = new Date();
      // Update reputations
      await this.updateReputation(trade.buyerAddress, true);
      await this.updateReputation(trade.sellerAddress, true);
    }

    this.trades.set(tradeId, trade);
    return trade;
  }

  // Reputation methods
  async getReputation(walletAddress: string): Promise<UserReputation> {
    let reputation = this.reputations.get(walletAddress);
    if (!reputation) {
      reputation = {
        walletAddress,
        totalTrades: 0,
        completedTrades: 0,
        disputesLost: 0,
        rating: 5.0,
        avgResponseTime: 0,
      };
      this.reputations.set(walletAddress, reputation);
    }
    return reputation;
  }

  async updateReputation(walletAddress: string, successful: boolean): Promise<void> {
    const reputation = await this.getReputation(walletAddress);
    reputation.totalTrades++;

    if (successful) {
      reputation.completedTrades++;
    } else {
      reputation.disputesLost++;
    }

    // Calculate rating
    reputation.rating = Math.max(
      1,
      5 - reputation.disputesLost * 0.5 + (reputation.completedTrades > 10 ? 0.5 : 0)
    );

    this.reputations.set(walletAddress, reputation);
  }

  // Escrow methods (placeholder - will integrate with Solana)
  async lockEscrow(tradeId: string): Promise<string> {
    const trade = await this.getTrade(tradeId);
    // TODO: Create Solana transaction to lock funds in escrow
    trade.status = 'ESCROW_LOCKED';
    trade.escrowTx = `escrow_${tradeId}_${Date.now()}`;
    this.trades.set(tradeId, trade);
    return trade.escrowTx;
  }

  async releaseEscrow(tradeId: string): Promise<string> {
    const trade = await this.getTrade(tradeId);
    // TODO: Create Solana transaction to release escrow to buyer
    return `release_${tradeId}_${Date.now()}`;
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
