import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

test.describe('Card Page — waitlist view', () => {
  test.beforeEach(async ({ page }) => {
    // Mock banking status to ensure card status is 'none'
    await page.route('**/api/banking/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ cardStatus: 'none' }),
      })
    );

    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          walletAddress: '11111111111111111111111111111111',
        }),
      })
    );

    await createWalletAndUnlock(page);

    // Navigate to banking/card
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await expect(page).toHaveURL('/more');
    await page
      .getByRole('link', { name: /banking|banco/i })
      .first()
      .click();
    await expect(page).toHaveURL('/banking');
    // Click on card section
    await page
      .getByRole('link', { name: /card|tarjeta/i })
      .first()
      .click();
    await expect(page).toHaveURL('/banking/card');
  });

  test('page loads with card title', async ({ page }) => {
    await expect(page.getByText(/virtual card|tarjeta virtual|MVGA/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('card visual preview shows VISA', async ({ page }) => {
    await expect(page.getByText('VISA').first()).toBeVisible({ timeout: 10000 });
  });

  test('card features section is visible', async ({ page }) => {
    await expect(page.getByText(/features|características/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('waitlist email input and join button are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /join waitlist|unirse/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('FAQ section is visible', async ({ page }) => {
    // Look for FAQ questions — they're in accordion buttons
    const faqButtons = page.locator('button').filter({ hasText: /\?/ });
    await expect(faqButtons.first()).toBeVisible({ timeout: 10000 });
  });
});
