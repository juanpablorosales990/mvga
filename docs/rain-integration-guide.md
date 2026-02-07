# Rain Card Integration Guide

Internal developer documentation for integrating Rain's stablecoin-to-Visa card infrastructure with MVGA.

---

## Overview

Rain (rain.xyz) is a Visa Principal Member that provides stablecoin-powered card issuance. Users fund their card with USDC on Solana, and Rain handles the conversion to fiat at point-of-sale. Settlement happens daily in USDC directly with Visa.

**MVGA architecture:** All Rain API calls are proxied through the MVGA backend (`/api/banking/*`). The Rain API key never touches the client. The wallet app calls MVGA backend endpoints, which call Rain's `/issuing/` API.

```
Wallet App  →  MVGA API  →  Rain API
(no API key)   (RAIN_API_KEY)   (rain.xyz)
```

---

## Sandbox Setup

### 1. Get Rain API credentials

Contact Rain: `rain.xyz/contact-us` or email `charles@rain.xyz`

Outreach email template is at `docs/card-outreach-emails.md`.

### 2. Configure environment variables

**API (`apps/api/.env`):**

```env
RAIN_API_KEY=your-sandbox-api-key
RAIN_API_URL=https://api-dev.raincards.xyz/v1
RAIN_CHAIN_ID=84532
```

**Railway (production):**

```bash
railway variables --set "RAIN_API_KEY=your-key"
railway variables --set "RAIN_API_URL=https://api-dev.raincards.xyz/v1"
railway variables --set "RAIN_CHAIN_ID=84532"
```

### 3. Verify configuration

```bash
# Check Rain adapter logs on API startup
npm run start:dev --workspace=apps/api
# Should see: "Rain API configured"
```

---

## API Reference

### MVGA Backend → Rain API Mapping

| MVGA Endpoint                        | Method | Rain Endpoint                                                                 | Purpose                        |
| ------------------------------------ | ------ | ----------------------------------------------------------------------------- | ------------------------------ |
| `/api/banking/kyc/submit`            | POST   | `POST /issuing/applications/user`                                             | Submit KYC                     |
| `/api/banking/kyc/status/:wallet`    | GET    | `GET /issuing/applications/user/:userId`                                      | Check KYC status               |
| `/api/banking/card/issue`            | POST   | `POST /issuing/users/:userId/contracts` + `POST /issuing/users/:userId/cards` | Deploy collateral + issue card |
| `/api/banking/card/:wallet`          | GET    | `GET /issuing/cards?userId=...&limit=1`                                       | Get card details               |
| `/api/banking/card/:wallet/balance`  | GET    | `GET /issuing/users/:userId/balances`                                         | Get card balance               |
| `/api/banking/card/:wallet/freeze`   | POST   | `PATCH /issuing/cards/:cardId`                                                | Freeze card                    |
| `/api/banking/card/:wallet/unfreeze` | POST   | `PATCH /issuing/cards/:cardId`                                                | Unfreeze card                  |
| `/api/banking/card/:wallet/fund`     | POST   | `GET /issuing/users/:userId/contracts`                                        | Get deposit address            |

### Rain API Authentication

All requests include the header:

```
Api-Key: <RAIN_API_KEY>
Content-Type: application/json
```

### Key Rain API Response Types

```typescript
// POST /issuing/applications/user
interface RainUserApplication {
  id: string; // Use as rainUserId
  applicationStatus: string; // "approved" | "pending" | "rejected"
  email?: string;
  isActive?: boolean;
}

// POST /issuing/users/:userId/cards
interface RainCard {
  id: string;
  type: 'virtual' | 'physical';
  status: string; // "active" | "frozen"
  last4: string;
  expirationMonth: number;
  expirationYear: number;
  limit: { frequency: string; amount: number };
  displayName?: string;
}

// GET /issuing/users/:userId/balances
interface RainBalance {
  creditLimit: number; // In cents
  spendingPower: number; // In cents — this is the available balance
  balanceDue: number; // In cents — pending charges
}

// POST /issuing/users/:userId/contracts
interface RainContract {
  id: string;
  chainId: number; // 84532 = Base Sepolia, 8453 = Base mainnet
  depositAddress: string; // Send USDC here to fund the card
  tokens: Array<{ address: string; balance: string }>;
}
```

