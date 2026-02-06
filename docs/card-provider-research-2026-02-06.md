# MVGA Card Provider Research — February 6, 2026

## Executive Summary

Evaluated 7 card-as-a-service providers for MVGA wallet's stablecoin-to-card feature targeting Venezuela/LatAm users. **Immersve** is the recommended primary partner (Solana-native, Mastercard Principal Member, proven with Phantom/Bitget). **Kulipa** is the fallback. **Rain.xyz + Lithic** is the long-term scale option.

---

## Decision Matrix

| Provider       | Legitimacy                                 | Solana/USDC                          | LatAm/VZ                                 | White-Label       | API Quality                | Timeline     | Risk                        |
| -------------- | ------------------------------------------ | ------------------------------------ | ---------------------------------------- | ----------------- | -------------------------- | ------------ | --------------------------- |
| **Immersve**   | HIGH (MC Principal Member, Phantom/Bitget) | **BEST** (native smart contract)     | Brazil confirmed, VZ uncertain (OFAC)    | Core business     | JS/TS SDK                  | 2-4 weeks    | Medium                      |
| **Kulipa**     | GOOD (Argent/Ready, 2M users)              | USDC on Solana (no USDT)             | Claims "210 countries", zero VZ evidence | Core business     | 8 OpenAPI modules, sandbox | 3 weeks      | Medium                      |
| **Rain.xyz**   | HIGH ($58M Series B, Visa)                 | Stablecoin-powered                   | "Global payments"                        | Yes               | docs.rain.xyz              | Weeks-months | Low                         |
| **Lithic**     | HIGH (established, Rain partner)           | Via Rain partnership                 | Expanding                                | Yes               | Self-service sandbox       | 2-4 weeks    | Low                         |
| **Buvei**      | MEDIUM (HK TCSP, US MSB, LT VASP)          | USDT/USDC on TRC20+ERC20 (no Solana) | Claims global, sanctions screening       | White-label + API | Behind login wall          | Unknown      | Medium-High                 |
| **VMCardio**   | **VERY LOW**                               | Claims USDT                          | Unknown                                  | No                | None visible               | N/A          | **DO NOT USE**              |
| **Bridge.xyz** | VERY HIGH (Stripe-acquired)                | Stablecoin infra                     | Strong LatAm                             | N/A               | Yes                        | Days-weeks   | Very Low, NOT a card issuer |
| **Marqeta**    | VERY HIGH (NASDAQ: MQ)                     | Selective                            | Limited                                  | Yes               | Yes                        | 3-6+ months  | Very Low but slow           |

---

## Provider Deep Dives

### 1. Immersve (RECOMMENDED PRIMARY)

**Company:** New Zealand-based fintech, Mastercard Principal Member
**Founded by:** Jerome Faury (CEO)
**Website:** immersve.com | Docs: docs.immersve.com

**Why it's the best fit for MVGA:**

- **Solana-native smart contract escrow** for USDC fund locking — the only provider with on-chain integration
- White-label is their core B2B2C model (not a side offering)
- JS/TS SDK fits React+Vite PWA perfectly
- Proven partners: Phantom Wallet, Bitget, Decaf (all Solana ecosystem)
- 2-4 week integration with SDK

**Payment flow:**

1. User holds USDC in MVGA wallet
2. User funds card → on-chain tx locks USDC in Immersve smart contract
3. Virtual Mastercard issued instantly
4. User spends anywhere Mastercard accepted
5. Settlement: Immersve releases locked USDC, handles fiat conversion

**API/SDK:**

- REST API for card issuance, funding, transaction management
- JS/TS SDK with pre-built UI components
- Key concepts: Card Programs, Cardholders, Cards, Funding Sources, Transactions
- Webhook notifications for transactions

**KYC:** Handled by Immersve (tiered: basic for lower limits, enhanced for higher)

**Pricing:** Not public. Per-transaction fee + possible interchange revenue share. Must negotiate.

**LatAm:** Brazil confirmed (Bitget). Broader LatAm likely via Mastercard network. **Venezuela is uncertain due to OFAC sanctions.**

**Risks:**

- Venezuela access is the biggest unknown
- Relatively small company (counterparty risk)
- Pricing opaque

---

### 2. Kulipa (RECOMMENDED FALLBACK)

**Company:** French startup, CEO Axel Cateland (former Mastercard VP)
**Website:** kulipa.xyz | API docs: kulipa.readme.io

**Key strengths:**

- Live partnership with Ready (Argent) serving 2M users
- Mastercard network, 210 countries, 37M+ establishments
- Supports USDC on Solana (also EVM, L2)
- API-first with 8 comprehensive OpenAPI modules
- "Ready in 3 weeks" integration claim
- "Shared KYC" import API — can pass existing MVGA KYC data
- 3DS supports Solana message signing
- Revenue share model (interchange fee cuts)

**API modules:** Users, KYC, Wallets, Cards, Card Payments, Webhooks, 3DS, Companies

**Card types:** Virtual, physical (branded plastic), digital (Apple Pay/Google Pay)

**KYC levels:**

- Light KYC: No document scan, lower limits, instant card
- Full KYC: ID scan, higher limits, upgradeable in-place

**Weaknesses:**

- **USDT NOT listed** (only USDC, wrapped USDC, Paxos)
- No Crunchbase profile, no public funding rounds
- Small team (2 named individuals)
- Copyright still says 2025
- Zero LatAm-specific evidence
- Waitlist/sales-driven access

**Assessment:** 7/10 legitimacy, 8/10 API quality, 3/10 Venezuela confidence

---

### 3. Rain.xyz (LONG-TERM OPTION)

