import { test, expect } from '@playwright/test';

test.describe('Wallet Page', () => {
  test('shows connect wallet prompt when not connected', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=/connect.*wallet|conecta.*billetera/i').first()).toBeVisible();
  });

  test('header displays MVGA branding', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('MVGA', { exact: true })).toBeVisible();
  });

  test('send page shows connect prompt', async ({ page }) => {
    await page.goto('/send');
    await expect(page.locator('text=/connect.*wallet|conecta.*billetera/i').first()).toBeVisible();
  });

  test('receive page shows connect prompt', async ({ page }) => {
    await page.goto('/receive');
    await expect(page.locator('text=/connect.*wallet|conecta.*billetera/i').first()).toBeVisible();
  });

  test('swap page shows connect prompt', async ({ page }) => {
    await page.goto('/swap');
    await expect(page.locator('text=/connect.*wallet|conecta.*billetera/i').first()).toBeVisible();
  });

  test('stake page shows connect prompt', async ({ page }) => {
    await page.goto('/stake');
    await expect(page.locator('text=/connect.*wallet|conecta.*billetera/i').first()).toBeVisible();
  });
});
