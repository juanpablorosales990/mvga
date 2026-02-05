import { test, expect } from '@playwright/test';

test.describe('Grants Page', () => {
  test('grants page loads and shows title', async ({ page }) => {
    await page.goto('/grants');
    await expect(page.locator('text=/grants|subvenciones/i')).toBeVisible();
  });

  test('create proposal page shows connect prompt', async ({ page }) => {
    await page.goto('/grants/create');
    await expect(page.locator('text=/connect.*wallet|conecta.*billetera/i')).toBeVisible();
  });

  test('grants page has propose button', async ({ page }) => {
    await page.goto('/grants');
    await expect(page.locator('text=/propose|proponer/i')).toBeVisible();
  });
});
