import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface StellarWithdrawResult {
  id: string;
  url: string;
  memo: string;
  destination: string;
}

export interface StellarDepositResult {
  id: string;
  url: string;
}

export interface StellarTransactionStatus {
  id: string;
  status: string;
  amount_in?: string;
  amount_out?: string;
  amount_fee?: string;
  withdraw_anchor_account?: string;
  withdraw_memo?: string;
  external_transaction_id?: string;
  more_info_url?: string;
}

type MoneygramEnvironment = 'testnet' | 'mainnet' | 'mock';

const MONEYGRAM_CONFIG: Record<
  string,
  {
    authUrl: string;
    sep24Url: string;
    signingKey: string;
    usdcIssuer: string;
    networkPassphrase: string;
  }
> = {
  testnet: {
    authUrl: 'https://extstellar.moneygram.com/stellaradapterservice/auth',
    sep24Url: 'https://extstellar.moneygram.com/stellaradapterservice/sep24',
    signingKey: 'GCSESAP5ILVM6CWIEGK2SDOCQU7PHVFYYT7JNKRDAQNVQWKD5YEE5ZJ4',
    usdcIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    networkPassphrase: 'Test SDF Network ; September 2015',
  },
  mainnet: {
    authUrl: 'https://stellar.moneygram.com/stellaradapterservice/auth',
    sep24Url: 'https://stellar.moneygram.com/stellaradapterservice/sep24',
    signingKey: 'GD5NUMEX7LYHXGXCAD4PGW7JDMOUY2DKRGY5XZHJS5IONVHDKCJYGVCL',
    usdcIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
  },
};

@Injectable()
export class StellarAdapter {
  private readonly logger = new Logger(StellarAdapter.name);
  private readonly authSecret: string | undefined;
  private readonly fundsSecret: string | undefined;
  private readonly environment: MoneygramEnvironment;

  constructor(private readonly config: ConfigService) {
    this.authSecret = this.config.get<string>('STELLAR_AUTH_SECRET');
    this.fundsSecret = this.config.get<string>('STELLAR_FUNDS_SECRET');
    this.environment = (this.config.get<string>('MONEYGRAM_ENVIRONMENT') ||
      'mock') as MoneygramEnvironment;
  }

  get isEnabled(): boolean {
    return !!this.authSecret && !!this.fundsSecret && this.environment !== 'mock';
  }

  private get mgConfig() {
    return MONEYGRAM_CONFIG[this.environment] || MONEYGRAM_CONFIG.testnet;
  }

