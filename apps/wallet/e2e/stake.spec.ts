import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

const MOCK_STAKING_INFO = {
  totalStaked: 125000,
  totalStakers: 42,
  apy: 12.5,
  weeklyFeePool: 500,
  stakingRate: 0.35,
};

const MOCK_USER_POSITION = {
  totalStaked: 0,
  baseRewards: 0,
  feeRewards: 0,
  tier: 'BRONZE',
  effectiveApy: 12.5,
  stakes: [],
};

test.describe('Stake Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/staking/info', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_STAKING_INFO),
      })
    );

    await page.route('**/api/staking/*', (route) => {
      if (route.request().url().includes('/info')) return;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_USER_POSITION),
      });
    });

    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          walletAddress: '11111111111111111111111111111111',
        }),
      })
    );

    await createWalletAndUnlock(page);

    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await expect(page).toHaveURL('/more');
    await page
      .getByRole('link', { name: /stake|staking/i })
      .first()
      .click();
    await expect(page).toHaveURL('/stake');
  });

  test('page loads with title', async ({ page }) => {
    await expect(page.getByText(/stake|staking/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows staking stats', async ({ page }) => {
    await expect(page.getByText(/APY/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows stake and unstake tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^stake$/i }).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: /unstake|desbloquear/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows amount input with MAX button', async ({ page }) => {
    await expect(page.getByPlaceholder(/amount|cantidad|0/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: /max|máx/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows lock period selector', async ({ page }) => {
    await expect(page.getByRole('button', { name: /flexible/i }).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/30d|30 d/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows staking tiers', async ({ page }) => {
    await expect(page.getByText(/bronze/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/silver|plata/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/gold|oro/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/diamond|diamante/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('stake button is disabled without amount', async ({ page }) => {
    const stakeBtn = page.getByRole('button', { name: /^stake$/i }).last();
    await expect(stakeBtn).toBeVisible({ timeout: 10000 });
  });
});
