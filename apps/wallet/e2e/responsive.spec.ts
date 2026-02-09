import { test, expect, devices } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

const mobile = devices['Pixel 5'];

// test.use() must be top-level, not inside describe
test.use({ ...mobile });

test.describe('Responsive — Mobile', () => {
  test('bottom nav shows all 5 tabs on mobile', async ({ page }) => {
    await createWalletAndUnlock(page);

    // Scope to bottom nav to avoid matching WalletPage quick action links
    const nav = page.locator('nav[aria-label="Main navigation"]');

    // All 5 bottom nav tabs should be visible
    await expect(nav.getByRole('link', { name: /wallet|billetera/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /swap|cambiar/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /dollar|dólar/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /p2p/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /more|más/i })).toBeVisible();
  });

  test('header does not overflow on mobile', async ({ page }) => {
    await createWalletAndUnlock(page);

    const header = page.locator('header').first();
    const box = await header.boundingBox();
    expect(box).toBeTruthy();
    // Header should not be wider than viewport (412px for Pixel 5)
    expect(box!.width).toBeLessThanOrEqual(420);
  });

  test('more page renders correctly on mobile', async ({ page }) => {
    await createWalletAndUnlock(page);

    // Navigate via bottom nav (page.goto would reload and lock the wallet)
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await expect(page).toHaveURL('/more');

    await expect(page.getByRole('link', { name: /send|enviar/i }).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('link', { name: /receive|recibir/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /history|historial/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /grants|subvenciones/i }).first()).toBeVisible();
  });

  test('navigation works on mobile', async ({ page }) => {
    await createWalletAndUnlock(page);

    // Scope to bottom nav to avoid matching WalletPage quick action links
    const nav = page.locator('nav[aria-label="Main navigation"]');

    // Tap Swap in bottom nav
    await nav.getByRole('link', { name: /swap|cambiar/i }).click();
    await expect(page).toHaveURL('/swap');

    // Tap back to Wallet
    await nav.getByRole('link', { name: /wallet|billetera/i }).click();
    await expect(page).toHaveURL('/');
  });
});
