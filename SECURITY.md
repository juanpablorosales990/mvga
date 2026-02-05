# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in MVGA, please report it responsibly.

**Do NOT open a public GitHub issue.**

Instead, email: **security@mvga.io**

Include:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We aim to acknowledge reports within 48 hours and provide a fix or mitigation within 7 days for critical issues.

## Scope

The following are in scope for security reports:

- **API** (`apps/api`): Authentication bypass, authorization flaws, injection vulnerabilities, data exposure
- **Wallet** (`apps/wallet`): Private key exposure, transaction manipulation, XSS, phishing vectors
- **Smart contracts / on-chain**: Escrow logic flaws, token minting exploits, staking reward manipulation
- **Infrastructure**: Misconfigured CORS, missing rate limits, exposed secrets

## Out of Scope

- Denial-of-service attacks
- Social engineering
- Third-party dependencies (report upstream)
- Issues in test/development environments only

## Security Measures

MVGA implements the following security controls:

- **JWT authentication** with minimum 32-character secrets in production
- **Helmet.js** security headers on all API responses
- **Rate limiting** via `@nestjs/throttler`
- **Input validation** via `class-validator` (whitelist mode)
- **CORS** restricted to known origins
- **On-chain escrow** for P2P trades (no custodial holding)
- **Sentry** error tracking for anomaly detection

## Responsible Disclosure

We believe in responsible disclosure. If you report a valid vulnerability:

- We will credit you (unless you prefer anonymity)
- We will not take legal action against good-faith researchers
- We will work with you to understand and fix the issue

Thank you for helping keep MVGA secure.
