import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

const MOCK_HISTORY = [
  {
    id: 'po-1',
    recipientEmail: 'maria@airtm.com',
    amountUsd: 50,
    status: 'COMPLETED',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'po-2',
    recipientEmail: 'pedro@airtm.com',
    amountUsd: 25,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  },
];

test.describe('CashOut Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/offramp/payouts', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_HISTORY),
      })
    );

    await createWalletAndUnlock(page);

    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await expect(page).toHaveURL('/more');
    await page
      .getByRole('link', { name: /cash out|retiro/i })
      .first()
      .click();
    await expect(page).toHaveURL('/cashout');
  });

  test('page loads with title and tabs', async ({ page }) => {
    await expect(page.getByText(/cash out|retiro/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /send|enviar/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /history|historial/i })).toBeVisible();
  });

  test('email input is visible', async ({ page }) => {
    await expect(page.getByPlaceholder('maria@airtm.com')).toBeVisible({ timeout: 10000 });
  });

  test('preset amount buttons are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: '$10', exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: '$25', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '$50', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '$100', exact: true })).toBeVisible();
  });

  test('send button is disabled without email and amount', async ({ page }) => {
    const sendBtn = page.getByRole('button', { name: /send|enviar/i }).last();
    await expect(sendBtn).toBeVisible({ timeout: 10000 });
    await expect(sendBtn).toBeDisabled();
  });

  test('invalid email shows error', async ({ page }) => {
    const emailInput = page.getByPlaceholder('maria@airtm.com');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill('invalid-email');
    await expect(page.getByText(/valid email|correo válido/i).first()).toBeVisible();
  });

  test('description field is visible', async ({ page }) => {
    await expect(page.getByText(/description|descripción/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('history tab shows records', async ({ page }) => {
    await page.getByRole('button', { name: /history|historial/i }).click();

    await expect(page.getByText('maria@airtm.com').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/completed|completado/i).first()).toBeVisible();
    await expect(page.getByText('pedro@airtm.com').first()).toBeVisible();
    await expect(page.getByText(/pending|pendiente/i).first()).toBeVisible();
  });

  test('MoneyGram link is visible', async ({ page }) => {
    await expect(page.getByText(/moneygram/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('powered by footer is visible', async ({ page }) => {
    await expect(page.getByText(/powered by airtm/i).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('CashOut Page — empty history', () => {
  test('history tab shows empty state', async ({ page }) => {
    await page.route('**/api/offramp/payouts', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );

    await createWalletAndUnlock(page);

    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await page
      .getByRole('link', { name: /cash out|retiro/i })
      .first()
      .click();

    await page.getByRole('button', { name: /history|historial/i }).click();

    await expect(page.getByText(/no cash out|sin retiro/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
