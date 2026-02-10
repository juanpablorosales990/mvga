# MVGA Pre-Launch Checklist

Last updated: Feb 10, 2026

## Infrastructure

- [x] API deployed on Railway (`api.mvga.io`) — health 200, auth working
- [x] Wallet PWA on Vercel (`app.mvga.io`) — deploying from `main`
- [x] Landing page on Vercel (`mvga.io`) — deploying from `main`
- [x] PostgreSQL on Supabase — all 36 models migrated
- [x] Helius RPC connected (free plan: 10 RPS, 1M credits/mo)
- [x] Sentry error tracking wired
- [x] UptimeRobot monitoring active
- [x] Security headers: HSTS, X-Frame-Options, CSP, nosniff, Permissions-Policy
- [x] CORS configured for production domains
- [ ] **Helius upgrade** ($49/mo) — upgrade when hitting rate limits

## Security

- [x] Internal security audit: 14 findings, ALL fixed (commits `635874a` + `cb4d012`)
- [x] Rate limiting on all API endpoints (global + per-route)
- [x] Auth cookie: httpOnly, secure, sameSite: 'lax'
- [x] KycGuard on card issuance, offramp, MoneyGram
- [x] Error messages sanitized (no internal details leaked)
- [x] PayPal webhook signature verification with rawBody
- [x] CSPRNG for mnemonic confirmation (crypto.getRandomValues)
- [x] Input validation on all DTOs (class-validator)
- [ ] **External security audit** ($8-15K Sec3 / $15-30K OtterSec) — for compliance

## On-Chain

- [x] Escrow smart contract: LIVE ON DEVNET, E2E tested
- [x] Program ID: `6GXdYCDckUVEFBaQSgfQGX95gZSNN7FWN19vRDSyTJ5E`
- [x] Squads multisig: 2-of-3 on devnet
- [ ] **Escrow mainnet deploy** (~3-5 SOL) — THE blocker for full launch
- [ ] Squads multisig on mainnet
- [ ] Treasury wallets funded on mainnet

## Third-Party Integrations

### Active & Verified

- [x] Persona KYC (sandbox keys set, webhook configured)
- [x] PayPal deposits (sandbox keys set)
- [x] Lithic card issuing (sandbox verified, Program ID: `6eb1fe8c-...`)
- [x] Reloadly phone top-ups (sandbox, $998 balance)
- [x] Onramper deposits (card/bank)

### Pending API Keys

- [ ] **Airtm Enterprise** — email `enterprise@airtm.com` for sandbox keys
- [ ] **Bitrefill partner** — application submitted, waiting for API keys
- [ ] **MoneyGram Ramps** — Stellar credentials needed

### Production Flip

- [ ] Persona: Swap sandbox → production keys
- [ ] PayPal: Swap sandbox → production keys
- [ ] Lithic: Swap sandbox → production keys
- [ ] Reloadly: Set `RELOADLY_SANDBOX=false`
- [ ] Airtm: Set production API keys
- [ ] Bitrefill: Set `BITREFILL_API_KEY` + `BITREFILL_API_SECRET`

## App Stores

- [ ] **Apple Developer account** ($99/yr)
- [ ] Apple App Store: Screenshots uploaded, metadata filled, build attached
- [ ] Apple App Store: Submit for review
- [ ] **Google Play Console** ($25 one-time)
- [ ] Google Play: Create listing, upload AAB
- [ ] Google Play: Submit for review
- [ ] Update `AppStoreBadges.tsx` with real store URLs

## Native App (Capacitor)

- [x] iOS + Android scaffolded
- [x] 9 Capacitor plugins configured
- [x] MVGA branded icons + splash screens
- [x] Push notifications: APNs + FCM ready
- [x] Biometrics: Face ID / Touch ID ready
- [ ] iOS build: Requires Apple Developer account
- [ ] Android build: Requires signing key
- [ ] Push certificate: APNs key from Apple Developer

## Testing

- [x] API: 406 tests passing (24 suites)
- [x] Wallet unit: 191 tests passing (12 suites)
- [x] Wallet E2E: 326+ passing (24+ spec files)
- [x] Web E2E: 58 passing (3 spec files)
- [x] Total: 981+ tests, 0 failures
- [x] All 4 packages build clean via Turbo

## Features Complete

- [x] Wallet creation (create-only, no import)
- [x] Send/Receive/Swap (SOL, USDC, USDT, MVGA)
- [x] P2P marketplace (6 payment methods, escrow)
- [x] Staking with lock periods and tiers
- [x] Savings (Kamino DeFi yields)
- [x] Visa debit card (Lithic)
- [x] Phone top-ups (Reloadly, VE carriers)
- [x] Gift cards (Bitrefill, mock mode)
- [x] Deposits (Onramper + PayPal)
- [x] Off-ramp (Airtm + MoneyGram, mock mode)
- [x] KYC (Persona, 5 status states)
- [x] Push notifications (web + native)
- [x] Biometric unlock (web + native)
- [x] QR scan-to-pay
- [x] CSV + PDF export
- [x] Referral program with tiers
- [x] Scheduled/recurring payments
- [x] Batch send
- [x] Price charts + alerts
- [x] Contact book
- [x] i18n: EN/ES (1,170+ keys each)
- [x] Treasury transparency dashboard
- [x] Grants/governance system
- [x] Analytics tracking (18 events)
- [x] User profiles (email, displayName, username)

## Landing Page

- [x] Hero with clear value proposition
- [x] Problem statement (3 cards)
- [x] Feature showcase (6 + 9 + 10 + 8 sections)
- [x] Competitive comparison table (14 rows)
- [x] Testimonials (6 quotes)
- [x] Partner logos (8 partners)
- [x] Team section
- [x] FAQ (12 questions)
- [x] Security headers + SEO metadata + OG image
- [x] Mobile responsive
- [ ] App Store badges (hidden until published)
- [ ] Spanish version (optional — wallet is i18n'd)

## Database

- [x] 36 Prisma models
- [x] All migrations applied (including GiftCard)
- [x] Rain provider columns dropped
- [x] Sumsub → Persona default updated
- [ ] Run `ALTER TABLE "UserKyc" ALTER COLUMN "provider" SET DEFAULT 'PERSONA'` on prod

## Launch Day

- [ ] Escrow mainnet deploy
- [ ] Flip all integrations to production
- [ ] Seed treasury wallets
- [ ] Enable Sentry alerting
- [ ] Monitor Helius RPS
- [ ] Announce on Telegram/Twitter
- [ ] Submit to App Store + Play Store

---

## Priority Order

1. **Get SOL for escrow mainnet deploy** — everything else works without it but P2P is core
2. **Email Airtm** for enterprise API keys — unblocks #1 off-ramp
3. **Apple Developer + Google Play accounts** — unblocks app store listings
4. **Flip sandbox to production** on Persona, PayPal, Lithic, Reloadly
5. **External security audit** (optional for v1, required for institutional partnerships)
