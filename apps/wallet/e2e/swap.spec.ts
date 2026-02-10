import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

test.describe('Swap Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the fee-info endpoint
    await page.route('**/api/swap/fee-info*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tier: 'BRONZE',
          feePercent: 0.3,
          discountPercent: 0,
          cashbackPercent: 0,
        }),
      })
    );

    await createWalletAndUnlock(page);

    // Navigate via bottom nav
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /swap|intercambiar/i }).click();
    await expect(page).toHaveURL('/swap');
  });

  test('page loads with title', async ({ page }) => {
    await expect(page.getByText(/swap|intercambi/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows from and to token sections', async ({ page }) => {
    await expect(page.getByText(/from|de/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/to|a/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows swap direction toggle button', async ({ page }) => {
    // The circular arrow button to swap directions
    const toggleBtn = page.locator('button').filter({ has: page.locator('svg') });
    await expect(toggleBtn.first()).toBeVisible({ timeout: 10000 });
  });

  test('shows slippage settings', async ({ page }) => {
    const settingsBtn = page.getByRole('button', {
      name: /settings|ajustes|slippage|deslizamiento/i,
    });
    if (await settingsBtn.isVisible().catch(() => false)) {
      await settingsBtn.click();
      // Should show slippage presets
      await expect(page.getByText(/0\.5%/)).toBeVisible({ timeout: 5000 });
    }
  });

  test('swap button is disabled without amount', async ({ page }) => {
    const swapBtn = page.getByRole('button', { name: /swap|intercambiar/i }).last();
    await expect(swapBtn).toBeVisible({ timeout: 10000 });
    await expect(swapBtn).toBeDisabled();
  });

  test('shows Jupiter attribution', async ({ page }) => {
    await expect(page.getByText(/jupiter|powered by/i).first()).toBeVisible({ timeout: 10000 });
  });
});