**Company:** Signify Holdings, Inc. | NYC HQ (520 Broadway, 4th Floor)
**Founded:** 2021 by Farooq Malik, Charles Naut
**Funding:** **$58M Series B** led by Sapphire Ventures
**Website:** rain.xyz | Docs: docs.rain.xyz

**Key facts:**

- **Visa partnership** for onchain credit cards
- **Strategic partnership with Lithic** for stablecoin-powered payments
- Stablecoin-powered cards and payments infrastructure
- Targets platforms, fintechs, neobanks, developers
- 11-50 employees

**Why not primary:** Sales-driven enterprise process, likely longer timeline than Immersve/Kulipa for early-stage wallet.

---

### 4. Lithic (COMPLEMENTS RAIN)

**Company:** Developer-focused card issuing API (formerly Privacy.com B2B)
**Website:** lithic.com | Docs: docs.lithic.com

**Key facts:**

- Enterprise issuer processing with 99.99% uptime
- Direct network connections, comprehensive fraud controls
- **Self-service sandbox** — can start prototyping immediately
- Strategic partnership with Rain for stablecoin-to-card
- 2-4 week integration for basic virtual card program

**Best as:** Part of Rain+Lithic combo at scale.

---

### 5. Buvei (NOT RECOMMENDED)

**Company:** Claims licenses in HK (TCSP), US (FinCEN MSB), Lithuania (VASP)
**Website:** buvei.com

**Findings:**

- Supports USDT, USDC, DAI, ETH on TRC20 and ERC20 — **NO Solana support**
- 20+ BIN cards
- White-label and partner program available
- Claims sanctions screening, fraud detection, Apple/Google Pay
- Has Telegram channel, X/Twitter account
- App portal at app.buvei.com (behind Cloudflare)
- Multi-language site (EN, ES, AR, JA, RU, VI)

**Concerns:**

- No Solana support (deal-breaker for MVGA)
- API docs behind login wall (not publicly verifiable)
- No visible named team members
- FinCEN MSB registration couldn't be verified (iframe-based search tool)
- Primarily a consumer virtual card platform with B2B aspirations

---

### 6. VMCardio (DO NOT USE)

**Website:** vmcardio.com

**Critical red flags:**

- **Chinese-operated** platform disguised as Western service
- Source code contains: Baidu Analytics, JPush (Chinese push), GeeTest (Chinese CAPTCHA), Chuanglan verification
- All code comments in Chinese (百度统计脚本, 官网, 创蓝-滑动验证, etc.)
- **"No KYC needed"** — major compliance red flag
- No company information, no team, no legal entity visible
- API docs page (docs.vmcardio.com) returns empty content
- Built with Vue.js + Element Plus + Vuetify (Chinese tech startup stack)

**Assessment:** This is a Chinese virtual card reselling platform. Major regulatory, compliance, operational, and reputational risk. **Absolutely do not use.**

---

### 7. Bridge.xyz (COMPLEMENTARY, NOT CARD ISSUER)

**Company:** Acquired by Stripe (~$1.1B, 2024)
**Website:** bridge.xyz

**What it does:** Stablecoin orchestration, on/off-ramps, cross-border transfers. Strong LatAm presence.

**What it doesn't do:** Issue cards. The `/products/issuance` page returns 404.

**Useful as:** Supplementary stablecoin infrastructure layer alongside a card issuer.

---

### 8. Marqeta (OVERKILL)

**Company:** NASDAQ: MQ. Powers Square/Cash App, DoorDash, Uber, Klarna.

**Assessment:** Gold standard but 3-6+ month integration, significant minimum volumes, enterprise sales process. Too heavy and expensive for early-stage MVGA.

---

## Venezuela: The Critical Question

**No provider explicitly confirms Venezuela support.** This is systemic, not provider-specific:

1. **OFAC sanctions** on Venezuela create compliance risk for all card issuers
2. Sanctions primarily target government/oil sector/SDN individuals, but card issuers are conservative
3. Mastercard does operate in Venezuela (merchant acceptance exists)
4. Cards may work for **spending internationally** even if issuance to VZ residents is restricted

**Action items:**

- Contact Immersve: Can Venezuelan nationals/residents be issued cards? Which LatAm countries supported?
- Contact Kulipa: Same questions. Ask about KYC provider and VZ document support.
- Consider dual approach: Card for non-VZ LatAm users + Bitrefill/gift card integration for VZ users as backup

---

## Recommended Action Plan

### Phase 1: Outreach (This week)

1. Email Immersve partnerships team — mention Solana wallet, USDC, LatAm target. Request sandbox.
2. Email Kulipa via contact form — mention Ready case study resonates. Ask VZ/LatAm specifics.
3. Sign up for Lithic sandbox (self-service) — start prototyping in parallel.

### Phase 2: Evaluate (Week 2-3)

4. Compare sandbox experiences and pricing proposals
5. Confirm VZ/LatAm support with chosen provider
6. Make final decision

### Phase 3: Integrate (Week 3-6)

7. Integrate chosen provider SDK into MVGA wallet
8. Wire up CardPage waitlist → actual card issuance flow
9. Add KYC flow, card management UI, transaction history
10. Test, deploy, launch

---

## Existing MVGA Card Infrastructure

The wallet already has:

- `CardPage.tsx` — virtual card preview with waitlist form
- `BankingPage.tsx` — main banking hub with card preview section
- `POST /api/banking/card-waitlist` — waitlist endpoint (live)
- `GET /api/banking/card-waitlist/status` — waitlist status (live)
- `CardWaitlist` Prisma model (deployed)

When a provider is chosen, the integration replaces the "Coming Soon" mock with real SDK calls.
