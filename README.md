# MVGA - Make Venezuela Great Again

Venezuela's open-source financial infrastructure. Send money, hold stable value, support small businesses.

## Project Structure

```
mvga/
├── apps/
│   ├── web/          # Landing page (Next.js)
│   ├── wallet/       # PWA Wallet (React + Vite)
│   └── api/          # Backend API (NestJS)
├── packages/
│   ├── sdk/          # Shared SDK (types, constants, utilities)
│   ├── ui/           # Shared UI components (coming soon)
│   └── contracts/    # Solana programs (coming soon)
└── docs/             # Documentation
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 10+
- Solana CLI (for token creation)
- Phantom or Solflare wallet

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/mvga.git
cd mvga

# Install dependencies
npm install

# Set up environment variables
cp apps/api/.env.example apps/api/.env
```

### Development

```bash
# Run all apps in development mode
npm run dev

# Or run individual apps
npm run dev --workspace=@mvga/web      # Landing page at http://localhost:3000
npm run dev --workspace=@mvga/wallet   # Wallet at http://localhost:3001
npm run dev --workspace=@mvga/api      # API at http://localhost:4000
```

### Build

```bash
# Build all apps
npm run build

# Build individual apps
npm run build --workspace=@mvga/web
npm run build --workspace=@mvga/wallet
npm run build --workspace=@mvga/api
```

## Token Creation (Solana)

### 1. Install Solana CLI

```bash
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
```

### 2. Create Wallet (if you don't have one)

```bash
solana-keygen new --outfile ~/mvga-wallet.json
```

### 3. Fund Wallet

For mainnet, transfer SOL to your wallet address:
```bash
solana address -k ~/mvga-wallet.json
```

### 4. Create Token

```bash
# Set to mainnet
solana config set --url mainnet-beta

# Create the token
spl-token create-token --decimals 9

# Note the token address (mint) that's output
# Update packages/sdk/src/index.ts with the actual address
```

### 5. Create Token Account & Mint Supply

```bash
# Create token account
spl-token create-account <TOKEN_ADDRESS>

# Mint 1 billion tokens
spl-token mint <TOKEN_ADDRESS> 1000000000
```

### 6. Set Up Liquidity

1. Go to [Raydium](https://raydium.io/liquidity/create-pool/)
2. Create a new pool with MVGA/SOL or MVGA/USDC
3. Add initial liquidity
4. Lock LP tokens via [Streamflow](https://app.streamflow.finance/)

## Environment Variables

### API (.env)

```env
# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
# Or use Helius: https://mainnet.helius-rpc.com/?api-key=YOUR_KEY

# Database (when ready)
DATABASE_URL=postgresql://...

# Server
PORT=4000
```

## Architecture

### Token Flow
```
User → Wallet App → Solana Blockchain
                  ↓
              Jupiter (swaps)
                  ↓
            Staking Vault
```

### P2P Exchange Flow
```
Seller creates offer → Buyer accepts →
Crypto locked in escrow → Buyer sends fiat →
Seller confirms → Escrow releases to buyer
```

## Contributing

This is an open-source project. Contributions are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

- All wallets are public and auditable
- LP is locked for 3 years
- Team tokens vest over 2 years
- Smart contracts will be audited before mainnet

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- Website: https://mvga.io
- Twitter: https://twitter.com/mvga
- Telegram: https://t.me/mvga
- GitHub: https://github.com/your-username/mvga

---

**Patria y vida. Venezuela será libre.**
