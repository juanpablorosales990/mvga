# MVGA Card Infrastructure Research — February 6, 2026

## The LATAM Crypto Card Infrastructure Map

Every serious LATAM crypto card product uses one of two providers:

### Rain (rain.xyz) — The Crypto-Native King

**Powers:** Meru, Takenos, Wallbit, Qash, KAST, Cadana, Offramp, Avalanche Card

| Fact         | Detail                                                                        |
| ------------ | ----------------------------------------------------------------------------- |
| Type         | Visa Principal Member (issues directly, no BIN sponsor needed)                |
| Processor    | Paymentology                                                                  |
| Settlement   | Direct USDC settlement with Visa, 24/7/365                                    |
| LATAM        | 6+ countries (AR, CO, MX, CL, PE + Caribbean)                                 |
| Funding      | $338M total, $1.95B valuation (Jan 2026 Series C)                             |
| Market share | 80%+ of global crypto card volume                                             |
| Chains       | Solana, Ethereum, Base, Arbitrum, Optimism, Avalanche, Polygon, Stellar, Tron |
| Stablecoins  | USDC, USDT, USDG, PYUSD, USD+                                                 |
| Timeline     | 6-8 weeks typical; under 2 weeks possible                                     |
| Docs         | docs.rain.xyz (access-code gated)                                             |
| Contact      | rain.xyz/contact-us or charles@rain.xyz                                       |

**Integration Flow:**

1. User signs up → your backend submits KYC to Rain `/issuing/applications/user`
2. Rain processes KYC → returns userId
3. Deploy smart contract `/issuing/users/{userId}/contracts` to hold collateral
4. User funds contract with USDC on-chain
5. Issue card `/issuing/users/{userId}/cards` → virtual Visa card linked to contract
6. User spends → Rain authorizes against collateral → settles daily in USDC with Visa

**Dev API:** `https://api-dev.raincards.xyz/v1` (sandbox shortcut: set lastName to "approved" to skip KYC)

---

### Pomelo (pomelo.la) — The LATAM Infrastructure Backbone

**Powers:** Lemon Cash, Belo, Buenbit, Ripio, Bitso, DolarApp

| Fact           | Detail                                                           |
| -------------- | ---------------------------------------------------------------- |
| Type           | BIN Sponsor + Issuer Processor (Visa + Mastercard)               |
| Countries      | AR, BR, CL, CO, MX, PE, CR, PA (8 countries)                     |
| Scale          | 150+ clients, 55M tx/day capacity                                |
| Crypto clients | Lemon Cash, Ripio, Bitso, Buenbit, Belo                          |
| Timeline       | 11 days for virtual cards; 18 days proven with Stable (Colombia) |
| Docs           | docs.pomelo.la (public), developers.pomelo.la                    |
| Sandbox        | developers.pomelo.la/register (immediate access, AR/BR/MX)       |
| SDKs           | iOS (Swift), Android (Kotlin)                                    |

**Key difference:** Pomelo is NOT crypto-native. YOU handle USDC→fiat conversion. Their real-time authorization webhook sends each transaction to your backend — you check the user's crypto balance, convert, and respond APPROVE/REJECT.

**How crypto wallets use Pomelo:**

1. User holds USDC in your wallet
2. User taps card at merchant
3. Pomelo sends authorization webhook to your backend
4. Your backend checks user's USDC balance, converts to fiat equivalent
5. Responds APPROVE + available balance
6. Pomelo settles with Visa/Mastercard in local fiat

---

## Who Powers Which LATAM Crypto App

| App        | Infrastructure          | Network    | Countries                   |
| ---------- | ----------------------- | ---------- | --------------------------- |
| Meru       | **Rain**                | Visa       | Colombia, LATAM-wide        |
| Takenos    | **Rain**                | Visa       | Argentina, Uruguay, Mexico  |
| Wallbit    | **Rain**                | Visa       | Argentina, Colombia, Mexico |
| Qash       | **Rain**                | Visa       | Colombia                    |
| KAST       | **Rain**                | Visa       | Global/emerging markets     |
| Lemon Cash | **Pomelo**              | Visa       | Argentina, Peru             |
| Ripio      | **Pomelo**              | Visa       | Argentina, Brazil           |
| Bitso      | **Pomelo**              | Mastercard | Mexico                      |
| Buenbit    | **Pomelo**              | Mastercard | Argentina                   |
| Belo       | **Pomelo**              | Mastercard | Argentina                   |
| DolarApp   | **Pomelo**              | Visa/MC    | Mexico, Colombia            |
| Kontigo    | Unknown (likely Pomelo) | Mastercard | Curacao-registered, LATAM   |
| Crypto.com | **i2c**                 | Visa       | 90+ countries incl. LATAM   |

