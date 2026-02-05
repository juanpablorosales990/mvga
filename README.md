# MVGA — Make Venezuela Great Again

Open-source financial infrastructure for Venezuela, built on Solana.

**Website:** [mvga.io](https://mvga.io) | **Wallet:** [app.mvga.io](https://app.mvga.io) | **API:** [api.mvga.io](https://api.mvga.io)

## What is MVGA?

MVGA is a crypto-native financial platform designed for Venezuelans. It combines a non-custodial Solana wallet with P2P fiat-to-crypto trading, community grants, and staking — all in Spanish and English.

### Features

- **Wallet** — Send, receive, and swap SOL, USDC, and MVGA tokens
- **P2P Trading** — Buy and sell crypto with Zelle, Venmo, PayPal, and bank transfers using on-chain escrow
- **Staking** — Stake MVGA tokens with tiered APY rewards and lock periods
- **Grants** — Community-funded micro-grants for Venezuelan businesses, voted on by stakers
- **i18n** — Full Spanish and English support with browser auto-detection

## Architecture

```
mvga/
├── apps/
│   ├── api/       # NestJS REST API (Prisma + PostgreSQL)
│   ├── wallet/    # React PWA (Vite + Solana wallet-adapter)
│   └── web/       # Next.js landing page
├── LICENSE        # MIT
├── CONTRIBUTING.md
└── SECURITY.md
```

| App      | Stack                      | Deployment |
| -------- | -------------------------- | ---------- |
| `api`    | NestJS, Prisma, PostgreSQL | Railway    |
| `wallet` | React, Vite, Tailwind, PWA | Vercel     |
| `web`    | Next.js, Tailwind          | Vercel     |

## Quick Start

```bash
git clone https://github.com/juanpablorosales990/mvga.git
cd mvga

# API
cd apps/api
npm install
cp .env.example .env   # Fill in DATABASE_URL, JWT_SECRET
npx prisma generate && npx prisma db push
npm run dev             # http://localhost:4000

# Wallet
cd apps/wallet
npm install
npm run dev             # http://localhost:5173

# Web
cd apps/web
npm install
npm run dev             # http://localhost:3000
```

## Environment Variables

### API (`apps/api/.env`)

| Variable       | Required | Description                  |
| -------------- | -------- | ---------------------------- |
| `DATABASE_URL` | Yes      | PostgreSQL connection string |
| `JWT_SECRET`   | Yes      | Min 32 chars in production   |
| `SENTRY_DSN`   | No       | Sentry error tracking        |

### Wallet

| Variable              | Required | Description                                    |
| --------------------- | -------- | ---------------------------------------------- |
| `VITE_SOLANA_RPC_URL` | No       | Custom Solana RPC (defaults to public mainnet) |
| `VITE_SENTRY_DSN`     | No       | Sentry error tracking                          |

## Token

**MVGA** — `DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh`

| Wallet            | Address                                        |
| ----------------- | ---------------------------------------------- |
| Treasury          | `H9j1W4u5LEiw8AZdui6c8AmN6t4tKkPQCAULPW8eMiTE` |
| Humanitarian Fund | `82XeVLtfjniaE6qvrDiY7UaCHvkimyhVximvRDdQsdqS` |
| Staking Vault     | `GNhLCjqThNJAJAdDYvRTr2EfWyGXAFUymaPuKaL1duEh` |
| Team Vesting      | `8m8L2CGoneYwP3xEYyss5sjbj7GKy7cK3YxDcG2yNbH4` |
| Marketing         | `DA5VQFLsx87hNQqL2EsM36oVhGnzM2CnqPSe6E9RFpeo` |
| Advisors          | `Huq3ea9KKf6HFb5Qiacdx2pJDSM4c881WdyMCBHXq4hF` |

## P2P Exchange Flow

```
Seller creates offer → Buyer accepts →
Crypto locked in escrow → Buyer sends fiat →
Seller confirms → Escrow releases to buyer
```

## Testing

```bash
# API unit tests
cd apps/api && npm test

# Wallet unit tests
cd apps/wallet && npx vitest run

# Wallet E2E tests (requires Playwright)
cd apps/wallet && npx playwright install --with-deps chromium
npx playwright test
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, conventions, and PR process.

## Security

See [SECURITY.md](SECURITY.md) for responsible disclosure policy.

## License

[MIT](LICENSE)

---

**Patria y vida. Venezuela sera libre.**
