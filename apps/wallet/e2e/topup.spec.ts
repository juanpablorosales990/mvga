import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

const MOCK_OPERATOR = {
  operatorId: 123,
  name: 'Movistar',
  denominationType: 'FIXED',
  minAmount: null,
  maxAmount: null,
  fixedAmounts: [0.28, 0.56, 1.12, 2.1],
  suggestedAmounts: [],
  country: { isoName: 'VE', name: 'Venezuela' },
};

const MOCK_HISTORY = [
  {
    id: 'tu-1',
    recipientPhone: '4121234567',
    operatorName: 'Movistar',
    amountUsd: 2.1,
    deliveredAmount: 50000,
    deliveredCurrency: 'VES',
    status: 'SUCCESSFUL',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tu-2',
    recipientPhone: '4241112233',
    operatorName: 'Digitel',
    amountUsd: 1.12,
    deliveredAmount: null,
    deliveredCurrency: null,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  },
];

test.describe('TopUp Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/topup/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: true, treasuryWallet: '11111111111111111111111111111111' }),
      })
    );

    await page.route('**/api/topup/detect-operator', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_OPERATOR),
      })
    );

    await page.route('**/api/topup/history', (route) =>
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
      .getByRole('link', { name: /top.?up|recarga/i })
      .first()
      .click();
    await expect(page).toHaveURL('/topup');
  });

  test('page loads with title and tabs', async ({ page }) => {
    await expect(page.getByText(/phone top.?up|recarga/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: /recharge|recarga/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /history|historial/i })).toBeVisible();
  });

  test('phone input and detect carrier button are visible', async ({ page }) => {
    await expect(page.getByPlaceholder('4121234567')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('+58')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /detect carrier|detectar operador/i })
    ).toBeVisible();
  });

  test('detect carrier button is disabled with short phone', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /detect carrier|detectar operador/i })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole('button', { name: /detect carrier|detectar operador/i })
    ).toBeDisabled();
  });

  test('entering phone enables detect button', async ({ page }) => {
    const phoneInput = page.getByPlaceholder('4121234567');
    await expect(phoneInput).toBeVisible({ timeout: 10000 });
    await phoneInput.fill('4121234567');
    await expect(
      page.getByRole('button', { name: /detect carrier|detectar operador/i })
    ).toBeEnabled();
  });

  test('detecting carrier shows operator and amount buttons', async ({ page }) => {
    const phoneInput = page.getByPlaceholder('4121234567');
    await expect(phoneInput).toBeVisible({ timeout: 10000 });
    await phoneInput.fill('4121234567');
    await page.getByRole('button', { name: /detect carrier|detectar operador/i }).click();

    await expect(page.getByText('Movistar').first()).toBeVisible({ timeout: 10000 });
    // Fixed amount buttons
    await expect(page.getByRole('button', { name: '$0.28', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '$2.1', exact: true })).toBeVisible();
  });

  test('history tab shows records', async ({ page }) => {
    await page.getByRole('button', { name: /history|historial/i }).click();

    await expect(page.getByText('+584121234567').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Movistar').first()).toBeVisible();
    await expect(page.getByText(/successful|exitosa/i).first()).toBeVisible();
    await expect(page.getByText('+584241112233').first()).toBeVisible();
    await expect(page.getByText(/pending|pendiente/i).first()).toBeVisible();
  });

  test('powered by footer is visible', async ({ page }) => {
    await expect(page.getByText(/powered by reloadly/i).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('TopUp Page — disabled', () => {
  test('shows unavailable banner when disabled', async ({ page }) => {
    await page.route('**/api/topup/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false }),
      })
    );

    await createWalletAndUnlock(page);

    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await page
      .getByRole('link', { name: /top.?up|recarga/i })
      .first()
      .click();
    await expect(page).toHaveURL('/topup');

    await expect(page.getByText(/phone top.?up|recarga móvil/i).first()).toBeVisible({
      timeout: 10000,
    });
    // Disabled banner should be visible (red border card)
    await expect(page.locator('.border-red-500\\/20').first()).toBeVisible();
  });
});

test.describe('TopUp Page — empty history', () => {
  test('history tab shows empty state', async ({ page }) => {
    await page.route('**/api/topup/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: true, treasuryWallet: '11111111111111111111111111111111' }),
      })
    );

    await page.route('**/api/topup/history', (route) =>
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
      .getByRole('link', { name: /top.?up|recarga/i })
      .first()
      .click();

    await page.getByRole('button', { name: /history|historial/i }).click();

    await expect(page.getByText(/no top.?up|sin recargas/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
