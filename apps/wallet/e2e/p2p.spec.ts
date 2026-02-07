import { test, expect } from '@playwright/test';

test.describe('P2P Page', () => {
  test('shows onboarding when not connected', async ({ page }) => {
    await page.goto('/p2p');
    // Without a wallet, onboarding screen is shown
    await expect(page.locator('text=/create new wallet|crear nueva billetera/i')).toBeVisible();
  });

  test('displays MVGA branding on onboarding', async ({ page }) => {
    await page.goto('/p2p');
    await expect(page.getByText('MVGA', { exact: true })).toBeVisible();
  });
});
