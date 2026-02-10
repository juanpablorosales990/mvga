import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

const MOCK_HISTORY = [
  {
    id: 'mg-1',
    direction: 'OFFRAMP',
    amountUsd: 100,
    status: 'COMPLETED',
    referenceNumber: 'MG123456',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mg-2',
    direction: 'ONRAMP',
    amountUsd: 50,
    status: 'PENDING',
    referenceNumber: null,
    createdAt: new Date().toISOString(),
  },
];

test.describe('MoneyGram Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/moneygram/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: true }),
      })
    );

    await page.route('**/api/moneygram/estimate*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          amountUsd: 100,
          bridgeFee: 0.5,
          mgFeeEstimate: 3.99,
          totalFees: 4.49,
          netAmount: 95.51,
          estimatedTime: 600,
        }),
      })
    );

    await page.route('**/api/moneygram/transactions', (route) =>
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
      .getByRole('link', { name: /moneygram/i })
      .first()
      .click();
    await expect(page).toHaveURL('/moneygram');
  });

  test('page loads with title and three tabs', async ({ page }) => {
    await expect(page.getByText(/moneygram/i).first()).toBeVisible({ timeout: 10000 });
    // Three tab buttons
    await expect(page.getByRole('button', { name: /cash out|retiro/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /cash in|depósito/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /history|historial/i })).toBeVisible();
  });

  test('off-ramp tab shows preset amounts', async ({ page }) => {
    await expect(page.getByRole('button', { name: '$25', exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: '$50', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '$100', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '$250', exact: true })).toBeVisible();
  });

  test('on-ramp tab shows preset amounts', async ({ page }) => {
    await page
      .getByRole('button', { name: /cash in|depósito/i })
      .first()
      .click();

    await expect(page.getByRole('button', { name: '$10', exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: '$25', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '$50', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '$100', exact: true })).toBeVisible();
  });

  test('on-ramp tab shows how it works steps', async ({ page }) => {
    await page
      .getByRole('button', { name: /cash in|depósito/i })
      .first()
      .click();
    await expect(page.getByText(/how it works|cómo funciona/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('history tab shows transaction records', async ({ page }) => {
    await page.getByRole('button', { name: /history|historial/i }).click();

    await expect(page.getByText(/cash out|retiro/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('MG123456').first()).toBeVisible();
    await expect(page.getByText(/completed|completado/i).first()).toBeVisible();
    await expect(page.getByText(/pending|pendiente/i).first()).toBeVisible();
  });

  test('powered by footer is visible', async ({ page }) => {
    await expect(page.getByText(/powered by/i).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('MoneyGram Page — disabled', () => {
  test('shows not enabled banner', async ({ page }) => {
    await page.route('**/api/moneygram/status', (route) =>
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
      .getByRole('link', { name: /moneygram/i })
      .first()
      .click();
    await expect(page).toHaveURL('/moneygram');

    await expect(page.getByText(/not.*enabled|no.*disponible|not.*available/i).first()).toBeVisible(
      {
        timeout: 10000,
      }
    );
  });
});

test.describe('MoneyGram Page — empty history', () => {
  test('history tab shows empty state', async ({ page }) => {
    await page.route('**/api/moneygram/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: true }),
      })
    );

    await page.route('**/api/moneygram/transactions', (route) =>
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
      .getByRole('link', { name: /moneygram/i })
      .first()
      .click();

    await page.getByRole('button', { name: /history|historial/i }).click();

    await expect(page.getByText(/no.*transaction|sin.*transacc/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
