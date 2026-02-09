import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await createWalletAndUnlock(page);
    // Navigate to settings via More page
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await page
      .getByRole('link', { name: /settings|ajustes/i })
      .first()
      .click();
    await expect(page).toHaveURL('/settings');
  });

  test('renders settings page with all sections', async ({ page }) => {
    await expect(page.getByText(/settings|ajustes/i).first()).toBeVisible({ timeout: 10000 });
    // Language section
    await expect(page.getByText('English')).toBeVisible();
    await expect(page.getByText('Español')).toBeVisible();
    // Currency section — scope to main to avoid header VES toggle
    const main = page.locator('main');
    await expect(main.getByText('USD')).toBeVisible();
    await expect(main.getByText('VES')).toBeVisible();
    // Wallet address
    await expect(page.locator('.font-mono.truncate')).toBeVisible();
  });

  test('language toggle switches to Spanish', async ({ page }) => {
    await page.getByText('Español').click();
    // Settings title should now be "Ajustes"
    await expect(page.getByText('Ajustes').first()).toBeVisible({ timeout: 5000 });
    // Switch back
    await page.getByText('English').click();
    await expect(page.getByText('Settings').first()).toBeVisible({ timeout: 5000 });
  });

  test('currency toggle switches to VES', async ({ page }) => {
    const main = page.locator('main');
    await main.getByText('VES').click();
    // The VES button should be active (gold background)
    const vesBtn = main.getByText('VES');
    await expect(vesBtn).toHaveClass(/bg-gold-500/);
  });

  test('auto-compound toggle works', async ({ page }) => {
    // The auto-compound card: h2 is inside div > div, toggle is a sibling button
    // Go up to the card level (.card.p-4) which contains both
    const autoCompoundCard = page
      .getByText(/auto.compound/i)
      .first()
      .locator('xpath=ancestor::div[contains(@class, "card")]');
    const toggle = autoCompoundCard.locator('button.rounded-full');
    // Default is off (bg-white/10), click to enable
    await toggle.click();
    await expect(toggle).toHaveClass(/bg-green-500/);
    // Click again to disable
    await toggle.click();
    await expect(toggle).toHaveClass(/bg-white\/10/);
  });

  test('back button navigates to more page', async ({ page }) => {
    await page.locator('a[href="/more"]').first().click();
    await expect(page).toHaveURL('/more');
  });

  test('help link is visible', async ({ page }) => {
    await expect(page.getByText(/help.*support|ayuda.*soporte/i)).toBeVisible();
  });

  test('recovery phrase section requires password', async ({ page }) => {
    const viewBtn = page.getByText(/view recovery phrase|ver frase de recuperación/i);
    await expect(viewBtn).toBeVisible();
    await viewBtn.click();

    // Password input should appear
    await expect(page.getByPlaceholder(/enter.*password|ingresa.*contraseña/i)).toBeVisible();
  });

  test('shows app version', async ({ page }) => {
    await expect(page.getByText('MVGA Wallet v1.0.0')).toBeVisible();
  });
});
