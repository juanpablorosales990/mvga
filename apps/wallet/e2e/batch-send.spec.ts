import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

test.describe('Batch Send Page', () => {
  test.beforeEach(async ({ page }) => {
    await createWalletAndUnlock(page);

    await page.goto('/batch-send');
    await expect(page).toHaveURL('/batch-send');
  });

  test('page loads with title', async ({ page }) => {
    await expect(page.getByText(/batch send|envío masivo/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows token selector', async ({ page }) => {
    await expect(page.getByText(/SOL/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows first recipient row', async ({ page }) => {
    await expect(page.getByText(/recipient.*1|destinatario.*1/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows address and amount inputs', async ({ page }) => {
    await expect(page.getByPlaceholder(/address|dirección/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByPlaceholder(/amount|cantidad/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('add recipient button works', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add.*recipient|agregar.*destinatario/i });
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    // Should now show Recipient #2
    await expect(page.getByText(/recipient.*2|destinatario.*2/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('remove recipient button appears with multiple rows', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add.*recipient|agregar.*destinatario/i });
    await addBtn.click();

    await expect(page.getByText(/remove|eliminar/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('send button shows with zero total', async ({ page }) => {
    const sendBtn = page.getByRole('button', { name: /preview|send|enviar/i }).last();
    await expect(sendBtn).toBeVisible({ timeout: 10000 });
    await expect(sendBtn).toBeDisabled();
  });

  test('shows from contacts link', async ({ page }) => {
    await expect(page.getByText(/contact|contacto/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('back link navigates to send', async ({ page }) => {
    const backLink = page.getByRole('link', { name: /back|atrás|send|enviar/i }).first();
    if (await backLink.isVisible().catch(() => false)) {
      await backLink.click();
      await expect(page).toHaveURL('/send');
    }
  });
});
