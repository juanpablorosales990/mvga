import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

test.describe('Receive Page', () => {
  test.beforeEach(async ({ page }) => {
    await createWalletAndUnlock(page);

    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /receive|recibir/i }).click();
    await expect(page).toHaveURL('/receive');
  });

  test('page loads with title', async ({ page }) => {
    await expect(page.getByText(/receive|recibir/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows QR code', async ({ page }) => {
    // QR code is rendered as an SVG
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows wallet address', async ({ page }) => {
    // Address is displayed in monospace
    await expect(page.locator('code, .font-mono, [class*="mono"]').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('copy button works', async ({ page }) => {
    const copyBtn = page.getByRole('button', { name: /copy|copiar/i }).first();
    await expect(copyBtn).toBeVisible({ timeout: 10000 });
    await copyBtn.click();

    await expect(page.getByText(/copied|copiado/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('shows request amount toggle', async ({ page }) => {
    await expect(page.getByRole('button', { name: /request amount|solicitar monto/i })).toBeVisible(
      { timeout: 10000 }
    );
  });

  test('request amount fields expand on click', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /request amount|solicitar monto/i });
    await toggle.click();

    // Should show token selector and amount input
    await expect(page.getByText(/SOL/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('shows how-to instructions', async ({ page }) => {
    await expect(page.getByText(/how to|cómo/i).first()).toBeVisible({ timeout: 10000 });
  });
});
