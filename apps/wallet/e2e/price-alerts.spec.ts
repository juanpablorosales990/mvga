import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

async function navigateSPA(page: import('@playwright/test').Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

const MOCK_RATES = {
  tokens: { SOL: 162.5, USDC: 1.0, USDT: 1.0, MVGA: 0.001 },
  ves: { official: 388.74, parallel: 546.05 },
};

function mockPriceAlertsApi(page: import('@playwright/test').Page) {
  return Promise.all([
    // Single route handler that dispatches by URL path
    page.route('**/api/price-alerts**', (route) => {
      const url = route.request().url();
      const method = route.request().method();

      // /price-alerts/rates
      if (url.includes('/price-alerts/rates')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_RATES),
        });
      }

      // /price-alerts/:id (DELETE)
      if (method === 'DELETE' && /\/price-alerts\/[^/]+$/.test(url)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }

      // /price-alerts (GET — list)
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }

      // /price-alerts (POST — create)
      if (method === 'POST') {
        const body = route.request().postDataJSON();
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-alert-1',
            walletAddress: 'test-wallet',
            alertType: body.alertType,
            token: body.token || null,
            vesRateType: body.vesRateType || null,
            condition: body.condition,
            targetPrice: body.targetPrice,
            status: 'ACTIVE',
            cooldownUntil: null,
            lastTriggered: null,
            triggerCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        });
      }

      return route.continue();
    }),
    page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: true }),
      })
    ),
  ]);
}

test.describe('Price Alerts Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockPriceAlertsApi(page);
    await createWalletAndUnlock(page);
    await navigateSPA(page, '/price-alerts');
  });

  test('page loads with token prices tab', async ({ page }) => {
    await expect(page.getByText(/price alerts|alertas de precio/i).first()).toBeVisible({
      timeout: 10000,
    });

    // Token prices grid should be visible
    await expect(page.getByText('SOL').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('USDC').first()).toBeVisible({ timeout: 5000 });
  });

  test('VES rates tab shows BCV and parallel rates', async ({ page }) => {
    // Wait for page to load and data to be fetched
    await expect(page.getByText(/price alerts|alertas de precio/i).first()).toBeVisible({
      timeout: 10000,
    });

    // Wait for token prices to appear (confirms data fetch completed)
    await expect(page.getByText('SOL').first()).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /ves rates|tasas ves/i }).click();

    await expect(page.getByText(/bcv oficial|bcv official/i).first()).toBeVisible({
      timeout: 10000,
    });

    // Check rate values are rendered (not 0.00)
    await expect(page.getByText(/388/).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/546/).first()).toBeVisible({ timeout: 5000 });
  });

  test('add alert button opens form', async ({ page }) => {
    // Wait for page load
    await expect(page.getByText(/no price alerts|sin alertas/i).first()).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole('button', { name: /add alert|agregar alerta/i }).click();

    await expect(page.getByText(/condition|condición/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/target price|precio objetivo/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('create token alert opens and submits form', async ({ page }) => {
    // Wait for empty state
    await expect(page.getByText(/no price alerts|sin alertas/i).first()).toBeVisible({
      timeout: 10000,
    });

    // Open form
    await page.getByRole('button', { name: /add alert|agregar alerta/i }).click();

    // Form should be visible
    await expect(page.getByRole('spinbutton')).toBeVisible({ timeout: 5000 });

    // Fill and submit
    await page.getByRole('spinbutton').fill('200');
    await page.getByRole('button', { name: /^(create alert|crear alerta)$/i }).click();

    // After form submits, the add button should reappear (form closes)
    await expect(page.getByText(/add alert|agregar alerta/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('empty state shows message', async ({ page }) => {
    await expect(page.getByText(/no price alerts|sin alertas/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