---

## Rain vs Pomelo for MVGA

|                       | Rain                      | Pomelo                             |
| --------------------- | ------------------------- | ---------------------------------- |
| Best for MVGA?        | Yes — turnkey stablecoin  | Maybe — more engineering           |
| You handle USDC→fiat? | No, Rain does it          | Yes, you build it                  |
| Card network          | Visa only                 | Visa + Mastercard                  |
| Stablecoin native?    | Yes, purpose-built        | No, fiat rails only                |
| LATAM coverage        | 6+ countries              | 8 countries                        |
| Integration effort    | Lower (one API)           | Higher (auth webhook + conversion) |
| Sandbox access        | Gated (need relationship) | Immediate registration             |
| Apple/Google Pay      | Yes                       | Yes (SDKs provided)                |
| Settlement            | USDC direct to Visa       | Local fiat                         |
| Venezuela?            | Must ask                  | Must ask                           |

---

## Other Providers Evaluated and Eliminated

| Provider        | Status         | Reason                                                                                     |
| --------------- | -------------- | ------------------------------------------------------------------------------------------ |
| Lithic          | **OUT**        | US-only cardholders (requires SSN). No crypto support.                                     |
| Striga          | **OUT**        | EEA-only. Acquired by Lightspark Oct 2025. License expires Jul 2026.                       |
| Buvei           | **DO NOT USE** | Anonymous operators. Unverified licenses. No KYC = compliance violation. $5 liability cap. |
| Immersve        | Fallback       | No Solana support yet. EEA/US/NZ/AU only. LATAM on roadmap.                                |
| Kulipa          | Fallback       | USDC on Solana native. But cardholder countries undisclosed. Small team.                   |
| Bridge (Stripe) | Strong option  | Best confirmed LATAM (AR, CO, EC, MX, PE, CL). Stablecoin Visa cards. Apply for access.    |
| Marqeta         | Too slow       | Enterprise-oriented. Brazil only in LATAM. 3-6+ months.                                    |
| VMCardio        | **DO NOT USE** | Chinese-operated. No KYC. Zero documentation.                                              |

---

## Integration Timelines

### Rain (Estimated)

| Step                                 | Timeline                              |
| ------------------------------------ | ------------------------------------- |
| Contact → scoping call               | Days to 1 week                        |
| Commercial agreement + due diligence | 1-3 weeks                             |
| Program design                       | 1-2 weeks                             |
| Technical integration                | 2-4 weeks                             |
| **Total (virtual cards)**            | **6-8 weeks; under 2 weeks possible** |

### Pomelo (Estimated)

| Step                               | Timeline                       |
| ---------------------------------- | ------------------------------ |
| Contact → contract                 | Days to weeks                  |
| Sandbox → virtual card integration | **As fast as 11 days**         |
| Full physical card program         | ~2 months                      |
| **Proven fastest**                 | **18 days (Stable, Colombia)** |

---

## Recommended Action Plan

### Primary: Rain

- Best architectural fit (stablecoin-native, Solana supported, handles USDC→fiat)
- Meru/Takenos/Wallbit/Qash are direct comps — all use Rain
- Contact: rain.xyz/contact-us

### Secondary: Pomelo

- Best LATAM coverage (8 countries, BIN sponsor)
- Proven with crypto wallets (Lemon, Bitso, Ripio)
- More engineering required (you build the conversion layer)
- Contact: pomelo.la/en (form), sandbox: developers.pomelo.la/register

### Parallel: Bridge (Stripe)

- Best confirmed LATAM stablecoin card coverage
- Visa partnership, Stripe backing
- Contact: bridge.xyz

### Venezuela Question

No provider explicitly confirms Venezuela support. Must ask each directly:
"Can you issue cards to KYC'd users who are residents of Venezuela?"
