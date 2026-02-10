import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

test.describe('Scan & Pay Page', () => {
  test.beforeEach(async ({ page }) => {
    await createWalletAndUnlock(page);
    // Navigate via quick actions on home page
    await page.locator('a[href="/scan"]').first().click();
    await expect(page).toHaveURL('/scan');
  });

  test('page loads with two tabs', async ({ page }) => {
    // Both tabs visible
    const scanTab = page.getByRole('button', { name: /^scan$/i });
    const myQrTab = page.getByRole('button', { name: /my qr/i });
    await expect(scanTab).toBeVisible({ timeout: 10000 });
    await expect(myQrTab).toBeVisible();
  });

  test('scan tab is active by default', async ({ page }) => {
    const scanTab = page.getByRole('button', { name: /^scan$/i });
    // Active tab has gold styling
    await expect(scanTab).toHaveClass(/border-gold-500/);
  });

  test('switching to My QR tab shows QR code and address', async ({ page }) => {
    const myQrTab = page.getByRole('button', { name: /my qr/i });
    await myQrTab.click();

    // QR code (SVG) should be visible
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 10000 });

    // Wallet address shown (base58 format — starts with letters/numbers)
    await expect(page.locator('.font-mono').first()).toBeVisible();

    // "Your Solana Address" text
    await expect(
      page.getByText(/your solana address|tu dirección de solana/i).first()
    ).toBeVisible();
  });

  test('My QR tab has Copy Address button', async ({ page }) => {
    await page.getByRole('button', { name: /my qr/i }).click();

    const copyBtn = page.getByRole('button', {
      name: /copy address|copiar dirección/i,
    });
    await expect(copyBtn).toBeVisible({ timeout: 10000 });
  });

  test('My QR tab has request amount toggle', async ({ page }) => {
    await page.getByRole('button', { name: /my qr/i }).click();

    // "Request specific amount" toggle
    const toggle = page.getByText(/request specific amount|solicitar monto/i);
    await expect(toggle).toBeVisible({ timeout: 10000 });

    // Click to expand
    await toggle.click();

    // Token select and amount input should appear
    await expect(page.locator('select').first()).toBeVisible();
    await expect(page.locator('input[type="number"]').first()).toBeVisible();
  });

  test('My QR tab amount fields show payment link button when filled', async ({ page }) => {
    await page.getByRole('button', { name: /my qr/i }).click();

    // Expand amount fields
    await page.getByText(/request specific amount|solicitar monto/i).click();

    // Payment link button should NOT be visible yet (no amount)
    await expect(
      page.getByRole('button', { name: /create payment link|crear enlace/i })
    ).not.toBeVisible();

    // Fill amount
    await page.locator('input[type="number"]').first().fill('5');

    // Now "Create Payment Link" button should appear
    await expect(
      page.getByRole('button', { name: /create payment link|crear enlace/i })
    ).toBeVisible();
  });

  test('switching tabs preserves My QR state', async ({ page }) => {
    // Go to My QR
    await page.getByRole('button', { name: /my qr/i }).click();
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 10000 });

    // Switch back to Scan
    await page.getByRole('button', { name: /^scan$/i }).click();

    // Switch back to My QR — should still show QR
    await page.getByRole('button', { name: /my qr/i }).click();
    await expect(page.locator('svg').first()).toBeVisible();
  });

  test('scan tab shows camera viewport with scan frame', async ({ page }) => {
    // The camera frame overlay should be visible (even if camera can't start in headless)
    await expect(page.locator('video')).toBeVisible({ timeout: 10000 });

    // Scan hint text
    await expect(page.getByText(/point camera|apunta la cámara/i)).toBeVisible();
  });

  test('scan tab shows camera permission message on error', async ({ page }) => {
    // In headless Playwright, camera won't work. Wait for the permission timeout.
    await expect(page.getByText(/camera access|acceso a la cámara/i)).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('Scan & Pay — Navigation', () => {
  test('accessible from More page', async ({ page }) => {
    await createWalletAndUnlock(page);

    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await expect(page).toHaveURL('/more');

    await page
      .getByRole('link', { name: /scan|escanear/i })
      .first()
      .click();
    await expect(page).toHaveURL('/scan');
  });

  test('accessible from home quick actions', async ({ page }) => {
    await createWalletAndUnlock(page);

    // Quick action grid has /scan link
    const quickActions = page.locator('div.grid.grid-cols-6');
    await expect(quickActions.locator('a[href="/scan"]')).toBeVisible({
      timeout: 10000,
    });

    await quickActions.locator('a[href="/scan"]').click();
    await expect(page).toHaveURL('/scan');
  });
});
