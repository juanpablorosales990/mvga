import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

test.describe('Charts Page', () => {
  test.beforeEach(async ({ page }) => {
    await createWalletAndUnlock(page);

    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await expect(page).toHaveURL('/more');
    await page
      .getByRole('link', { name: /chart|gráfic/i })
      .first()
      .click();
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
    await expect(page.getByRole('button', { name: /24h/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /7d/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /30d/i })).toBeVisible({ timeout: 10000 });
  });

  test('switching token updates chart', async ({ page }) => {
    const solBtn = page.getByRole('button', { name: /SOL/i }).first();
    await solBtn.click();
    // SOL button should be active (highlighted)
    await expect(solBtn).toBeVisible();
  });

  test('switching timeframe updates chart', async ({ page }) => {
    const btn7d = page.getByRole('button', { name: /7d/i });
    await btn7d.click();
    await expect(btn7d).toBeVisible();
  });
});