  /** SEP-10: Authenticate with MoneyGram and get a JWT token */
  async authenticate(userId: string): Promise<string> {
    if (!this.isEnabled) {
      return `MOCK_TOKEN_${userId}_${Date.now()}`;
    }

    try {
      const { Keypair, TransactionBuilder, Networks } = await import('@stellar/stellar-sdk');
      const authKeypair = Keypair.fromSecret(this.authSecret!);
      const cfg = this.mgConfig;

      // Step 1: Request challenge
      const challengeUrl = `${cfg.authUrl}?account=${authKeypair.publicKey()}&memo=${userId}`;
      const challengeRes = await fetch(challengeUrl);
      if (!challengeRes.ok) {
        throw new Error(`SEP-10 challenge failed: ${challengeRes.status}`);
      }
      const { transaction: challengeXdr } = await challengeRes.json();

      // Step 2: Sign challenge
      const networkPassphrase = this.environment === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
      const tx = TransactionBuilder.fromXDR(challengeXdr, networkPassphrase);
      tx.sign(authKeypair);

      // Step 3: Submit signed challenge
      const tokenRes = await fetch(cfg.authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction: tx.toXDR() }),
      });

      if (!tokenRes.ok) {
        throw new Error(`SEP-10 token exchange failed: ${tokenRes.status}`);
      }

      const { token } = await tokenRes.json();
      this.logger.log(`SEP-10 auth successful for user ${userId}`);
      return token;
    } catch (error) {
      this.logger.error(`SEP-10 auth failed: ${error}`);
      throw error;
    }
  }

  /** SEP-24: Initiate a withdrawal (off-ramp) */
  async initiateWithdraw(token: string, amount: string): Promise<StellarWithdrawResult> {
    if (!this.isEnabled) {
      const mockId = `MOCK_WD_${Date.now()}`;
      return {
        id: mockId,
        url: `#moneygram-mock-withdraw?id=${mockId}`,
        memo: '12345',
        destination: 'MOCK_STELLAR_DESTINATION',
      };
    }

    try {
      const { Keypair } = await import('@stellar/stellar-sdk');
      const fundsKeypair = Keypair.fromSecret(this.fundsSecret!);
      const cfg = this.mgConfig;

      const res = await fetch(`${cfg.sep24Url}/transactions/withdraw/interactive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          asset_code: 'USDC',
          account: fundsKeypair.publicKey(),
          amount,
          lang: 'en',
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`SEP-24 withdraw failed: ${res.status} ${body}`);
      }

      const data = await res.json();
      this.logger.log(`SEP-24 withdraw initiated: ${data.id}`);

      return {
        id: data.id,
        url: data.url + '&callback=postmessage',
        memo: data.memo || '',
        destination: data.withdraw_anchor_account || '',
      };
    } catch (error) {
      this.logger.error(`SEP-24 withdraw initiation failed: ${error}`);
      throw error;
    }
  }

  /** SEP-24: Initiate a deposit (on-ramp) */
  async initiateDeposit(token: string, amount: string): Promise<StellarDepositResult> {
    if (!this.isEnabled) {
      const mockId = `MOCK_DEP_${Date.now()}`;
      return {
        id: mockId,
        url: `#moneygram-mock-deposit?id=${mockId}`,
      };
    }

    try {
      const { Keypair } = await import('@stellar/stellar-sdk');
      const fundsKeypair = Keypair.fromSecret(this.fundsSecret!);
      const cfg = this.mgConfig;

      const res = await fetch(`${cfg.sep24Url}/transactions/deposit/interactive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          asset_code: 'USDC',
          account: fundsKeypair.publicKey(),
          amount,
          lang: 'en',
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`SEP-24 deposit failed: ${res.status} ${body}`);
      }

      const data = await res.json();
      this.logger.log(`SEP-24 deposit initiated: ${data.id}`);

      return {
        id: data.id,
        url: data.url + '&callback=postmessage',
      };
    } catch (error) {
      this.logger.error(`SEP-24 deposit initiation failed: ${error}`);
      throw error;
    }
  }

  /** SEP-24: Poll transaction status */
  async getTransactionStatus(
    token: string,
    transactionId: string
  ): Promise<StellarTransactionStatus> {
    if (!this.isEnabled) {
      return {
        id: transactionId,
        status: 'pending_user_transfer_start',
        amount_in: '100.00',
        amount_fee: '2.00',
      };
    }

    const cfg = this.mgConfig;
    const res = await fetch(`${cfg.sep24Url}/transaction?id=${transactionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`SEP-24 transaction poll failed: ${res.status}`);
    }

    const data = await res.json();
    return data.transaction;
  }

  /** Send Stellar USDC payment to MoneyGram's account */
  async sendPayment(destination: string, amount: string, memo: string): Promise<string> {
    if (!this.isEnabled) {
      return `MOCK_STELLAR_TX_${Date.now()}`;
    }

    try {
      const { Keypair, Horizon, TransactionBuilder, Asset, Memo, Networks, Operation } =
        await import('@stellar/stellar-sdk');

      const fundsKeypair = Keypair.fromSecret(this.fundsSecret!);
      const cfg = this.mgConfig;
      const networkPassphrase = this.environment === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
      const horizonUrl =
        this.environment === 'mainnet'
          ? 'https://horizon.stellar.org'
          : 'https://horizon-testnet.stellar.org';

      const server = new Horizon.Server(horizonUrl);
      const account = await server.loadAccount(fundsKeypair.publicKey());

      const tx = new TransactionBuilder(account, {
        fee: '10000',
        networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination,
            asset: new Asset('USDC', cfg.usdcIssuer),
            amount,
          })
        )
        .addMemo(Memo.id(memo))
        .setTimeout(300)
        .build();

      tx.sign(fundsKeypair);

      const result = await server.submitTransaction(tx);
      const txHash =
        typeof result === 'object' && 'id' in result
          ? (result as { id: string }).id
          : String(result);
      this.logger.log(`Stellar payment sent: ${txHash}`);
      return txHash;
    } catch (error) {
      this.logger.error(`Stellar payment failed: ${error}`);
      throw error;
    }
  }
}
