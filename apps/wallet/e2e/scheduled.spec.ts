import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

const MOCK_PAYMENTS = [
  {
    id: 'sp-1',
    recipientAddress: '11111111111111111111111111111111',
    recipientLabel: 'Mom',
    token: 'USDC',
    amount: 50,
    frequency: 'MONTHLY',
    status: 'ACTIVE',
    nextExecution: new Date(Date.now() + 86400000 * 7).toISOString(),
    memo: 'Rent',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sp-2',
    recipientAddress: '22222222222222222222222222222222',
    recipientLabel: 'Savings',
    token: 'SOL',
    amount: 10,
    frequency: 'WEEKLY',
    status: 'ACTIVE',
    nextExecution: new Date(Date.now() + 86400000).toISOString(),
    memo: null,
    createdAt: new Date().toISOString(),
  },
];

test.describe('Scheduled Payments Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/scheduler/payments*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PAYMENTS),
      })
    );

    await createWalletAndUnlock(page);

    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await expect(page).toHaveURL('/more');
    await page
      .getByRole('link', { name: /scheduled|programad/i })
      .first()
      .click();
  });

  test('page loads with title', async ({ page }) => {
    await expect(page.getByText(/scheduled|programad/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows tab buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: /active|activ/i }).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: /paused|pausad/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows active payments', async ({ page }) => {
    await expect(page.getByText(/Mom/).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/50/).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows create button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /create|crear/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('Scheduled Payments — empty state', () => {
  test('shows empty state when no payments', async ({ page }) => {
    await page.route('**/api/scheduler/payments*', (route) =>
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
      .getByRole('link', { name: /scheduled|programad/i })
      .first()
      .click();

    await expect(page.getByText(/no.*payment|sin.*pago/i).first()).toBeVisible({ timeout: 10000 });
  });
});
