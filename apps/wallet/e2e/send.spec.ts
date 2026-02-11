import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

test.describe('Send Page', () => {
  test.beforeEach(async ({ page }) => {
    await createWalletAndUnlock(page);

    // Navigate via quick actions grid on dashboard (Send is not in bottom nav)
    await page.locator('a[href="/send"]').first().click();
    await expect(page).toHaveURL('/send');
  });

  test('page loads with title', async ({ page }) => {
    await expect(page.getByText(/send|enviar/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows token selector', async ({ page }) => {
    await expect(page.getByText('Token').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('select').first()).toBeVisible({ timeout: 5000 });
  });

  test('shows recipient address input', async ({ page }) => {
    await expect(page.getByPlaceholder(/address|dirección/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows amount input', async ({ page }) => {
    await expect(page.getByPlaceholder(/amount|cantidad|0\.0/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('send button is disabled without inputs', async ({ page }) => {
    const sendBtn = page.getByRole('button', { name: /send|enviar/i }).last();
    await expect(sendBtn).toBeVisible({ timeout: 10000 });
    await expect(sendBtn).toBeDisabled();
  });

  test('shows scan QR button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /scan|escanear/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows batch send link', async ({ page }) => {
    await expect(page.getByText(/batch send|envío masivo/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('validates invalid address', async ({ page }) => {
    const addressInput = page.getByPlaceholder(/address|dirección/i).first();
    await addressInput.fill('invalid-address');

    const amountInput = page.getByPlaceholder(/amount|cantidad|0\.0/i).first();
    await amountInput.fill('1');

    // Try to send — should show validation error
    const sendBtn = page.getByRole('button', { name: /send|enviar/i }).last();
    if (await sendBtn.isEnabled()) {
      await sendBtn.click();
      await expect(page.getByText(/invalid|inválid/i).first()).toBeVisible({ timeout: 5000 });
    }
  });
});
