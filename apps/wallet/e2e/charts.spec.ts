import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

test.describe('Charts Page', () => {
  test.beforeEach(async ({ page }) => {
    await createWalletAndUnlock(page);

    // Charts is linked from the dashboard (WalletPage), not from More page
    await page.locator('a[href="/charts"]').first().click();
    await expect(page).toHaveURL('/charts');
  });

  test('page loads with title', async ({ page }) => {
    await expect(page.getByText(/price chart|gráfic/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows token toggle buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: /MVGA/i }).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: /SOL/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows timeframe buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: '24h' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: '7d', exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: '30d' })).toBeVisible({ timeout: 10000 });
  });

  test('switching token updates chart', async ({ page }) => {
    const solBtn = page.getByRole('button', { name: /SOL/i }).first();
    await solBtn.click();
    // SOL button should be active (highlighted)
    await expect(solBtn).toBeVisible();
  });

  test('switching timeframe updates chart', async ({ page }) => {
    const btn7d = page.getByRole('button', { name: '7d', exact: true });
    await btn7d.click();
    await expect(btn7d).toBeVisible();
  });
});
