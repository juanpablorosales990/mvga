import { test, expect } from '@playwright/test';

test.describe('Grants Page', () => {
  test('grants page shows onboarding when no wallet exists', async ({ page }) => {
    await page.goto('/grants');
    // Without a wallet, onboarding screen is shown instead of grants page
    await expect(page.locator('text=/create new wallet|crear nueva billetera/i')).toBeVisible();
  });

  test('create proposal page shows onboarding when not connected', async ({ page }) => {
    await page.goto('/grants/create');
    await expect(page.locator('text=/create new wallet|crear nueva billetera/i')).toBeVisible();
  });
});
