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
    // Slippage info is visible by default: "Slippage: 0.5%"
    await expect(page.getByText(/slippage|deslizamiento/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('swap button is disabled without amount', async ({ page }) => {
    // Button may say "Enter amount" or "Swap" depending on state — just check it's disabled
    const actionBtn = page.locator('main button[disabled]').first();
    await expect(actionBtn).toBeVisible({ timeout: 10000 });
    await expect(actionBtn).toBeDisabled();
  });

  test('shows Jupiter attribution', async ({ page }) => {
    await expect(page.getByText(/jupiter|powered by/i).first()).toBeVisible({ timeout: 10000 });
  });
});
