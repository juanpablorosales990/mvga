import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

test.describe('Charge (Get Paid) Page', () => {
  test.beforeEach(async ({ page }) => {
    await createWalletAndUnlock(page);

    // Navigate via More page (client-side) — page.goto reloads and locks wallet
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await expect(page).toHaveURL('/more');
    await page.locator('a[href="/charge"]').click();
    await expect(page).toHaveURL('/charge');
  });

  test('page loads with title', async ({ page }) => {
    await expect(page.getByText(/get paid|cobrar/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows token selector', async ({ page }) => {
    await expect(page.getByText(/SOL/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows amount input', async ({ page }) => {
    await expect(page.getByPlaceholder(/amount|cantidad|0\.0/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows memo input', async ({ page }) => {
    await expect(
      page.getByPlaceholder(/memo|nota|description|descripción|rent|pago/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('no QR code before entering amount', async ({ page }) => {
    // Before entering an amount, should show "enter an amount" prompt
    await expect(page.getByText(/enter.*amount|ingresa.*monto/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('QR code appears after entering amount', async ({ page }) => {
    const amountInput = page.getByPlaceholder(/amount|cantidad|0\.0/i).first();
    await amountInput.fill('10');

    // QR code should now be visible (SVG)
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 10000 });
  });

  test('copy link button appears with amount', async ({ page }) => {
    const amountInput = page.getByPlaceholder(/amount|cantidad|0\.0/i).first();
    await amountInput.fill('5');

    await expect(page.getByRole('button', { name: /copy|copiar/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
