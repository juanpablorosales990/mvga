# MVGA vs Meru: Competitive Teardown + Master Plan (PWA + App Store Wrapper)

Date: 2026-02-09

## Goal

Build a MVGA onboarding + home experience that is:

- Faster to first value than Meru
- Clearer about security (self-custody) without overwhelming users
- More premium visually (typography, spacing, motion, feedback)
- App-Store-ready via a PWA wrapper (Capacitor) with meaningful native value

This document is based on competitor screenshots (Meru) and MVGA's current wallet PWA code in `apps/wallet`.

## Meru: What They Do Well (Observed Patterns)

### Onboarding principles

- One primary CTA anchored at the bottom (large, obvious).
- Strong "disabled until valid" gating (inputs + checklists).
- Simple, linear flow with clear success checkpoints.
- Optional steps (referral code) are clearly skippable.

### Onboarding steps (as shown)

- Welcome (Sign in / Sign up)
- Country of residence picker with search + flag list
- Email entry (Continue disabled until filled)
- Password creation with checklist + Terms checkbox
- Phone verification with channel choice (WhatsApp vs SMS)
- Referral code (optional, clear "I don't have a code")
- Claim unique $handle for receiving payments
- Create 4-digit security PIN + confirm PIN
- Enable biometrics (FaceID) success screen
- Land on home dashboard

### Home/dashboard patterns

- Top bar: avatar/name + notifications + QR + support
- Balance card with currency flag
- Primary actions: Deposit / Withdraw
- Prominent shortcuts for bank rails (US / IBAN / Mexico)
- KYC banner ("Verify your identity") as a gated upgrade
- Quick actions row: Cards, Send, Yield, Stocks, Get paid by link
- Referral/promo banner + transactions list

## MVGA: Strategic Advantage (How We Beat Them)

Meru's flow is polished but "account-first" and identity-heavy.
MVGA can win by being "value-first" (instant wallet + instant receiving) while still offering an account layer for rails.

Core positioning to out-execute:

- "Start in 60 seconds, no bank required." (wallet-first)
- "Get paid by link or QR immediately." (payment link-first)
- "Security that feels modern: passkeys/biometrics + optional PIN." (better than 4-digit PIN only)
- "LATAM-first rails: Pago Movil + bank cashout + phone top-ups." (localized)

## Master Plan: Onboarding v2 (Self-Custody + Account Layer)

### Phase 0: Language + country (optional but high-value)

- First screen: pick language (ES/EN) and country (defaults via locale).
- Explain that identity verification is optional and can be done later for higher limits.

### Phase 1: Security setup (local)

Objective: make "security" feel guided, not scary.

- Option A (preferred): Passkey / biometrics unlock (WebAuthn where supported; otherwise platform biometrics via wrapper).
- Option B: Create a 6-digit PIN (beats 4-digit) with attempt limits + exponential backoff.
- Keep existing password-based encryption as fallback/export mechanism.

### Phase 2: Create wallet + backup phrase

Objective: keep the non-negotiable (seed phrase) but reduce drop-off.

- Show 12-word recovery phrase with:
  - Clear warning about irreversible loss
  - "Show words" toggle (default hidden)
  - Copy disabled by default (optional "copy anyway" with warning)
- Confirm backup with 3 random words (already implemented) + progress indicator.

### Phase 3: Claim $MVGA tag (high conversion)

Objective: receiving money is the fastest "aha" moment.

- Claim `$tag` with:
  - live validation
  - char counter
  - reserved words list
  - "Skip for now" option
- After claim: show "Your link" + QR + "Share" CTA.

### Phase 4: Funding rails (guided shortcuts)

- Deposit options: USDC, bank transfer, cashout rails.
- Keep "verify identity" as an upgrade banner if required for rails.

### Phase 5: Optional referral

- Optional referral entry with clear "No code" skip.
- Post-onboarding: referral banner, not blocking.

## Master Plan: Home/Dashboard v2

MVGA already has a strong base (`WalletPage.tsx` + quick actions + GettingStarted).
To beat Meru:

- Make top area "action-first":
  - Balance card + Deposit / Withdraw primary buttons
  - "Get paid by link" as a 3rd equally prominent CTA
- Add a KYC/identity banner that is contextual:
  - Shown only when user attempts gated features (card, off-ramp, bank rails)
- Replace or complement GettingStarted with:
  - "Security status" (backup confirmed, biometric enabled, tag claimed)
  - "Next best action" (one card only, not a checklist wall)
- Add a "bank rails" shortcut section:
  - US account, IBAN, LATAM banks as pills/cards (feature-flagged if not enabled)
- Add a "Share your link" module:
  - QR + short link + copy/share

## Visual System: Make It Look Better Without Copying

Avoid cloning Meru's trade dress (white + blue pill buttons).
Keep MVGA's black + gold identity, but refine it:

- Typography:
  - Keep bold MVGA wordmark but use a calmer body font.
  - Reduce all-caps usage for long paragraphs (keep for labels only).
- Spacing + layout:
  - Use larger vertical rhythm, fewer borders, more depth via subtle shadows/gradients.
- Motion:
  - Staggered entrance on onboarding.
  - Progress indicator at top (thin segmented line).
- Feedback:
  - Clear disabled states (opacity + cursor + helper text).
  - "Success" screens for key steps (tag claimed, security enabled).

## App Store Plan (PWA-Based)

Important reality: Apple does not allow listing a "PWA only" as an App Store app.
To ship MVGA in the App Store while keeping the same codebase, use a native wrapper.

Recommended approach: Capacitor (iOS) wrapping the existing `apps/wallet` build.

Minimum native value to pass App Review (avoid 4.2 rejection):

- FaceID/TouchID unlock for the wallet
- Keychain-backed secure storage for encrypted key material
- Push notifications (optional but strong)
- Camera access for QR scan (deposit/receive)
- Deep links (mvga://pay/..., universal links)

Phased shipping:

- Short-term: TestFlight build for internal/beta distribution
- Medium-term: App Store submission after adding the native value items above

## 14-Hour Launch Priorities (Do These First)

Focus on stability + clarity, not new features:

- Confirm production is up (web + wallet + API) and capture Playwright screenshots.
- Ensure onboarding has zero dead-ends:
  - clear errors
  - consistent disabled button gating
  - "Back" works everywhere
- Make "Get paid by link" a first-class CTA and test end-to-end payment link creation.
- Ensure security posture is acceptable:
  - clickjacking headers
  - cookie settings
  - rate limiting

## Mapping to Current MVGA Code

Key files:

- App shell + state gating: `apps/wallet/src/App.tsx`
- Onboarding (create/import + mnemonic): `apps/wallet/src/components/OnboardingScreen.tsx`
- Lock + biometrics: `apps/wallet/src/components/LockScreen.tsx`
- Welcome tour slides: `apps/wallet/src/components/WelcomeTour.tsx`
- Dashboard: `apps/wallet/src/pages/WalletPage.tsx`
- Payment links + QR: `apps/wallet/src/pages/ChargePage.tsx`
- Banking rails: `apps/wallet/src/pages/BankingPage.tsx`
- API payments endpoint: `apps/api/src/modules/payments/*`