---

## Flow Diagrams

### KYC → Card Issuance

```
User fills KYC form (CardPage.tsx)
    ↓
POST /api/banking/kyc/submit
    ↓ (backend)
POST /issuing/applications/user → RainUserApplication
    ↓
Store in CardApplication (rainUserId, status=KYC_PENDING or KYC_APPROVED)
    ↓
If approved → auto-issue:
    POST /issuing/users/:userId/contracts → RainContract
    POST /issuing/users/:userId/cards → RainCard
    ↓
Store rainCardId, depositAddr, status=CARD_ISSUED
    ↓
Return card details to client
```

### Funding the Card

```
User taps "Fund Card" → enters amount
    ↓
POST /api/banking/card/:wallet/fund
    ↓ (backend)
GET /issuing/users/:userId/contracts → depositAddress
    ↓
Return depositAddress to client
    ↓ (client)
Build SPL transfer: user USDC ATA → depositAddress
User signs transaction
    ↓
Rain detects on-chain deposit → updates balance
    ↓
GET /api/banking/card/:wallet/balance → updated balance
```

### Card Spending

```
User swipes card at merchant (Visa terminal)
    ↓
Rain receives authorization request from Visa
    ↓
Rain checks spendingPower (USDC collateral)
    ↓ sufficient
Rain approves transaction
Rain converts USDC → fiat at prevailing rate
    ↓
Daily settlement: Rain ↔ Visa in USDC
```

---

## Testing Playbook

### Sandbox Test Sequence

1. **Start API with Rain credentials:**

   ```bash
   # Ensure RAIN_API_KEY is set in .env
   npm run start:dev --workspace=apps/api
   ```

2. **Submit KYC:**

   ```bash
   curl -X POST http://localhost:4000/api/banking/kyc/submit \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <auth-token>" \
     -d '{
       "walletAddress": "<your-wallet>",
       "firstName": "Test",
       "lastName": "User",
       "email": "test@mvga.io",
       "dateOfBirth": "1990-01-01",
       "address": { "line1": "123 Main St", "city": "Miami", "region": "FL", "postalCode": "33101", "countryCode": "US" },
       "nationalIdType": "passport",
       "nationalId": "TEST123456"
     }'
   ```

3. **Check KYC status:**

   ```bash
   curl http://localhost:4000/api/banking/kyc/status/<wallet>
   ```

4. **Issue card (if KYC approved):**

   ```bash
   curl -X POST http://localhost:4000/api/banking/card/issue \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <auth-token>" \
     -d '{ "walletAddress": "<your-wallet>" }'
   ```

5. **Get card details:**

   ```bash
   curl http://localhost:4000/api/banking/card/<wallet>
   ```

6. **Get balance:**

   ```bash
   curl http://localhost:4000/api/banking/card/<wallet>/balance
   ```

7. **Freeze/unfreeze:**
   ```bash
   curl -X POST http://localhost:4000/api/banking/card/<wallet>/freeze \
     -H "Authorization: Bearer <auth-token>"
   ```

### Full E2E Test (via wallet UI)

1. Open `app.mvga.io` (or localhost:5173)
2. Navigate to Banking → Card
3. If waitlisted, fill KYC form
4. After approval, card should auto-issue
5. View card details (last4, expiry)
6. Fund card with USDC
7. Check balance updates
8. Freeze/unfreeze card
9. Verify all state persists across page refreshes

---

## Production Checklist

| Item                | Sandbox                    | Production                               |
| ------------------- | -------------------------- | ---------------------------------------- |
| `RAIN_API_URL`      | `api-dev.raincards.xyz/v1` | `api.raincards.xyz/v1`                   |
| `RAIN_CHAIN_ID`     | `84532` (Base Sepolia)     | `8453` (Base mainnet)                    |
| `RAIN_API_KEY`      | Sandbox key                | Production key                           |
| KYC verification    | Auto-approved              | Real verification                        |
| Collateral chain    | Base Sepolia               | Base mainnet (or Solana when supported)  |
| Card limits         | Test limits                | Negotiated limits                        |
| Transaction history | Mock data                  | Real data (when Rain endpoint available) |

