import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

test.describe('More Page & Sub-pages', () => {
  test.beforeEach(async ({ page }) => {
    await createWalletAndUnlock(page);
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await expect(page).toHaveURL('/more');
  });

  test('more page shows all menu items', async ({ page }) => {
    await expect(page.getByRole('link', { name: /send|enviar/i }).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('link', { name: /receive|recibir/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /history|historial/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /grants|subvenciones/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /referral|referidos/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /settings|ajustes/i }).first()).toBeVisible();
  });

  test('referral page loads and shows structure', async ({ page }) => {
    await page
      .getByRole('link', { name: /referral|referidos/i })
      .first()
      .click();
    await expect(page).toHaveURL('/referral');
    await expect(page.getByText(/referral program|programa de referidos/i).first()).toBeVisible({
      timeout: 10000,
    });
    // Subtitle about earning MVGA
    await expect(page.getByText(/100 MVGA/i).first()).toBeVisible();
  });

  test('history page loads from more menu', async ({ page }) => {
    await page
      .getByRole('link', { name: /history|historial/i })
      .first()
      .click();
    await expect(page).toHaveURL('/history');
    await expect(
      page.getByText(/transaction history|historial de transacciones/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('portfolio page loads from more menu', async ({ page }) => {
    await page
      .getByRole('link', { name: /portfolio|portafolio/i })
      .first()
      .click();
    await expect(page).toHaveURL('/portfolio');
    await expect(page.getByText(/portfolio|portafolio/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('contacts page loads from more menu', async ({ page }) => {
    await page
      .getByRole('link', { name: /contacts|contactos/i })
      .first()
      .click();
    await expect(page).toHaveURL('/contacts');
    await expect(page.getByText(/contacts|contactos/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('notifications page loads from more menu', async ({ page }) => {
    await page
      .getByRole('link', { name: /notifications|notificaciones/i })
      .first()
      .click();
    await expect(page).toHaveURL('/notifications');
    await expect(page.getByText(/notifications|notificaciones/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('help page loads from more menu', async ({ page }) => {
    await page
      .getByRole('link', { name: /help|ayuda/i })
      .first()
      .click();
    await expect(page).toHaveURL('/help');
    await expect(page.getByText(/faq|preguntas/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('charge page loads', async ({ page }) => {
    await page
      .getByRole('link', { name: /get paid|cobrar/i })
      .first()
      .click();
    await expect(page).toHaveURL('/charge');
    await expect(page.getByText(/get paid|cobrar/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('price alerts page loads from more menu', async ({ page }) => {
    await page
      .getByRole('link', { name: /price alerts|alertas de precio/i })
      .first()
      .click();
    await expect(page).toHaveURL('/price-alerts');
    await expect(page.getByText(/price alerts|alertas de precio/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
