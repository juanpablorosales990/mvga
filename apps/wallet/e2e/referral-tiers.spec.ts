import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

test.describe('Referral Page — Tiers & QR with Mocked API', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth + referral API before wallet creation so isAuthenticated = true
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          wallet: 'MockWallet1234',
          email: null,
          displayName: null,
          username: null,
        }),
      })
    );
    await page.route('**/api/auth/nonce', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ nonce: 'mock-nonce-12345' }),
      })
    );
    await page.route('**/api/referrals/code', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'TESTCODE123' }),
      })
    );
    await page.route('**/api/referrals/stats', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'TESTCODE123',
          totalReferrals: 3,
          totalEarned: 300,
          referrals: [],
        }),
      })
    );

    await createWalletAndUnlock(page);

    // Navigate to referral page
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await expect(page).toHaveURL('/more');
    await page
      .getByRole('link', { name: /referral|referidos/i })
      .first()
      .click();
    await expect(page).toHaveURL('/referral');
    await expect(page.getByText(/referral program|programa de referidos/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows QR code for invite link', async ({ page }) => {
    await expect(page.locator('.card svg').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows tier progress with all 4 tiers', async ({ page }) => {
    await expect(page.getByText(/referral tier|nivel de referidos/i).first()).toBeVisible({
      timeout: 10000,
    });

    await expect(page.getByText('Bronze').first()).toBeVisible();
    await expect(page.getByText('Silver').first()).toBeVisible();
    await expect(page.getByText('Gold').first()).toBeVisible();
    await expect(page.getByText('Diamond').first()).toBeVisible();

    // Progress bar
    await expect(page.locator('.bg-gold-500.transition-all').first()).toBeVisible();
  });

  test('shows stats cards with totals', async ({ page }) => {
    await expect(page.getByText(/total referrals|total de referidos/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/total earned|total ganado/i).first()).toBeVisible();
    // Mocked: 300 MVGA earned
    await expect(page.getByText('300').first()).toBeVisible();
  });

  test('shows copy button and how-it-works section', async ({ page }) => {
    await expect(page.getByRole('button', { name: /copy|copiar/i }).first()).toBeVisible({
      timeout: 10000,
    });

    await expect(page.getByText(/how it works|cómo funciona/i).first()).toBeVisible();
  });
});
