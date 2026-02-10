import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

// Helper to navigate to a route via SPA without triggering lock screen
async function navigateSPA(page: import('@playwright/test').Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  // React Router may need a small delay to process
  await page.waitForTimeout(500);
}

test.describe('Banking Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/wallet/*/transaction-log*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );

    await page.route('**/api/banking/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ cardStatus: 'none' }),
      })
    );

    await createWalletAndUnlock(page);

    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await expect(page).toHaveURL('/more');
    await page
      .getByRole('link', { name: /banking|banco/i })
      .first()
      .click();
    await expect(page).toHaveURL('/banking');
  });

  test('page loads with title', async ({ page }) => {
    await expect(page.getByText(/dollar account|cuenta en dólares/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('quick actions section has deposit, send, and card links', async ({ page }) => {
    await expect(page.getByText(/deposit|depósito/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/withdraw|retirar/i).first()).toBeVisible();
    await expect(page.getByText(/card|tarjeta/i).first()).toBeVisible();
  });

  test('savings preview section is visible', async ({ page }) => {
    await expect(page.getByText(/savings|ahorros/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/apy/i).first()).toBeVisible();
  });

  test('virtual card section shows VISA', async ({ page }) => {
    await expect(page.getByText(/visa/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('no stablecoin transactions message for fresh wallet', async ({ page }) => {
    await expect(page.getByText(/no.*stablecoin|sin.*transacc/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('Deposit Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/paypal/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false }),
      })
    );

    await createWalletAndUnlock(page);

    // Navigate via SPA to /deposit
    await navigateSPA(page, '/deposit');
  });

  test('page loads with title', async ({ page }) => {
    await expect(page.getByText(/deposit|depósito|add funds/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('card/bank tab is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /card.*bank|tarjeta/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('quick amount buttons are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: '$5', exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: '$10', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '$25', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '$50', exact: true })).toBeVisible();
  });

  test('onramper iframe is present', async ({ page }) => {
    const iframe = page.locator('iframe[title]');
    await expect(iframe).toBeVisible({ timeout: 15000 });
  });

  test('MoneyGram and P2P links are visible', async ({ page }) => {
    await expect(page.getByText(/moneygram/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/p2p/i).first()).toBeVisible();
  });

  test('powered by footer is visible', async ({ page }) => {
    await expect(page.getByText(/powered by onramper/i).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Savings Page', () => {
  test.beforeEach(async ({ page }) => {
    await createWalletAndUnlock(page);

    // Navigate via SPA to /banking/savings
    await navigateSPA(page, '/banking/savings');
  });

  test('page loads with savings title', async ({ page }) => {
    await expect(page.getByText(/savings|ahorros/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('savings balance card is visible', async ({ page }) => {
    await expect(page.getByText(/savings balance|saldo de ahorros/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/apy/i).first()).toBeVisible();
  });

  test('interest projections section shows daily, monthly, yearly', async ({ page }) => {
    await expect(page.getByText(/interest projections|proyecciones/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/daily|diario/i).first()).toBeVisible();
    await expect(page.getByText(/monthly|mensual/i).first()).toBeVisible();
    await expect(page.getByText(/yearly|anual/i).first()).toBeVisible();
  });

  test('deposit and withdraw buttons are visible', async ({ page }) => {
    await expect(page.getByText(/deposit funds|depositar/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/withdraw funds|retirar/i).first()).toBeVisible();
  });

  test('savings goal section is visible', async ({ page }) => {
    await expect(page.getByText(/savings goal|meta de ahorro/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('current rates section is visible', async ({ page }) => {
    await expect(page.getByText(/current rates|tasas actuales/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('how interest works section is visible', async ({ page }) => {
    await expect(page.getByText(/how interest works|cómo funciona/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('back link navigates to banking', async ({ page }) => {
    const backLink = page.locator('a[href="/banking"]').first();
    await expect(backLink).toBeVisible({ timeout: 10000 });
  });
});
