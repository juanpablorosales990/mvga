# MVGA — Make Venezuela Great Again

Digital dollars for Venezuela. A non-custodial neobank built on Solana.

**Website:** [mvga.io](https://mvga.io) | **Wallet:** [app.mvga.io](https://app.mvga.io) | **API:** [api.mvga.io](https://api.mvga.io)

## What is MVGA?

MVGA is an open-source financial platform that gives Venezuelans access to digital dollars without a bank account. Send remittances for free, pay bills, top up phones, and get a Visa debit card — all from one app. Self-custody by default. Made by Venezuelans, for Venezuelans.

### Features

- **Non-Custodial Wallet** — Send, receive, and hold SOL, USDC, and MVGA. Your keys never leave your device.
- **P2P Exchange** — Trade crypto for fiat via Zelle, Venmo, PayPal, Pago Movil, Binance Pay, and bank transfers. On-chain escrow protects both parties.
- **Visa Debit Card** — Spend your digital dollars anywhere Visa is accepted. Apple Pay and Google Pay supported. Powered by Lithic.
- **KYC / Identity** — Persona-powered identity verification for card issuance and off-ramp.
- **Deposits** — Fund your wallet via card, bank transfer (Onramper), or PayPal.
- **Off-Ramp** — Cash out to bank via Airtm or MoneyGram.
- **Phone Top-Ups** — Recharge any Venezuelan mobile number directly from the app. Powered by Reloadly.
- **Staking** — Stake MVGA tokens with tiered APY, lock periods, and governance voting.
- **Savings** — Earn yield on USDC via Kamino DeFi vaults.
- **Grants** — Community-funded micro-grants for Venezuelan businesses, voted on by stakers.
- **Push Notifications** — Web (VAPID) and native (APNs/FCM).
- **Biometrics** — Face ID, Touch ID (native) and WebAuthn (web).
- **i18n** — Full Spanish and English with 1,016 translated strings.
- **Native App** — iOS and Android via Capacitor.

## Architecture

```
mvga/
├── apps/
│   ├── api/          # NestJS REST API — 21 modules, 132 routes, 36 Prisma models
│   ├── wallet/       # React PWA (Vite) — 37 pages, Capacitor iOS/Android
│   └── web/          # Next.js landing page — 5 pages
├── packages/
│   ├── contracts/    # Anchor escrow program (Solana)
│   ├── sdk/          # Shared TypeScript SDK
│   └── ui/           # Shared UI components (placeholder)
├── LICENSE
├── CONTRIBUTING.md
└── SECURITY.md
```

| App         | Stack                                        | Deployment                     |
| ----------- | -------------------------------------------- | ------------------------------ |
| `api`       | NestJS, Prisma, PostgreSQL, SWC              | [Railway](https://api.mvga.io) |
| `wallet`    | React 18, Vite, Tailwind, Zustand, Capacitor | [Vercel](https://app.mvga.io)  |
| `web`       | Next.js 14, Tailwind                         | [Vercel](https://mvga.io)      |
| `contracts` | Anchor (Rust), Solana                        | Devnet                         |

## Quick Start

```bash
git clone https://github.com/juanpablorosales990/mvga.git
cd mvga
npm install
```

### API

```bash
cd apps/api
cp .env.example .env    # Fill in DATABASE_URL, JWT_SECRET at minimum
npx prisma generate
npx prisma db push
npm run dev              # http://localhost:4000/api
```

### Wallet

```bash
cd apps/wallet
cp .env.example .env    # Fill in VITE_API_URL, VITE_SOLANA_RPC_URL
npm run dev              # http://localhost:5173
```

### Web (Landing Page)

```bash
cd apps/web
npm run dev              # http://localhost:3000
```

### Build All (Turbo)

```bash
npx turbo build --filter=@mvga/api --filter=@mvga/wallet --filter=@mvga/web --filter=@mvga/sdk
```

## Environment Variables

### API (`apps/api/.env`)

| Variable             | Required   | Description                                    |
| -------------------- | ---------- | ---------------------------------------------- |
| `DATABASE_URL`       | Yes        | PostgreSQL connection (with pgbouncer)         |
| `DIRECT_URL`         | Yes        | Direct PostgreSQL connection (for migrations)  |
| `JWT_SECRET`         | Yes        | Min 32 chars in production                     |
| `SOLANA_RPC_URL`     | Yes (prod) | Helius or other RPC provider                   |
| `MVGA_TOKEN_MINT`    | No         | Defaults to MVGA mainnet mint                  |
| `ESCROW_MODE`        | No         | `onchain` (Anchor) or `legacy` (server-signed) |
| `PERSONA_API_KEY`    | No         | Persona KYC (mock mode if unset)               |
| `LITHIC_API_KEY`     | No         | Lithic card issuing (mock mode if unset)       |
| `PAYPAL_CLIENT_ID`   | No         | PayPal deposits (disabled if unset)            |
| `RELOADLY_CLIENT_ID` | No         | Phone top-ups (disabled if unset)              |
| `VAPID_PUBLIC_KEY`   | No         | Web push notifications                         |
| `SENTRY_DSN`         | No         | Error tracking                                 |

See [`apps/api/.env.example`](apps/api/.env.example) for the full list.

### Wallet (`apps/wallet/.env`)

| Variable                | Required | Description                                    |
| ----------------------- | -------- | ---------------------------------------------- |
| `VITE_API_URL`          | Yes      | API base URL (e.g., `https://api.mvga.io/api`) |
| `VITE_SOLANA_RPC_URL`   | No       | Custom Solana RPC                              |
| `VITE_VAPID_PUBLIC_KEY` | No       | Web push notifications                         |
| `VITE_PAYPAL_CLIENT_ID` | No       | PayPal client-side SDK                         |

## Token

**MVGA** — [`DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh`](https://solscan.io/token/DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh)

### Treasury Wallets

All wallets are publicly verifiable on-chain. See the [Transparency page](https://mvga.io/transparency).

| Wallet            | Address                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Main Treasury     | [`H9j1W4u5LEiw8AZdui6c8AmN6t4tKkPQCAULPW8eMiTE`](https://solscan.io/account/H9j1W4u5LEiw8AZdui6c8AmN6t4tKkPQCAULPW8eMiTE) |
| Humanitarian Fund | [`HvtvFhuVMu9XGmhW5zWNvtPK7ttiMBg7Ag7C9oRpyKwP`](https://solscan.io/account/HvtvFhuVMu9XGmhW5zWNvtPK7ttiMBg7Ag7C9oRpyKwP) |
| Staking Vault     | [`GNhLCjqThNJAJAdDYvRTr2EfWyGXAFUymaPuKaL1duEh`](https://solscan.io/account/GNhLCjqThNJAJAdDYvRTr2EfWyGXAFUymaPuKaL1duEh) |
| Team Vesting      | [`8m8L2CGoneYwP3xEYyss5sjbj7GKy7cK3YxDcG2yNbH4`](https://solscan.io/account/8m8L2CGoneYwP3xEYyss5sjbj7GKy7cK3YxDcG2yNbH4) |
| Marketing         | [`DA5VQFLsx87hNQqL2EsM36oVhGnzM2CnqPSe6E9RFpeo`](https://solscan.io/account/DA5VQFLsx87hNQqL2EsM36oVhGnzM2CnqPSe6E9RFpeo) |
| Advisors          | [`Huq3ea9KKf6HFb5Qiacdx2pJDSM4c881WdyMCBHXq4hF`](https://solscan.io/account/Huq3ea9KKf6HFb5Qiacdx2pJDSM4c881WdyMCBHXq4hF) |

## How P2P Works

```
Seller creates offer
    → Buyer accepts
    → Crypto locked in on-chain escrow
    → Buyer sends fiat off-platform
    → Seller confirms receipt
    → Escrow releases crypto to buyer
```

Disputes are resolved through the platform. Escrow program: [`6GXdYCDckUVEFBaQSgfQGX95gZSNN7FWN19vRDSyTJ5E`](https://solscan.io/account/6GXdYCDckUVEFBaQSgfQGX95gZSNN7FWN19vRDSyTJ5E)

## Testing

```bash
# API unit tests (386 tests, 22 suites)
cd apps/api && npm test

# Wallet unit tests (187 tests, 11 suites)
cd apps/wallet && npx vitest run

# Wallet E2E tests (166 tests)
cd apps/wallet && npx playwright install --with-deps chromium
npx playwright test

# Web E2E tests (58 tests)
cd apps/web && npx playwright install --with-deps chromium
npx playwright test

# Build all
npx turbo build --filter=@mvga/api --filter=@mvga/wallet --filter=@mvga/web --filter=@mvga/sdk
```

**797 tests passing, 0 failures.**

## Integrations

| Service                                    | Purpose                     | Status     |
| ------------------------------------------ | --------------------------- | ---------- |
| [Solana](https://solana.com)               | Blockchain network          | Live       |
| [Helius](https://helius.dev)               | RPC + indexing              | Live       |
| [Onramper](https://onramper.com)           | Fiat-to-crypto deposits     | Live       |
| [PayPal](https://developer.paypal.com)     | Fiat deposits               | Sandbox    |
| [Persona](https://withpersona.com)         | Identity verification (KYC) | Sandbox    |
| [Lithic](https://lithic.com)               | Visa debit card issuing     | Sandbox    |
| [Reloadly](https://reloadly.com)           | Phone top-ups               | Sandbox    |
| [Airtm](https://airtm.com)                 | Off-ramp (bank cash-out)    | Mock       |
| [MoneyGram](https://stellar.org/moneygram) | Off-ramp (cash pickup)      | Mock       |
| [Kamino](https://kamino.finance)           | DeFi savings yields         | Integrated |
| [Sentry](https://sentry.io)                | Error tracking              | Live       |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, code conventions, and PR process.

## Security

Found a vulnerability? See [SECURITY.md](SECURITY.md) for responsible disclosure.

## License

[MIT](LICENSE)

---

**Patria y vida. Venezuela sera libre.**
