# Contributing to MVGA

Thank you for your interest in contributing to MVGA! This guide will help you get started.

## Project Structure

This is a Turborepo monorepo with three apps:

```
apps/
  api/      # NestJS backend (TypeScript, Prisma, PostgreSQL)
  wallet/   # React PWA (Vite, Solana wallet-adapter, Tailwind)
  web/      # Next.js landing page (mvga.io)
```

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL (or Supabase account)
- A Solana wallet (Phantom or Solflare)

## Getting Started

1. **Clone the repo**

   ```bash
   git clone https://github.com/juanpablorosales990/mvga.git
   cd mvga
   ```

2. **Install dependencies**

   ```bash
   # API
   cd apps/api && npm install

   # Wallet
   cd apps/wallet && npm install

   # Web
   cd apps/web && npm install
   ```

3. **Set up environment variables**

   ```bash
   # API — copy and fill in
   cp apps/api/.env.example apps/api/.env

   # Wallet — optional
   # VITE_SOLANA_RPC_URL — custom RPC (defaults to public mainnet)
   # VITE_SENTRY_DSN — error tracking
   ```

4. **Run the database**

   ```bash
   cd apps/api
   npx prisma generate
   npx prisma db push
   ```

5. **Start development servers**

   ```bash
   # API (port 4000)
   cd apps/api && npm run dev

   # Wallet (port 5173)
   cd apps/wallet && npm run dev

   # Web (port 3000)
   cd apps/web && npm run dev
   ```

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Run type-checking and tests:

   ```bash
   # API
   cd apps/api && npx tsc --noEmit && npm test

   # Wallet
   cd apps/wallet && npx tsc --noEmit && npx vitest run
   ```

4. Open a pull request against `main`

## Conventions

- **TypeScript** everywhere, strict mode enabled
- **Commit messages**: concise, imperative mood (e.g., "Add P2P escrow release endpoint")
- **i18n**: All wallet UI strings go through `react-i18next` — update both `en.json` and `es.json`
- **API validation**: Use `class-validator` decorators on DTOs
- **Error handling**: No `console.error` in production code — use UI error states or Sentry

## Pull Requests

- Keep PRs focused on a single feature or fix
- Include a brief description of what changed and why
- CI must pass (type-check, tests, build)
- At least one approval required before merge

## Questions?

Open an issue or reach out via the project's GitHub Discussions.
