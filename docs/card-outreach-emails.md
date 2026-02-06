# MVGA Card Provider Outreach Emails — February 6, 2026

---

## RAIN (rain.xyz)

### Contact Form (Short Version)

**To:** rain.xyz/contact-us
**Subject:** Solana USDC wallet for Venezuela — replicating the Meru/Wallbit model

MVGA (mvga.io) is a US-incorporated, open-source financial platform on Solana serving Venezuela and Latin America. We have a production wallet (app.mvga.io) with USDC send/receive, P2P fiat-to-crypto exchange with on-chain escrow, staking governance, and a growing card waitlist. We're looking to replicate the same model you power for Meru, Wallbit, and Takenos — US-issued Visa cards with international KYC for LATAM users. Our target market is the 7M+ Venezuelan diaspora currently paying 15% on remittances. We need virtual Visa cards funded by USDC on Solana, Apple Pay/Google Pay support, and cardholder issuance for Venezuela, Colombia, Argentina, and Mexico. We're ready to integrate immediately.

---

### Direct Email (Full Version)

**To:** charles@rain.xyz
**Subject:** Solana USDC wallet for Venezuela — replicating the Meru/Wallbit model

Hi Rain team,

I'm the founder of MVGA (mvga.io), a US-incorporated open-source financial platform on Solana serving Venezuela and Latin America. I'm reaching out because we've done our homework — we know Rain powers the card programs behind Meru, Wallbit, Takenos, Qash, and KAST. We want to build the same model for Venezuela's underserved market.

We're following the same architecture that works for your existing LATAM partners — US-incorporated entity, US-issued Visa cards via Rain, non-custodial USDC wallet, international KYC for LATAM users. The difference is our market: Venezuela has 7M+ diaspora sending money home through 15% remittance rails, one of the highest crypto adoption rates in LATAM, and almost no competition for a well-built stablecoin spend product.

What we've built (live in production at app.mvga.io):

- Non-custodial Solana wallet (React PWA + NestJS API) with USDC as primary store of value
- P2P fiat-to-crypto exchange with on-chain escrow — zero-fee remittances replacing traditional rails
- Staking governance with 4 tiers, community-voted humanitarian grants, and a transparent treasury where 100% of protocol fees flow back to users
- Card waitlist already live and collecting demand
- Full i18n (Spanish + English), entire codebase open-source

We've studied your /issuing/ API — user applications, smart contract deployment for on-chain collateral, virtual card issuance, and daily USDC settlement with Visa. We understand you're a Visa Principal Member issuing US-based cards with international KYC, which is exactly what we need.

The direct question: Do you currently support cardholder issuance for Venezuelan residents? We know Meru serves Venezuela through the US-issued card model — can we build the same?

We're ready to start building against your staging environment immediately. Happy to jump on a scoping call this week.

Best,
Juan Rosales
Founder, MVGA
mvga.io | app.mvga.io

---

## POMELO (pomelo.la)

### Email

**To:** pomelo.la/en contact form
**Subject:** Crypto wallet card program — BIN sponsorship for LATAM

Hi Pomelo team,

I'm the founder of MVGA (mvga.io), an open-source financial platform on Solana serving Venezuela and Latin America. We're looking for card-issuing infrastructure in LATAM and Pomelo is the clear leader — Lemon Cash, Bitso, Ripio, Belo all run on your rails. We want to be next.

What we've built (live in production):

- Non-custodial Solana wallet (React PWA + NestJS API) with USDC as the primary asset
- P2P fiat-to-crypto exchange with on-chain escrow — zero-fee remittances for the Venezuelan diaspora
- Staking governance with tiered rewards, community-voted humanitarian grants, and a transparent treasury — 100% of protocol fees flow back to users
- Card waitlist already collecting demand
- Full i18n (Spanish + English), deployed on Railway + Vercel

Why Pomelo: We understand Pomelo's model — BIN sponsorship + real-time authorization webhooks where we control approve/reject logic. This is exactly what we need. Our users hold USDC, and we'll build the conversion layer to check balances and approve transactions in real-time against their stablecoin holdings, the same architecture Lemon and Bitso use.

