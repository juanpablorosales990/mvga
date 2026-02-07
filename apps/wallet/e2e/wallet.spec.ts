import { test, expect } from '@playwright/test';

test.describe('Wallet Page', () => {
  test('shows onboarding when no wallet exists', async ({ page }) => {
    await page.goto('/');
    // With self-custody wallet, when no wallet exists, onboarding screen is shown
    await expect(page.locator('text=/create new wallet|crear nueva billetera/i')).toBeVisible();
  });

  test('header displays MVGA branding', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('MVGA', { exact: true })).toBeVisible();
  });

  test('onboarding screen blocks page access without wallet', async ({ page }) => {
    // Without a wallet, all routes redirect to onboarding
    await page.goto('/send');
    await expect(page.locator('text=/create new wallet|crear nueva billetera/i')).toBeVisible();

    await page.goto('/receive');
    await expect(page.locator('text=/create new wallet|crear nueva billetera/i')).toBeVisible();

    await page.goto('/swap');
    await expect(page.locator('text=/create new wallet|crear nueva billetera/i')).toBeVisible();

    await page.goto('/stake');
    await expect(page.locator('text=/create new wallet|crear nueva billetera/i')).toBeVisible();
  });
});
