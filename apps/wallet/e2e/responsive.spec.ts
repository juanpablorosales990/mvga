import { test, expect, devices } from '@playwright/test';

const mobile = devices['Pixel 5'];

// test.use() must be top-level, not inside describe
test.use({ ...mobile });

test.describe('Responsive — Mobile', () => {
  test('bottom nav shows all 5 tabs on mobile', async ({ page }) => {
    await page.goto('/');

    // All 5 bottom nav tabs should be visible
    await expect(page.getByRole('link', { name: /wallet|billetera/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /swap|cambiar/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /stake|staking/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /p2p/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /more|mas/i })).toBeVisible();
  });

  test('header does not overflow on mobile', async ({ page }) => {
    await page.goto('/');

    const header = page.locator('header').first();
    const box = await header.boundingBox();
    expect(box).toBeTruthy();
    // Header should not be wider than viewport (412px for Pixel 5)
    expect(box!.width).toBeLessThanOrEqual(420);
  });

  test('more page renders correctly on mobile', async ({ page }) => {
    await page.goto('/more');

    await expect(page.getByRole('link', { name: /send|enviar/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /receive|recibir/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /history|historial/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /grants|subvenciones/i })).toBeVisible();
  });

  test('navigation works on mobile', async ({ page }) => {
    await page.goto('/');

    // Tap Swap in bottom nav
    await page.getByRole('link', { name: /swap|cambiar/i }).click();
    await expect(page).toHaveURL('/swap');

    // Tap back to Wallet
    await page.getByRole('link', { name: /wallet|billetera/i }).click();
    await expect(page).toHaveURL('/');
  });
});