We've reviewed your public docs at docs.pomelo.la, understand the Cards API (/cards/v1/), the Identity/KYC module, and the authorization webhook flow. We've registered for sandbox access and are ready to start prototyping.

What we need:

- Virtual card program (Visa or Mastercard) with BIN sponsorship
- Apple Pay / Google Pay tokenization (push provisioning via your iOS/Android SDKs)
- Starting in one country (Argentina or Mexico), expanding to Colombia, Peru, Chile
- KYC via your Identity module (or import — we already collect user identity data)

Key questions:

1. Can you issue cards to users who are residents of Venezuela? If not, which countries can we start with?
2. Can we use our existing KYC data via the import API, or must we use Pomelo's Identity flow?
3. What are the settlement timing and collateral requirements for a USDC-funded prepaid card program?
4. What's realistic for timeline from contract to first virtual card issued?

We'd love to schedule a call to discuss program design and pricing. Our codebase is open-source — happy to share everything.

Best,
Juan Rosales
Founder, MVGA
mvga.io | app.mvga.io

---

## INTEGRATION CHEAT SHEET

### Rain — What to Expect

| Step                        | What Happens                                           | Timeline                 |
| --------------------------- | ------------------------------------------------------ | ------------------------ |
| 1. Submit contact form      | BD team reviews, schedules scoping call                | Days                     |
| 2. Scoping call             | Discuss modules needed, service tier, target countries | 30 min                   |
| 3. Due diligence + contract | Rain KYBs your entity, negotiate terms                 | 1-3 weeks                |
| 4. Sandbox access           | Get API key + docs.rain.xyz access code                | After contract or during |
| 5. Build integration        | `/issuing/` endpoints: user apps, contracts, cards     | 2-4 weeks                |
| 6. Go live                  | Virtual Visa cards issuing to users                    | **Total: 6-8 weeks**     |

**Rain handles:** USDC→fiat conversion, KYC, Visa settlement, smart contract deployment, compliance.
**You build:** Frontend card UI, user onboarding flow, webhook handler for transaction notifications.

### Pomelo — What to Expect

| Step                     | What Happens                                      | Timeline                             |
| ------------------------ | ------------------------------------------------- | ------------------------------------ |
| 1. Submit contact form   | Team reviews, contacts qualified candidates       | Days                                 |
| 2. Commercial discussion | Scope countries, card type, BIN sponsorship terms | 1-2 weeks                            |
| 3. Sandbox access        | Register at developers.pomelo.la — **immediate**  | Same day                             |
| 4. Build integration     | Cards API, auth webhook, KYC, tokenization        | 1-2 weeks                            |
| 5. Card design           | Custom branded card art                           | Parallel                             |
| 6. Go live (virtual)     | Issue first virtual cards                         | **As fast as 11 days from contract** |
| 7. Go live (physical)    | Card manufacturing + shipping                     | ~2 months                            |

**Pomelo handles:** BIN sponsorship, card network settlement (fiat), KYC, Apple/Google Pay tokenization, fraud monitoring.
**You build:** USDC→fiat conversion engine, real-time authorization webhook handler, liquidity management, card management UI.

---

## WHY RAIN IS THE PRIMARY CHOICE

Rain is the provider behind every major LATAM crypto card:

- Meru (Venezuela/LATAM freelancers)
- Wallbit (Argentina/Colombia/Mexico remote workers)
- Takenos (Argentina/Uruguay/Mexico cross-border)
- Qash (Colombia)
- KAST (Solana neobank)

The model: US-incorporated company → Rain issues US-based Visa cards → international KYC accepts local documents (cedula, passport) → users in LATAM spend USDC at 150M+ merchants → Rain settles daily in USDC with Visa.

Rain is a Visa Principal Member ($1.95B valuation, $338M raised). They handle USDC→fiat, KYC, compliance, and Visa settlement. You build the wallet and card UI.

Pomelo is the backup if Rain can't serve Venezuela or if you want Mastercard. But you'd need to build the USDC→fiat conversion layer yourself.
