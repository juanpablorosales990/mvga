import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

test.describe('Navigation', () => {
  test('loads the wallet page by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('MVGA', { exact: true })).toBeVisible();
  });

  test('bottom nav links navigate correctly', async ({ page }) => {
    // Must create wallet first to access bottom nav
    await createWalletAndUnlock(page);

    // Scope to bottom nav to avoid matching WalletPage quick action links
    const nav = page.locator('nav[aria-label="Main navigation"]');

    // Navigate to Swap
    await nav.getByRole('link', { name: /swap|cambiar/i }).click();
    await expect(page).toHaveURL('/swap');

    // Navigate to Bank
    await nav.getByRole('link', { name: /dollar|dólar/i }).click();
    await expect(page).toHaveURL('/banking');

    // Navigate to P2P
    await nav.getByRole('link', { name: /p2p/i }).click();
    await expect(page).toHaveURL('/p2p');

    // Navigate to More
    await nav.getByRole('link', { name: /more|más/i }).click();
    await expect(page).toHaveURL('/more');

    // Navigate back to Wallet
    await nav.getByRole('link', { name: /wallet|billetera/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('more page has send, receive, history, and grants links', async ({ page }) => {
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

  test('navigating to unknown route shows 404 page', async ({ page }) => {
    await createWalletAndUnlock(page);

    // Use pushState + popstate for client-side SPA navigation
    // (page.goto would full-reload and lock the wallet)
    await page.evaluate(() => {
      window.history.pushState({}, '', '/nonexistent');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await expect(page.locator('text=404')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: /go home|ir al inicio/i })).toBeVisible();
  });

  test('language toggle switches between EN and ES', async ({ page }) => {
    await createWalletAndUnlock(page);

    // The language button shows exactly "ES" or "EN" (2 chars)
    const langButton = page.getByRole('button', { name: /^(ES|EN)$/ });
    const initialText = await langButton.textContent();

    await langButton.click();

    // Language should have toggled
    const newText = await langButton.textContent();
    expect(newText).not.toBe(initialText);
  });
});
