import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OnrampService {
  private readonly logger = new Logger(OnrampService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    const isSandbox = this.config.get('COINBASE_ONRAMP_SANDBOX') !== 'false';
    this.baseUrl = isSandbox
      ? 'https://api.developer.coinbase.com'
      : 'https://api.developer.coinbase.com';
  }

  /**
   * Create a Coinbase Onramp session token.
   * Uses the Coinbase Developer Platform (CDP) API Key authentication.
   *
   * The session token is used client-side to open the Coinbase Onramp widget
   * pre-configured for the user's wallet address.
   */
  async createSession(walletAddress: string) {
    const apiKeyId = this.config.get('CDP_API_KEY_ID');
    const apiKeySecret = this.config.get('CDP_API_KEY_SECRET');

    if (!apiKeyId || !apiKeySecret) {
      throw new BadRequestException('Coinbase Onramp not configured');
    }

    const isSandbox = this.config.get('COINBASE_ONRAMP_SANDBOX') !== 'false';

    const res = await fetch(`${this.baseUrl}/onramp/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKeyId,
        'X-Api-Secret': apiKeySecret,
      },
      body: JSON.stringify({
        addresses: {
          [walletAddress]: ['solana'],
        },
        assets: ['USDC', 'SOL'],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Coinbase Onramp token failed: ${err}`);
      throw new BadRequestException('Failed to create onramp session');
    }

    const data = await res.json();

    const widgetBase = isSandbox ? 'https://pay-sandbox.coinbase.com' : 'https://pay.coinbase.com';

    return {
      sessionToken: data.token,
      widgetUrl: `${widgetBase}/buy/select-asset?sessionToken=${data.token}`,
    };
  }
}
