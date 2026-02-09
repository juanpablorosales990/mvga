# MVGA Security Best Practices Report (2026-02-09)

## Executive Summary

- Production deployments are up:
  - `mvga.io` and `app.mvga.io` serve valid TLS certs (SAN includes `mvga.io` and `*.mvga.io`).
  - Railway API is running and responding (`https://api.mvga.io/api/health` is `200`).
  - Supabase migrations are in sync (local == remote through `20260209031000`).
- Highest risk items before launch are dependency advisories (Next.js DoS; Solana `bigint-buffer`; `axios@0.25.0` nested in Whirlpool SDK) plus missing security response headers on `app.mvga.io`.
- Fixes applied in this working branch:
  - Auth cookie hardened to `SameSite=Lax` to reduce CSRF risk.
  - API upgraded to `@nestjs/config@4.0.3` (compatible with Nest 10) to pick up patched `lodash@4.17.23`.
  - Wallet app: removed invalid `frame-ancestors` from CSP meta and added Vercel headers (`X-Frame-Options` + CSP `frame-ancestors`) to prevent clickjacking.

## Scope

This report covers:

- Backend: `apps/api` (NestJS + Prisma + Postgres + Solana integrations)
- Marketing site: `apps/web` (Next.js)
- Wallet app: `apps/wallet` (Vite + React PWA)
- Dependency tree and deployment posture (Vercel/Railway/Supabase)

## Findings

### Critical

**C-001: Production auth cookie was configured with `SameSite=None` (CSRF posture)**

Impact: A malicious site could potentially trigger authenticated, state-changing requests against `api.mvga.io` using a victim’s session cookie (classic CSRF), because `SameSite=None` allows cross-site cookie sending.

Evidence:

- `apps/api/src/modules/auth/auth.controller.ts:12-21` and `apps/api/src/modules/auth/auth.controller.ts:54-63` (cookie flags)

Fix applied:

- Updated cookie to `SameSite=Lax` (see `apps/api/src/modules/auth/auth.controller.ts:16-20` and `apps/api/src/modules/auth/auth.controller.ts:57-62`).

Notes:

- `mvga.io`, `app.mvga.io`, and `api.mvga.io` are the same “site” (`mvga.io`), so `SameSite=Lax` still allows normal same-site XHR/fetch from the wallet app to the API while blocking cross-site CSRF attempts.

### High

**H-001: `app.mvga.io` lacks clickjacking protection headers; `frame-ancestors` in meta CSP was ignored**

Impact: Without effective framing controls, the wallet app can be embedded in an attacker-controlled iframe and used for UI-redress attacks (clickjacking).

Evidence:

- Response headers for `https://app.mvga.io` currently do not include `X-Frame-Options` or CSP headers (verified with `curl -I`).
- Browser console warning was observed previously: “CSP directive `frame-ancestors` is ignored when delivered via a `<meta>` element.”
- `apps/wallet/index.html:13` contained `frame-ancestors 'none'` inside the meta CSP (not enforced by browsers).

Fix applied:

- Removed `frame-ancestors` from the meta CSP: `apps/wallet/index.html:13`.
- Added Vercel headers enforcing framing protections and basic hardening:
  - `apps/wallet/vercel.json:4-12`

**H-002: Known high-severity dependency advisories remain (supply-chain / DoS / native bindings)**

Impact: Vulnerable dependencies can expand attack surface (DoS vectors, SSRF-style bugs in HTTP clients, and native binding memory issues).

Evidence (from `npm audit --omit=dev` artifacts):

- Next.js DoS advisories in marketing site: `output/npm-audit-web.json` (package `next`)
- API advisories: `output/npm-audit-api-20260209041430.json`

Key items:

- `apps/web` uses `next@14.2.35` and is flagged by advisories requiring major upgrades to fully resolve (first fixed versions are in Next 15+ according to `npm audit`).
- `axios@0.25.0` is nested under `@orca-so/whirlpool-sdk@0.4.2` (no newer Whirlpool SDK release found on npm).
- `bigint-buffer@1.1.5` is pulled in via Solana token tooling; there is no patched npm release at the time of this audit.

Mitigation guidance (pre-launch pragmatic):

- Treat these as “known residual risks” for launch if upgrading would be destabilizing.
- Prefer isolating the code paths using Whirlpool / DeFi SDKs so attacker-controlled input cannot influence request destinations or buffer contents.
- Plan a post-launch upgrade window to:
  - Move `apps/web` to a fixed Next major version
  - Re-evaluate whether Whirlpool SDK can be replaced or vendored with a safer HTTP client

### Medium

**M-001: `@nestjs/swagger` pins `lodash@4.17.21` and `js-yaml@4.1.0` (cannot be patched without larger upgrade)**

Impact: `npm audit` continues to report moderate advisories (`lodash` prototype pollution class; `js-yaml` issues) because `@nestjs/swagger@7.x` depends on exact vulnerable versions.

Evidence:

- `apps/api/package.json` includes `@nestjs/swagger` (current `7.x` line).
- `npm audit` includes `lodash` + `js-yaml` findings in `output/npm-audit-api-20260209041430.json`.

Notes:

- Upgrading `@nestjs/swagger` to the newest major that patches these pins requires upgrading Nest to v11 (peer dependency mismatch), which is a non-trivial pre-launch change.

### Low

**L-001: Tracked build artifact (`apps/web/tsconfig.tsbuildinfo`)**

Impact: Not a security issue; creates repo noise and can cause confusing diffs.

Evidence:

- `apps/web/tsconfig.tsbuildinfo` exists in the repo even though `.gitignore` contains `*.tsbuildinfo`.

Recommendation:

- Remove from git index post-launch (or in a separate cleanup commit) to avoid mixing with launch-critical changes.

## Positive Security Posture Notes

- API enforces env validation (JWT secret length in prod; required vars): `apps/api/src/main.ts:21-62`.
- API uses Helmet, strict validation, and restricted CORS origins: `apps/api/src/main.ts:80-116` and `apps/api/src/main.ts:96-107`.
- Swagger docs are disabled in production: `apps/api/src/main.ts:121-132`.

## Verification Performed

- Railway: tailed logs show Nest app successfully starts and cron locks run without crashes.
- Supabase: `supabase migration list` local == remote through `20260209031000`.
- Vercel: domains point to correct projects and nameservers are set to Vercel DNS.
- Local CI-like checks:
  - `apps/api`: `npm test`, `npm run lint`, `npm run build` passed (lint has warnings only).
  - `apps/wallet`: `npm test`, `npm run lint`, `npm run build` passed (lint has warnings only).
  - `apps/web`: `npm run lint`, `npm run build` passed.
- Playwright smoke screenshots captured to:
  - `output/playwright/mvga-io-home-20260208231847.png`
  - `output/playwright/mvga-io-transparency-20260208231847.png`
  - `output/playwright/app-mvga-io-20260208231847.png`
  - Console log: `output/playwright/console-20260208231847.json`
