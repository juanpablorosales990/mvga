import { test, expect } from '@playwright/test';

test.describe('P2P Page', () => {
  test('shows connect prompt when not connected', async ({ page }) => {
    await page.goto('/p2p');
    await expect(page.locator('text=/connect.*wallet|conecta.*billetera/i').first()).toBeVisible();
  });

  test('displays P2P title', async ({ page }) => {
    await page.goto('/p2p');
    await expect(page.locator('text=/P2P|intercambio/i').first()).toBeVisible();
  });
});