---

## Venezuela Compliance Notes

### OFAC Considerations

- Venezuela has OFAC sanctions (Executive Order 13692)
- **Sectoral sanctions** target government entities, not individual citizens
- Most crypto card providers serving LatAm (Meru, Wallbit, Takenos) use the **US-issued card model**: US-incorporated entity issues cards to international users with KYC
- Rain is a Visa Principal Member issuing US-based cards — they can serve international users
- **Key question for Rain:** Can they issue cards to Venezuelan residents/nationals?
- Meru (rain-powered) reportedly serves Venezuelan freelancers via this model

### Risk Mitigation

1. MVGA is US-incorporated — operates as a US fintech
2. KYC captures national ID and address — sanctions screening is Rain's responsibility
3. Rain handles all compliance (KYC/AML, OFAC screening, Visa requirements)
4. MVGA does not custody funds or process fiat — Rain handles the conversion

### What to Confirm with Rain

- [ ] Can you issue cards to Venezuelan residents?
- [ ] What national ID types do you accept from Venezuela (cedula, passport)?
- [ ] Are there country-specific card limits?
- [ ] Do you perform enhanced due diligence for sanctioned-adjacent countries?
- [ ] What's the timeline for Solana-native collateral contracts (vs Base)?

---

## Database Schema

### CardApplication Model

```prisma
model CardApplication {
  id            String        @id @default(uuid())
  walletAddress String
  rainUserId    String?       @unique  // Rain's user ID after KYC
  rainCardId    String?       @unique  // Rain's card ID after issuance
  status        CardAppStatus @default(WAITLISTED)
  kycData       Json?                  // Encrypted KYC submission
  chainId       Int?                   // Collateral contract chain
  depositAddr   String?                // Rain collateral deposit address
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@index([walletAddress])
  @@index([status])
}

enum CardAppStatus {
  WAITLISTED
  KYC_PENDING
  KYC_APPROVED
  KYC_REJECTED
  CARD_ISSUED
  FROZEN
}
```

### Migration SQL

```sql
-- Run via psql with SET ROLE postgres
CREATE TYPE "CardAppStatus" AS ENUM ('WAITLISTED', 'KYC_PENDING', 'KYC_APPROVED', 'KYC_REJECTED', 'CARD_ISSUED', 'FROZEN');

CREATE TABLE "CardApplication" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "walletAddress" TEXT NOT NULL,
  "rainUserId" TEXT,
  "rainCardId" TEXT,
  "status" "CardAppStatus" NOT NULL DEFAULT 'WAITLISTED',
  "kycData" JSONB,
  "chainId" INTEGER,
  "depositAddr" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CardApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CardApplication_rainUserId_key" ON "CardApplication"("rainUserId");
CREATE UNIQUE INDEX "CardApplication_rainCardId_key" ON "CardApplication"("rainCardId");
CREATE INDEX "CardApplication_walletAddress_idx" ON "CardApplication"("walletAddress");
CREATE INDEX "CardApplication_status_idx" ON "CardApplication"("status");
```

---

## Architecture Files

| File                                                 | Layer   | Purpose                          |
| ---------------------------------------------------- | ------- | -------------------------------- |
| `apps/api/src/modules/banking/rain.adapter.ts`       | Backend | Rain API wrapper (holds API key) |
| `apps/api/src/modules/banking/banking.service.ts`    | Backend | Business logic, DB operations    |
| `apps/api/src/modules/banking/banking.controller.ts` | Backend | REST endpoints                   |
| `apps/api/src/modules/banking/dto/kyc.dto.ts`        | Backend | KYC validation                   |
| `apps/api/src/modules/banking/dto/card.dto.ts`       | Backend | Card operation DTOs              |
| `apps/wallet/src/services/cardService.ts`            | Client  | API client (calls MVGA backend)  |
| `apps/wallet/src/services/cardService.types.ts`      | Client  | TypeScript types                 |
| `apps/wallet/src/hooks/useCard.ts`                   | Client  | React hook for card state        |
| `apps/wallet/src/pages/CardPage.tsx`                 | Client  | Card UI (957 lines)              |
| `apps/wallet/src/pages/BankingPage.tsx`              | Client  | Banking hub                      |
